/**
 * Talabat Restaurant Importer
 *
 * Scrapes a Talabat restaurant page and creates a full business (tenant) with
 * categories and products. Converts JOD to ILS.
 *
 * Workaround for tsx+Playwright __name error: https://github.com/privatenumber/tsx/issues/113
 */
const _fp = Function.prototype
const _toString = _fp.toString
_fp.toString = function (this: Function) {
  const s = Reflect.apply(_toString, this, [] as unknown[])
  if (typeof s === 'string' && s.includes('__name') && !s.includes('const __name =')) {
    return `function () { const __name = (t,v) => Object.defineProperty(t,"name",{value:v,configurable:!0}); return (${s}).apply(this,arguments); }`
  }
  return s
}

/**
 * Usage:
 *   npx tsx scripts/import-talabat.ts --url "https://www.talabat.com/ar/jordan/restaurant/646801/al-dayaa"
 *   npx tsx scripts/import-talabat.ts --url "..." --owner-email burhank@gmail.com
 *
 * Requires:
 *   - SANITY_API_TOKEN in .env.local (with write access)
 *   - CLERK_SECRET_KEY in .env.local (to resolve owner by email)
 *   - Playwright: npx playwright install chromium
 *
 * Default: country=Palestine, city=Bethany, owner=burhank@gmail.com
 * JOD→ILS rate: TALABAT_JOD_TO_ILS_RATE (default 5.2)
 */

import { chromium } from 'playwright'
import path from 'path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { config } from 'dotenv'
import { createClient } from 'next-sanity'
import { createClerkClient } from '@clerk/backend'
import { apiVersion } from '../sanity/env'
import { slugify, ensureUniqueSlug } from '../lib/slugify'

config({ path: path.join(process.cwd(), '.env.local') })

/** Resolve Clerk user by email for standalone scripts (uses @clerk/backend, not Next.js). */
async function getClerkUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const key = process.env.CLERK_SECRET_KEY
  if (!key) return null
  const normalized = (email ?? '').trim().toLowerCase()
  if (!normalized) return null
  try {
    const client = createClerkClient({ secretKey: key })
    const { data } = await client.users.getUserList({
      emailAddress: [normalized],
      limit: 1,
    })
    const user = data?.[0]
    if (!user?.id) return null
    const primaryEmail = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? ''
    return { id: user.id, email: primaryEmail }
  } catch {
    return null
  }
}

const JOD_TO_ILS = parseFloat(process.env.TALABAT_JOD_TO_ILS_RATE || '5.2')
const DEFAULT_OWNER_EMAIL = 'burhank@gmail.com'
const DEFAULT_COUNTRY = 'Palestine'
const DEFAULT_CITY = 'Bethany'

function getArg(name: string): string | null {
  const i = process.argv.indexOf(name)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1].trim()
  return null
}

let TALABAT_URL = (getArg('--url') || getArg('-u') || '').trim()
const OWNER_EMAIL = getArg('--owner-email') || DEFAULT_OWNER_EMAIL
const INTERACTIVE_AUTH = process.argv.includes('--interactive-auth')

// Canonical slug from URL: /restaurant/646801/al-dayaa -> al-dayaa (used for deduplication)
function getCanonicalSlugFromUrl(url: string): string {
  const m = url.match(/\/restaurant\/\d+\/([^/?#]+)/)
  return m ? m[1].toLowerCase() : ''
}

type ScrapedCategory = { titleAr: string; titleEn: string }
type ScrapedProduct = {
  titleAr: string
  titleEn: string
  descriptionAr?: string
  descriptionEn?: string
  priceJOD: number
  imageUrl?: string
  categoryIndex: number
}

type ScrapedRestaurant = {
  nameAr: string
  nameEn: string
  logoUrl?: string
  specialties: string[]
  categories: ScrapedCategory[]
  products: ScrapedProduct[]
}

function parseJODPrice(text: string): number {
  // "1.500 JOD", "JOD 2.50", "2.5", etc.
  const cleaned = text.replace(/[^\d.]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function toILS(jod: number): number {
  return Math.round(jod * JOD_TO_ILS * 100) / 100
}

function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

async function scrapeTalabatPage(url: string): Promise<ScrapedRestaurant> {
  const browser = await chromium.launch({
    headless: process.env.TALABAT_HEADLESS !== 'false',
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  })
  const page = await context.newPage()

  // Capture menu/restaurant API responses
  const capturedJson: string[] = []
  page.on('response', async (res) => {
    try {
      const u = res.url()
      if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
        if (u.includes('restaurant') || u.includes('menu') || u.includes('branch')) {
          const ct = res.headers()['content-type'] || ''
          if (ct.includes('json')) {
            const body = await res.text()
            if (body && body.length > 100) capturedJson.push(body)
          }
        }
      }
    } catch { /* ignore */ }
  })

  try {
    // Ensure we have a full Talabat restaurant URL
    const parsed = new URL(url.startsWith('http') ? url : `https://www.talabat.com${url.startsWith('/') ? '' : '/'}${url}`)
    const targetUrl = parsed.origin + parsed.pathname + (parsed.search || '')
    if (!targetUrl.includes('/restaurant/')) {
      throw new Error(`URL must be a Talabat restaurant page: .../restaurant/ID/slug`)
    }

    console.log('   Navigating to', targetUrl)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(INTERACTIVE_AUTH ? 4000 : 5000)

    // Verify we're on the restaurant page, not main Talabat
    const finalUrl = page.url()
    if (!finalUrl.includes('/restaurant/')) {
      throw new Error(`Redirected to ${finalUrl} — not a restaurant page. Talabat may have redirected. Try with --interactive-auth and solve any challenge.`)
    }

    // If on Arabic page, switch to English for product names (navigate or click switcher)
    const isArabicUrl = finalUrl.includes('/ar/')
    let switchedToEnglish = false
    if (isArabicUrl) {
      const enUrl = finalUrl.replace(/\/ar\//, '/')
      if (enUrl !== finalUrl) {
        console.log('   Switching to English version...')
        await page.goto(enUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForTimeout(3000)
        switchedToEnglish = true
      }
    } else {
      for (const label of ['English', 'EN']) {
        try {
          const langLink = page.locator(`a, button`).filter({ hasText: new RegExp(`^${label}$`, 'i') }).first()
          if ((await langLink.count()) > 0 && (await langLink.isVisible())) {
            await langLink.click({ timeout: 2000 })
            await page.waitForTimeout(2000)
            switchedToEnglish = true
            break
          }
        } catch { /* try next */ }
      }
    }

    // Click menu tab (Talabat uses "Menu" in English, "قائمة الطعام" in Arabic)
    for (const tabText of ['Menu', 'قائمة الطعام', 'menu']) {
      try {
        const menuTab = page.getByRole('tab', { name: tabText }).or(page.getByText(tabText, { exact: true })).first()
        if ((await menuTab.count()) > 0) {
          await menuTab.click({ timeout: 3000 })
          await page.waitForTimeout(2000)
          break
        }
      } catch {
        /* try next */
      }
    }

    if (INTERACTIVE_AUTH) {
      console.log('   Chrome is open. Scroll the menu if needed to load all items, then press Enter here.')
      const rl = createInterface({ input, output })
      try {
        await rl.question('   Press Enter to continue scraping...')
      } finally {
        rl.close()
      }
      await page.waitForTimeout(1500)
    }

    // Scroll to trigger lazy-loaded menu items (like Baladi)
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() => window.scrollBy(0, 400))
      await page.waitForTimeout(INTERACTIVE_AUTH ? 800 : 600)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(2000)

    // Wait for menu content
    await page.waitForSelector('[class*="menu"], [class*="item"], [class*="product"], [class*="dish"], [class*="category"]', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(1000)

    // Extract script content in page (minimal evaluate to avoid page JS conflicts)
    const scriptTexts = await page.evaluate(() => {
      const out: string[] = []
      document.querySelectorAll('script#__NEXT_DATA__, script[type="application/json"]').forEach((s) => {
        const t = s.textContent
        if (t) out.push(t)
      })
      return out
    })

    function parseRestaurantFromJson(data: unknown): ScrapedRestaurant | null {
      if (!data || typeof data !== 'object') return null
      const d = data as Record<string, unknown>
      const findWithMenu = (o: unknown): { r: Record<string, unknown>; menu: Array<Record<string, unknown>> } | null => {
        if (!o || typeof o !== 'object') return null
        const x = o as Record<string, unknown>
        const r = (x.restaurant || (x.props as Record<string, unknown>)?.pageProps?.restaurant || x.branch || x.data) as Record<string, unknown> | undefined
        if (r) {
          const menu = (r.menu || r.menuSections || r.sections || r.categories || (r as { menuSections?: unknown }).menuSections || x.menu || []) as Array<Record<string, unknown>>
          if (Array.isArray(menu) && menu.length > 0) return { r, menu }
          const items = (r.items || r.products || r.menuItems || []) as Array<Record<string, unknown>>
          if (Array.isArray(items) && items.length > 0) return { r, menu: [{ items }] }
        }
        for (const v of Object.values(x)) {
          const f = findWithMenu(v)
          if (f) return f
        }
        return null
      }
      const found = findWithMenu(d)
      if (!found) return null
      const { r, menu } = found
      const resName = String(r.name || r.restaurantName || r.title || (r as { nameEn?: string }).nameEn || '')
      const resNameEn = String(r.nameEn || (r as { name_en?: string }).name_en || resName)
      const resNameAr = String((r as { nameAr?: string }).nameAr || (r as { name_ar?: string }).name_ar || resName)
      const logoObj = r.logo as { url?: string } | undefined
      const imgObj = r.image as { url?: string } | undefined
      const logo = logoObj?.url || imgObj?.url || (r as { imageUrl?: string }).imageUrl
      const categories: ScrapedCategory[] = []
      const products: ScrapedProduct[] = []
      const specialties = (r.cuisines || r.specialties || r.categories || []) as unknown[]
      menu.forEach((sec: Record<string, unknown>, ci: number) => {
        const catTitle = String(sec.title || sec.name || (sec as { titleEn?: string }).titleEn || '')
        const catTitleAr = String((sec as { titleAr?: string }).titleAr || (sec as { title_ar?: string }).title_ar || catTitle)
        const catTitleEn = String((sec as { titleEn?: string }).titleEn || (sec as { title_en?: string }).title_en || catTitle)
        categories.push({ titleAr: catTitleAr || catTitle, titleEn: catTitleEn || catTitle })
        const items = (sec.items || sec.products || sec.menuItems || sec.dishes || (sec as { menuItems?: unknown }).menuItems || []) as Array<Record<string, unknown>>
        items.forEach((item: Record<string, unknown>) => {
          let p = item.price ?? (item as { priceInMinorUnits?: number }).priceInMinorUnits ?? (item as { price?: { value?: number } }).price?.value
          if (typeof p === 'number' && p > 1000) p = p / 100 // fils to JOD
          const price = Number(p) || parseFloat(String(p || '0').replace(/[^\d.]/g, '')) || 0
          const itemName = String(item.name || item.title || (item as { nameEn?: string }).nameEn || '')
          const itemAr = String((item as { nameAr?: string }).nameAr || (item as { name_ar?: string }).name_ar || itemName)
          const itemEn = String((item as { nameEn?: string }).nameEn || (item as { name_en?: string }).name_en || itemName)
          const descEn = String((item as { descriptionEn?: string }).descriptionEn || (item as { description?: string }).description || '')
          const descAr = String((item as { descriptionAr?: string }).descriptionAr || (item as { description_ar?: string }).description_ar || descEn)
          const iImg = item.image as { url?: string } | undefined
          const img = iImg?.url || (item.imageUrl as string) || ((item.thumbnail as { url?: string })?.url) || ((item as { imageUrl?: string }).imageUrl)
          if (itemName || itemAr || itemEn) {
            products.push({
              titleAr: itemAr || itemName,
              titleEn: itemEn || itemName,
              descriptionAr: descAr || undefined,
              descriptionEn: descEn || undefined,
              priceJOD: price,
              imageUrl: img,
              categoryIndex: ci,
            })
          }
        })
      })
      if (!resName && categories.length === 0 && products.length === 0) return null
      return {
        nameAr: resNameAr || resName,
        nameEn: resNameEn || resName,
        logoUrl: logo,
        specialties: Array.isArray(specialties) ? specialties.map((s) => String(s)) : [],
        categories,
        products,
      }
    }

    let fromJson: ScrapedRestaurant | null = null
    const allJsonSources = [...scriptTexts, ...capturedJson]
    for (const txt of allJsonSources) {
      try {
        const data = JSON.parse(txt)
        const parsed = parseRestaurantFromJson(data)
        if (parsed && parsed.products.length > 0) {
          fromJson = parsed
          break
        }
      } catch {
        /* skip */
      }
    }

    // Parse restaurant slug from the URL (canonical for dedup)
    const urlSlugMatch = targetUrl.match(/\/restaurant\/\d+\/([^/?#]+)/)
    const urlSlug = urlSlugMatch?.[1] || ''
    const nameEnFromSlug = urlSlug
      ? urlSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : 'Restaurant'

    // DOM scraping: get raw data first (minimal evaluate to avoid page conflicts)
    const rawData = await page.evaluate((opts: { urlSlug: string; nameEnFromSlug: string }) => {
      const result: ScrapedRestaurant = {
        nameAr: '',
        nameEn: opts.nameEnFromSlug,
        specialties: [],
        categories: [],
        products: [],
      }

      // Restaurant name: use slug from URL (passed from Node), get Arabic from title
      result.nameEn = opts.nameEnFromSlug
      const h1 = document.querySelector('h1')?.textContent?.trim()
      const restNameEl = document.querySelector('[class*="restaurant-name"], [class*="RestaurantName"], [data-testid*="restaurant-name"]')
      let restName = restNameEl?.textContent?.trim() || h1 || ''

      if (restName.includes('توصيل') || restName.includes('delivery') || restName.length > 50) restName = ''
      const titleStr = document.title || ''
      const fromTitleAr = titleStr.match(/من\s+([^\s]+)\s+في/)?.[1]?.trim()
      const fromTitleEn = titleStr.match(/^([^|]+)\s+menu/i)?.[1]?.trim()
      if (fromTitleAr && fromTitleAr.length < 40) restName = fromTitleAr
      else if (fromTitleEn && fromTitleEn.length < 40) restName = fromTitleEn

      result.nameAr = restName || opts.nameEnFromSlug

      // Logo
      const logoImg = document.querySelector('img[alt*="logo"], img[alt*="Logo"], .restaurant-logo img, [class*="logo"] img, header img')
      if (logoImg instanceof HTMLImageElement && logoImg.src) {
        result.logoUrl = logoImg.src
      }

      // Specialties (e.g. "ساندويشات, شاورما")
      const specEl = document.querySelector('[class*="cuisine"], [class*="specialt"], [class*="category"]')
      if (specEl?.textContent) {
        result.specialties = specEl.textContent.split(/[,،]/).map((s) => s.trim()).filter(Boolean)
      }

      // Menu categories: try left sidebar first ("Categories" section), then section headers in main content
      const sidebarCatSelectors = '[class*="Categories"] button, [class*="Categories"] a, aside [class*="category"] button, aside [class*="category"] a, nav[class*="category"] button, [class*="sidebar"] [class*="category"]'
      document.querySelectorAll(sidebarCatSelectors).forEach((el) => {
        const title = (el.textContent || '').trim().replace(/\s*🔥\s*$/, '').trim()
        if (title && title.length > 1 && title.length < 60 && !result.categories.some((c) => c.titleEn === title && c.titleAr === title)) {
          result.categories.push({ titleAr: title, titleEn: title })
        }
      })
      const catSelectors = '[class*="menu-category"], [class*="category-title"], [class*="section-title"], [class*="SectionTitle"], section h2, section h3, section h4, .menu-section h2, [data-testid*="category"], [class*="Category"] h2, [class*="Category"] h4, [class*="category"] h2, [class*="category"] h4'
      document.querySelectorAll(catSelectors).forEach((el) => {
        const title = (el.textContent || '').trim().replace(/\s*🔥\s*$/, '').trim()
        if (title && title.length > 1 && title.length < 60 && !result.categories.some((c) => c.titleEn === title)) {
          result.categories.push({ titleAr: title, titleEn: title })
        }
      })

      const getImgUrl = (img: HTMLImageElement | null): string | undefined => {
        if (!img) return undefined
        const candidates = [
          img.src,
          img.getAttribute('src'),
          img.getAttribute('data-src'),
          img.getAttribute('data-srcset')?.split(/[\s,]/)[0],
          img.getAttribute('data-lazy-src'),
          img.getAttribute('data-original'),
          img.getAttribute('srcset')?.split(/[\s,]/)[0],
          (img as HTMLImageElement & { currentSrc?: string }).currentSrc,
        ]
        for (const v of candidates) {
          let url = (v || '').trim().replace(/&amp;(amp;)*/g, '&')
          if (url && url.startsWith('http') && !url.includes('placeholder') && !url.includes('1x1')) return url
        }
        return undefined
      }

      const catHeaders: { title: string; index: number }[] = []
      document.querySelectorAll(catSelectors).forEach((el) => {
        const title = (el.textContent || '').trim().replace(/\s*🔥\s*$/, '').trim()
        if (title && title.length > 1 && title.length < 60) {
          catHeaders.push({ title, index: catHeaders.length })
        }
      })

      const findCategoryForElement = (el: Element): number => {
        let n = el as Element | null
        while (n) {
          let prev: Element | null = n.previousElementSibling
          while (prev) {
            const tag = prev.tagName
            const cls = (prev.className && typeof prev.className === 'string' ? prev.className : '') as string
            const isHeader = tag === 'H2' || tag === 'H3' || tag === 'H4' || /section-title|category-title|menu-category/i.test(cls)
            if (isHeader) {
              const t = (prev.textContent || '').trim()
              for (let j = 0; j < catHeaders.length; j++) {
                if (t.indexOf(catHeaders[j].title) >= 0 || catHeaders[j].title.indexOf(t) >= 0) return j
              }
            }
            prev = prev.previousElementSibling
          }
          n = n.parentElement
        }
        return 0
      }

      let currentCatIndex = 0
      const seenNames = new Set<string>()

      // Talabat-specific: div.item-name with .f-15 (title), .f-12.description (description), .currency or price-on-selection
      const processCard = (card: Element) => {
        if (!card || !card.querySelector('div.item-name')) return
        const root = card as Element
        currentCatIndex = findCategoryForElement(root)
        const nameEl = root.querySelector('div.item-name div.f-15, .item-name .f-15')
        const name = (nameEl?.textContent || '').trim()
        const descEl = root.querySelector('div.item-name div.f-12.description, .item-name .f-12, .item-name [class*="description"]')
        const description = (descEl?.textContent || '').trim()
        if (!name || name.length < 2 || name.length > 150 || seenNames.has(name.toLowerCase())) return
        let price = 0
        const priceOnSel = root.querySelector('[data-testid="price-on-selection"]')
        const currencyEl = root.querySelector('span.currency')
        if (currencyEl) {
          const m = (currencyEl.textContent || '').match(/[\d.]+/)
          price = m ? parseFloat(m[0]) : 0
        } else if (!priceOnSel) {
          const jodMatch = (root.textContent || '').match(/JOD\s*([\d.]+)|([\d.]+)\s*JOD/i)
          if (jodMatch) price = parseFloat(jodMatch[1] || jodMatch[2] || '0')
        }
        const imgEl = root.querySelector('img')
        const img = getImgUrl(imgEl as HTMLImageElement)
        seenNames.add(name.toLowerCase())
        result.products.push({
          titleAr: name,
          titleEn: name,
          descriptionAr: description || undefined,
          descriptionEn: description || undefined,
          priceJOD: price,
          imageUrl: img,
          categoryIndex: currentCatIndex,
        })
      }
      document.querySelectorAll('[data-testid="mobile-image"]').forEach((el) => {
        const card = el.closest('div[class*="clickable"], div[class*="sc-a31f9fb2"]')
        if (card) processCard(card)
      })
      document.querySelectorAll('div.item-name').forEach((itemNameEl) => {
        const card = itemNameEl.closest('div[class*="clickable"], div[class*="sc-a31f9fb2"]')
        if (card) processCard(card)
      })

      const addCandidates = document.querySelectorAll('button, [role="button"], a, [class*="add"], [class*="Add"]')
      const addButtons = Array.from(addCandidates).filter((el) => {
        const t = ((el.textContent || (el as HTMLElement).innerText) || '').trim()
        return t === 'Add' || t === 'إضافة' || t === 'آضف' || t.startsWith('Add') || /^add\s*$/i.test(t)
      })
      addButtons.forEach((btn) => {
        const card = btn.closest('article, [class*="card"], [class*="item"], [class*="product"], [class*="dish"], [class*="clickable"], div[class*="sc-a31f9fb2"], section > div, div[class*="menu"] > div')
        const root = card || btn.parentElement
        if (!root) return
        currentCatIndex = findCategoryForElement(root)
        const fullText = (root.textContent || '').trim()
        const jodMatch = fullText.match(/JOD\s*([\d.]+)|([\d.]+)\s*JOD/i)
        const price = jodMatch ? parseFloat(jodMatch[1] || jodMatch[2] || '0') : 0
        const nameEl = root.querySelector('[class*="name"], [class*="title"], h3, h4, [class*="Name"], .f-15')
        let name = (nameEl?.textContent || '').trim()
        const descEl = root.querySelector('.f-12.description, [class*="description"]')
        const description = (descEl?.textContent || '').trim()
        if (!name) {
          const beforeAdd = fullText.split(/Add|آضف|إضافة/i)[0]?.trim() || ''
          const beforePrice = beforeAdd.replace(/JOD\s*[\d.]+|[\d.]+\s*JOD|Price on Selection/gi, '').trim()
          const lines = beforePrice.split(/\n/).map((s) => s.trim()).filter((s) => s && s.length > 2 && s.length < 100)
          name = lines[lines.length - 1] || lines[0] || beforePrice.slice(0, 80)
        }
        if (!name || name.length < 2 || name.length > 150 || seenNames.has(name.toLowerCase())) return
        seenNames.add(name.toLowerCase())
        const imgEl = root.querySelector('img')
        const img = getImgUrl(imgEl as HTMLImageElement)
        result.products.push({
          titleAr: name,
          titleEn: name,
          descriptionAr: description || undefined,
          descriptionEn: description || undefined,
          priceJOD: price,
          imageUrl: img,
          categoryIndex: currentCatIndex,
        })
      })

      if (result.products.length === 0) {
        const itemSelectors = '[class*="menu-item"], [class*="product-card"], [class*="dish-card"], [class*="MenuItem"], [class*="ProductCard"], [class*="DishCard"], [data-testid*="product"], [data-testid*="dish"], .menu-item, article[class*="item"]'
        document.querySelectorAll(itemSelectors).forEach((el) => {
          currentCatIndex = findCategoryForElement(el)
          const text = (el.textContent || '').trim()
          const jodMatch = text.match(/JOD\s*([\d.]+)|([\d.]+)\s*JOD/i)
          const price = jodMatch ? parseFloat(jodMatch[1] || jodMatch[2] || '0') : 0
          const nameEl = el.querySelector('[class*="name"], [class*="title"], h3, h4')
          const name = (nameEl?.textContent || text.split(/JOD|Add/i)[0] || '').trim().slice(0, 100)
          if (name && name.length > 2 && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase())
            const imgEl = el.querySelector('img')
            const img = getImgUrl(imgEl as HTMLImageElement)
            result.products.push({ titleAr: name, titleEn: name, priceJOD: price, imageUrl: img, categoryIndex: currentCatIndex })
          }
        })
      }

      if (result.products.length === 0) {
        const candidates = document.querySelectorAll('[class*="menu"] *, [class*="category"] *, [class*="item"] *, [class*="product"] *, section div, article')
        candidates.forEach((el) => {
          currentCatIndex = findCategoryForElement(el)
          const text = (el.textContent || '').trim()
          if (!text.includes('JOD') || text.length > 800) return
          const jodMatch = text.match(/JOD\s*([\d.]+)|([\d.]+)\s*JOD/i)
          if (!jodMatch) return
          const price = parseFloat(jodMatch[1] || jodMatch[2] || '0')
          if (price <= 0) return
          const beforeJod = text.split(/JOD/i)[0]?.trim() || ''
          const lines = beforeJod.split(/\n/).map((s) => s.trim()).filter((s) => s && s.length > 2 && !/^\d+$/.test(s) && s.length < 80)
          const name = (lines.pop() || lines[0] || beforeJod.slice(0, 60)).replace(/Price on Selection/i, '').trim()
          if (name && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase())
            const imgEl = el.querySelector('img')
            result.products.push({ titleAr: name, titleEn: name, priceJOD: price, imageUrl: getImgUrl(imgEl as HTMLImageElement), categoryIndex: currentCatIndex })
          }
        })
      }

      if (result.products.length === 0) {
        const fullText = (document.body.innerText || document.body.textContent || '').trim()
        const lines = fullText.split('\n')
        let ci = 0
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          for (let j = 0; j < catHeaders.length; j++) {
            if (line.indexOf(catHeaders[j].title) >= 0 || line === catHeaders[j].title) { ci = j; break }
          }
          const jodMatch = line.match(/(?:JOD\s*([\d.]+)|([\d.]+)\s*JOD)/i)
          if (jodMatch) {
            const price = parseFloat(jodMatch[1] || jodMatch[2] || '0')
            if (price <= 0) continue
            let name = line.replace(/JOD\s*[\d.]+|[\d.]+\s*JOD|Price on Selection|Add|إضافة/gi, '').trim()
            if (!name && i > 0) name = lines[i - 1].trim()
            if (name && price > 0 && !seenNames.has(name.toLowerCase()) && !/^[\d.\s]+$/.test(name) && name.length > 2) {
              seenNames.add(name.toLowerCase())
              result.products.push({ titleAr: name, titleEn: name, priceJOD: price, imageUrl: undefined, categoryIndex: ci })
            }
          } else {
            const inlineMatch = line.match(/([^\n]{2,80})\s*(?:JOD\s*([\d.]+)|([\d.]+)\s*JOD)/i)
            if (inlineMatch) {
              const name = (inlineMatch[1] || '').replace(/Price on Selection|Add|إضافة/gi, '').trim()
              const price = parseFloat(inlineMatch[2] || inlineMatch[3] || '0')
              if (name && price > 0 && !seenNames.has(name.toLowerCase()) && !/^[\d.\s]+$/.test(name)) {
                seenNames.add(name.toLowerCase())
                result.products.push({ titleAr: name, titleEn: name, priceJOD: price, imageUrl: undefined, categoryIndex: ci })
              }
            }
          }
        }
        if (result.products.length === 0) {
          const jodRegex = /([^\n]{2,80})\s*(?:JOD\s*([\d.]+)|([\d.]+)\s*JOD)/gi
          let m
          while ((m = jodRegex.exec(fullText))) {
            const name = (m[1] || '').replace(/Price on Selection|Add|إضافة/gi, '').trim()
            const price = parseFloat(m[2] || m[3] || '0')
            if (name && price > 0 && !seenNames.has(name.toLowerCase()) && !/^[\d.\s]+$/.test(name)) {
              seenNames.add(name.toLowerCase())
              result.products.push({ titleAr: name, titleEn: name, priceJOD: price, imageUrl: undefined, categoryIndex: 0 })
            }
          }
        }
      }

      // If no categories from headers, create one
      if (result.categories.length === 0 && result.products.length > 0) {
        result.categories.push({ titleAr: 'قائمة الطعام', titleEn: 'Menu' })
      }
      return result
    }, { urlSlug, nameEnFromSlug })

    // Prefer JSON when it has products; otherwise use DOM. Override name from DOM when it looks like a real restaurant (short h1).
    const final: ScrapedRestaurant =
      fromJson && fromJson.products.length > 0
        ? fromJson
        : rawData

    if (rawData.nameAr && rawData.nameAr.length < 60 && !rawData.nameAr.includes('توصيل')) {
      final.nameAr = rawData.nameAr
      final.nameEn = rawData.nameEn
    }
    if (rawData.logoUrl) final.logoUrl = rawData.logoUrl
    if (rawData.specialties?.length && !final.specialties?.length) final.specialties = rawData.specialties

    // Switch to Arabic and scrape Arabic titles + descriptions (merge by product index)
    if (final.products.length > 0) {
      try {
        const arBtn = page.locator('a, button, [role="button"]').filter({ hasText: /\bAR\b|عربي|العربية/ }).first()
        if ((await arBtn.count()) > 0 && (await arBtn.isVisible())) {
          console.log('   Switching to Arabic to fetch Arabic titles and descriptions...')
          await arBtn.click({ timeout: 3000 })
          await page.waitForTimeout(3000)
          for (let i = 0; i < 25; i++) {
            await page.evaluate(() => window.scrollBy(0, 400))
            await page.waitForTimeout(INTERACTIVE_AUTH ? 500 : 400)
          }
          await page.evaluate(() => window.scrollTo(0, 0))
          await page.waitForTimeout(1500)
          const arData = await page.evaluate(() => {
            const items: { titleAr: string; descriptionAr: string }[] = []
            const seen = new Set<string>()
            document.querySelectorAll('[data-testid="mobile-image"]').forEach((el) => {
              const card = el.closest('div[class*="clickable"], div[class*="sc-a31f9fb2"]')
              if (!card || !card.querySelector('div.item-name')) return
              const nameEl = card.querySelector('div.item-name div.f-15, .item-name .f-15')
              const descEl = card.querySelector('div.item-name div.f-12.description, .item-name .f-12, .item-name [class*="description"]')
              const title = (nameEl?.textContent || '').trim()
              const desc = (descEl?.textContent || '').trim()
              if (title && title.length > 1 && !seen.has(title)) {
                seen.add(title)
                items.push({ titleAr: title, descriptionAr: desc })
              }
            })
            return items
          })
          for (let i = 0; i < final.products.length && i < arData.length; i++) {
            if (arData[i]?.titleAr) {
              final.products[i].titleAr = arData[i].titleAr
              if (arData[i].descriptionAr) final.products[i].descriptionAr = arData[i].descriptionAr
            }
          }
        }
      } catch (e) {
        console.log('   Could not fetch Arabic names:', (e as Error).message)
      }
    }

    // When URL was Arabic and we didn't switch, fetch English names from EN page (fallback)
    if (isArabicUrl && !switchedToEnglish && final.products.length > 0) {
      const enUrl = targetUrl.replace(/\/ar\//, '/')
      if (enUrl !== targetUrl) {
        try {
          console.log('   Fetching English names from', enUrl)
          await page.goto(enUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
          await page.waitForTimeout(4000)
          for (let i = 0; i < 15; i++) {
            await page.evaluate(() => window.scrollBy(0, 400))
            await page.waitForTimeout(400)
          }
          const enNames = await page.evaluate(() => {
            const names: string[] = []
            const fullText = (document.body.innerText || document.body.textContent || '').trim()
            const jodRegex = /([^\n]{2,80})\s*(?:JOD\s*[\d.]+|[\d.]+\s*JOD)/gi
            let m
            while ((m = jodRegex.exec(fullText))) {
              const part = (m[1] || '').replace(/JOD\s*[\d.]+|[\d.]+\s*JOD|Price on Selection|Add/gi, '').trim()
              if (part && part.length > 2 && !/^[\d.\s]+$/.test(part)) names.push(part)
            }
            return names
          })
          for (let i = 0; i < final.products.length && i < enNames.length; i++) {
            if (enNames[i] && enNames[i].length > 1) {
              final.products[i].titleEn = enNames[i]
            }
          }
        } catch (e) {
          console.log('   Could not fetch English names:', (e as Error).message)
        }
      }
    }

    await browser.close()
    return final
  } catch (e) {
    await browser.close()
    throw e
  }
}

async function uploadImage(client: { assets: { upload: (t: string, b: Buffer, o: { filename: string }) => Promise<{ _id: string }> } }, url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZonifyTalabatImporter/1.0)' } })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const ext = url.includes('.png') ? 'png' : url.includes('.webp') ? 'webp' : 'jpg'
    const asset = await client.assets.upload('image', buf, { filename: `talabat-${Date.now()}.${ext}` })
    return asset._id
  } catch {
    return null
  }
}

async function main() {
  if (!TALABAT_URL) {
    console.error('❌ Provide --url "https://www.talabat.com/ar/jordan/restaurant/..."')
    process.exit(1)
  }
  if (!TALABAT_URL.includes('talabat.com')) {
    console.error('❌ URL must be a Talabat restaurant page')
    process.exit(1)
  }

  const sanityToken = process.env.SANITY_API_TOKEN || process.env.SANITY_API
  if (!sanityToken) {
    console.error('❌ SANITY_API_TOKEN required in .env.local')
    process.exit(1)
  }
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || 'production'
  if (!projectId) {
    console.error('❌ NEXT_PUBLIC_SANITY_PROJECT_ID required')
    process.exit(1)
  }

  const clerkUser = await getClerkUserByEmail(OWNER_EMAIL)
  if (!clerkUser) {
    console.error(`❌ Clerk user not found for ${OWNER_EMAIL}. Ensure CLERK_SECRET_KEY is set.`)
    process.exit(1)
  }

  console.log('\n🚀 Talabat Importer')
  console.log(`   URL: ${TALABAT_URL}`)
  console.log(`   Owner: ${OWNER_EMAIL} (${clerkUser.id})`)
  console.log(`   Country: ${DEFAULT_COUNTRY}, City: ${DEFAULT_CITY}`)
  console.log(`   JOD→ILS rate: ${JOD_TO_ILS}\n`)

  const scraped = await scrapeTalabatPage(TALABAT_URL)
  console.log(`   Scraped: ${scraped.nameAr || scraped.nameEn}`)
  console.log(`   Categories: ${scraped.categories.length}, Products: ${scraped.products.length}`)
  if (scraped.products.length === 0) {
    console.log(`   ℹ️  Talabat loads menu dynamically; add products manually in the business dashboard if needed.`)
  }

  const writeClient = createClient({
    projectId,
    dataset,
    apiVersion,
    token: sanityToken,
    useCdn: false,
  }) as {
    fetch: (q: string, p?: Record<string, unknown>) => Promise<unknown>
    create: (doc: Record<string, unknown>) => Promise<{ _id: string }>
    patch: (id: string) => { set: (d: Record<string, unknown>) => { commit: () => Promise<unknown> } }
    assets: { upload: (t: string, b: Buffer, o: { filename: string }) => Promise<{ _id: string }> }
  }

  const canonicalSlug = getCanonicalSlugFromUrl(TALABAT_URL)
  const baseSlug = canonicalSlug || slugify(scraped.nameEn || scraped.nameAr || 'talabat-import')

  // Reuse existing tenant with same canonical slug (create 1 business only)
  let existingTenant = await writeClient.fetch<{ _id: string; slug: { current?: string } } | null>(
    `*[_type == "tenant" && slug.current == $slug][0]{ _id, slug }`,
    { slug: baseSlug }
  )
  if (!existingTenant) {
    existingTenant = await writeClient.fetch<{ _id: string; slug: { current?: string } } | null>(
      `*[_type == "tenant" && slug.current match $pattern][0]{ _id, slug }`,
      { pattern: `${baseSlug}*` }
    )
  }

  let tenantId: string
  let slug: string

  if (existingTenant) {
    tenantId = existingTenant._id
    slug = existingTenant.slug?.current || baseSlug
    console.log(`   Reusing existing business: /t/${slug}`)
  } else {
    slug = await ensureUniqueSlug(baseSlug, async (s) => {
      const ex = await writeClient.fetch<{ _id: string } | null>(
        `*[_type == "tenant" && slug.current == $slug][0]{ _id }`,
        { slug: s }
      )
      return !!ex
    })

    let logoAssetId: string | null = null
    if (scraped.logoUrl) {
      logoAssetId = await uploadImage(writeClient, scraped.logoUrl)
      if (logoAssetId) console.log('   Logo uploaded')
    }

    const createdAt = new Date().toISOString()
    const subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const tenantDoc = await writeClient.create({
    _type: 'tenant',
    slug: { _type: 'slug', current: slug },
    name: scraped.nameEn || scraped.nameAr,
    name_ar: scraped.nameAr || scraped.nameEn,
    businessType: 'restaurant',
    country: DEFAULT_COUNTRY,
    city: DEFAULT_CITY,
    clerkUserId: clerkUser.id,
    clerkUserEmail: OWNER_EMAIL.toLowerCase(),
    subscriptionStatus: 'trial',
    subscriptionPlan: 'ultra',
    createdAt,
    subscriptionExpiresAt,
    supportsReceiveInPerson: true,
    supportsDelivery: true,
    ...(logoAssetId ? { businessLogo: { _type: 'image', asset: { _type: 'reference', _ref: logoAssetId } } } : {}),
  })
    tenantId = tenantDoc._id
    console.log(`   ✅ Tenant created: /t/${slug}`)
  }

  // Get or create categories
  const categoryIds: string[] = []
  const existingCats = await writeClient.fetch<{ _id: string; slug: { current?: string } }[]>(
    `*[_type == "category" && site._ref == $siteId]{ _id, "slug": slug.current }`,
    { siteId: tenantId }
  )
  const existingCatSlugs = new Set((existingCats || []).map((c) => c.slug).filter(Boolean))

  for (let i = 0; i < scraped.categories.length; i++) {
    const cat = scraped.categories[i]
    const baseCatSlug = slugify(cat.titleEn || cat.titleAr || `cat-${i}`)
    const catSlug = await ensureUniqueSlug(baseCatSlug, async (s) => {
      if (existingCatSlugs.has(s)) return true
      const existing = await writeClient.fetch<{ _id: string } | null>(
        `*[_type == "category" && site._ref == $siteId && slug.current == $slug][0]{ _id }`,
        { siteId: tenantId, slug: s }
      )
      return !!existing
    })
    let catId = (existingCats || []).find((c) => c.slug === catSlug)?._id
    if (!catId) {
      const catDoc = await writeClient.create({
        _type: 'category',
        site: { _type: 'reference', _ref: tenantId },
        title_en: cat.titleEn || cat.titleAr,
        title_ar: cat.titleAr || cat.titleEn,
        slug: { _type: 'slug', current: catSlug },
        sortOrder: i,
      })
      catId = catDoc._id
      existingCatSlugs.add(catSlug)
    }
    categoryIds.push(catId)
  }
  if (scraped.categories.length === 0 && scraped.products.length > 0) {
    const menuCat = (existingCats || []).find((c) => c.slug === 'menu' || c.slug?.includes('menu'))
    if (menuCat) {
      categoryIds.push(menuCat._id)
    } else {
      const catDoc = await writeClient.create({
        _type: 'category',
        site: { _type: 'reference', _ref: tenantId },
        title_en: 'Menu',
        title_ar: 'قائمة الطعام',
        slug: { _type: 'slug', current: 'menu' },
        sortOrder: 0,
      })
      categoryIds.push(catDoc._id)
    }
  }
  console.log(`   ✅ ${categoryIds.length} categories`)

  // Get existing product titles when reusing (to avoid duplicates)
  const existingProducts = await writeClient.fetch<{ title_en?: string }[]>(
    `*[_type == "product" && site._ref == $siteId]{ title_en }`,
    { siteId: tenantId }
  )
  const existingTitles = new Set(
    (existingProducts || []).map((p) => (p.title_en || '').toLowerCase().trim()).filter(Boolean)
  )

  let created = 0
  for (const prod of scraped.products) {
    const catId = categoryIds[prod.categoryIndex] || categoryIds[0]
    if (!catId) continue
    const titleKey = (prod.titleEn || prod.titleAr || '').toLowerCase().trim()
    if (titleKey && existingTitles.has(titleKey)) continue
    if (titleKey) existingTitles.add(titleKey)

    let imageRef: string | null = null
    if (prod.imageUrl) {
      imageRef = await uploadImage(writeClient, prod.imageUrl)
    }
    const priceILS = toILS(prod.priceJOD)
    const titleEn = toTitleCase((prod.titleEn || prod.titleAr || '').trim())
    const titleAr = (prod.titleAr || prod.titleEn || '').trim()
    const descEn = (prod.descriptionEn || '').trim() || undefined
    const descAr = (prod.descriptionAr || '').trim() || undefined
    await writeClient.create({
      _type: 'product',
      site: { _type: 'reference', _ref: tenantId },
      category: { _type: 'reference', _ref: catId },
      title_en: titleEn,
      title_ar: titleAr,
      ...(descEn ? { description_en: descEn } : {}),
      ...(descAr ? { description_ar: descAr } : {}),
      price: priceILS,
      isAvailable: true,
      sortOrder: created,
      ...(imageRef ? { image: { _type: 'image', asset: { _type: 'reference', _ref: imageRef } } } : {}),
    })
    created++
    if (created % 10 === 0) process.stdout.write(`   Products: ${created}\n`)
  }
  console.log(`   ✅ ${created} products created`)

  console.log(`\n✅ Done! Business: /t/${slug}`)
  console.log(`   Dashboard: /t/${slug}/manage`)
  console.log(`   Orders: /t/${slug}/orders\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

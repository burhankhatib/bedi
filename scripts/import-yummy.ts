/**
 * Yummy.ps Restaurant Importer
 *
 * Scrapes product data from www.yummy.ps restaurant pages (e.g. Domino's Pizza)
 * and creates a full business (tenant) with categories and products.
 *
 * Yummy.ps uses ILS (₪) natively — no currency conversion.
 *
 * Data is scraped only from within #vue-merchant-menu.
 *
 * HTML structure (from list-item-rows inside #vue-merchant-menu):
 *   - .item-image-preview img → image
 *   - h6.m-0 → product title (en/ar)
 *   - p.ellipsis-2-lines → description (often empty in list view)
 *   - p.bold.m-0.prices span → price (format: <del>₪129.10</del> ₪129.00)
 *   - .xget-item-details → Add to cart (may open modal for details)
 *
 * Usage:
 *   npx tsx scripts/import-yummy.ts --url "https://www.yummy.ps/dominoz-pizza-r"
 *   npx tsx scripts/import-yummy.ts --url "https://www.yummy.ps/dominoz-pizza-r" --owner-email you@example.com
 *   npm run import:yummy -- --url "https://www.yummy.ps/dominoz-pizza-r"
 *
 * Requires:
 *   - SANITY_API_TOKEN in .env.local (with write access)
 *   - CLERK_SECRET_KEY in .env.local (to resolve owner by email)
 *   - Playwright: npx playwright install chromium
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

const DEFAULT_OWNER_EMAIL = 'burhank@gmail.com'
const DEFAULT_COUNTRY = 'Palestine'
const DEFAULT_CITY = 'Ramallah'

function getArg(name: string): string | null {
  const i = process.argv.indexOf(name)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1].trim()
  return null
}

const YUMMY_URL = (getArg('--url') || getArg('-u') || '').trim()
const OWNER_EMAIL = getArg('--owner-email') || DEFAULT_OWNER_EMAIL
const INTERACTIVE_AUTH = process.argv.includes('--interactive-auth')
const YUMMY_HEADLESS = process.env.YUMMY_HEADLESS !== 'false'

type ScrapedCategory = { titleAr: string; titleEn: string }
type ScrapedProduct = {
  productPage?: string
  titleAr: string
  titleEn: string
  descriptionAr?: string
  descriptionEn?: string
  price: number
  imageUrl?: string
  categoryIndex: number
  categoryName?: string
}

type ScrapedRestaurant = {
  nameAr: string
  nameEn: string
  logoUrl?: string
  baseUrl: string
  categories: ScrapedCategory[]
  products: ScrapedProduct[]
}

function getCanonicalSlugFromUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://www.yummy.ps${url.startsWith('/') ? '' : '/'}${url}`)
    const pathParts = parsed.pathname.replace(/^\//, '').split('/').filter(Boolean)
    return pathParts[0] || 'yummy-import'
  } catch {
    return 'yummy-import'
  }
}

async function scrapeYummyPage(url: string): Promise<ScrapedRestaurant> {
  const browser = await chromium.launch({
    headless: YUMMY_HEADLESS,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'ar-PS',
  })
  const page = await context.newPage()

  const capturedJson: string[] = []
  page.on('response', async (res) => {
    try {
      const u = res.url()
      if (res.request().resourceType() === 'xhr' || res.request().resourceType() === 'fetch') {
        if (u.includes('yummy.ps') && (u.includes('menu') || u.includes('product') || u.includes('item') || u.includes('merchant'))) {
          const ct = res.headers()['content-type'] || ''
          if (ct.includes('json')) {
            const body = await res.text()
            if (body && body.length > 50) capturedJson.push(body)
          }
        }
      }
    } catch { /* ignore */ }
  })

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://www.yummy.ps${url.startsWith('/') ? '' : '/'}${url}`)
    const baseUrl = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`
    const targetUrl = `${baseUrl}${parsed.search || '?language=ar'}`.replace(/\?$/, '')

    console.log('   Navigating to', targetUrl)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(INTERACTIVE_AUTH ? 4000 : 5000)

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

    // Scroll to load lazy content
    for (let i = 0; i < 40; i++) {
      await page.evaluate(() => window.scrollBy(0, 400))
      await page.waitForTimeout(INTERACTIVE_AUTH ? 600 : 400)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(2000)

    // Scope to vue-merchant-menu only
    await page.waitForSelector('#vue-merchant-menu', { timeout: 15000 }).catch(() => {})
    await page.waitForSelector('.list-item-rows, [class*="list-item"], [class*="item-rows"]', { timeout: 15000 }).catch(() => {})

    const rawData = await page.evaluate((opts: { baseUrl: string }) => {
      const result: ScrapedRestaurant = {
        nameAr: '',
        nameEn: '',
        baseUrl: opts.baseUrl,
        categories: [],
        products: [],
      }

      const menuRoot = document.getElementById('vue-merchant-menu')
      if (!menuRoot) return result

      const getImgUrl = (img: HTMLImageElement | null): string | undefined => {
        if (!img) return undefined
        const src = img.src || img.getAttribute('src') || img.getAttribute('data-src')
        if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('1x1')) return src
        return undefined
      }

      // Restaurant name from h1/h2 within menu or page title
      const h1 = menuRoot.querySelector('h1, h2')?.textContent?.trim()
      const titleStr = document.title || ''
      const fromTitle = titleStr.split('|')[0]?.trim() || titleStr.split('-')[0]?.trim()
      result.nameAr = h1 || fromTitle || 'Restaurant'
      result.nameEn = result.nameAr

      // Logo (within menu scope)
      const logoImg = menuRoot.querySelector('img[alt*="logo"], img[alt*="Logo"], header img, [class*="merchant"] img')
      if (logoImg instanceof HTMLImageElement && logoImg.src) {
        result.logoUrl = getImgUrl(logoImg) || undefined
      }

      // Category headers: section titles above product lists (within menu)
      const catHeaders: { title: string; index: number }[] = []
      menuRoot.querySelectorAll('[class*="category-title"], [class*="section-title"], [class*="menu-category"], h4, h5, [class*="Category"]').forEach((el) => {
        const title = (el.textContent || '').trim()
        if (title && title.length > 1 && title.length < 80 && !/^\d+$/.test(title)) {
          catHeaders.push({ title, index: catHeaders.length })
        }
      })

      const findCategoryForElement = (el: Element): number => {
        let n = el as Element | null
        while (n && menuRoot.contains(n)) {
          let prev: Element | null = n.previousElementSibling
          while (prev && menuRoot.contains(prev)) {
            const t = (prev.textContent || '').trim()
            for (let j = 0; j < catHeaders.length; j++) {
              if (t === catHeaders[j].title || t.indexOf(catHeaders[j].title) >= 0) return j
            }
            prev = prev.previousElementSibling
          }
          n = n.parentElement
        }
        return 0
      }

      const seenTitles = new Set<string>()

      // Primary: .list-item-rows (Yummy.ps structure from user sample) — scoped to #vue-merchant-menu
      const listItems = menuRoot.querySelectorAll('.list-item-rows, [class*="list-item-rows"]')
      listItems.forEach((row) => {
        const catIdx = findCategoryForElement(row)

        const titleEl = row.querySelector('h6, h5, h4, [class*="item-name"], [class*="product-name"], [class*="title"]')
        const title = (titleEl?.textContent || '').trim()
        if (!title || title.length < 2 || title.length > 200 || seenTitles.has(title.toLowerCase())) return

        const descEl = row.querySelector('p.ellipsis-2-lines, [class*="description"], [class*="ellipsis"]')
        const description = (descEl?.textContent || '').trim()

        let price = 0
        const pricesEl = row.querySelector('p.prices, [class*="prices"], [class*="price"]')
        if (pricesEl) {
          const spans = pricesEl.querySelectorAll('span')
          for (const span of Array.from(spans)) {
            const text = span.textContent || ''
            const match = text.match(/₪\s*([\d.]+)|([\d.]+)\s*₪/)
            if (match) {
              const p = parseFloat(match[1] || match[2] || '0')
              if (p > 0) { price = p; break }
            }
          }
          if (!price) {
            const m = (pricesEl.textContent || '').match(/₪\s*([\d.]+)|([\d.]+)\s*₪/)
            if (m) price = parseFloat(m[1] || m[2] || '0')
          }
        }
        if (!price) {
          const m = (row.textContent || '').match(/₪\s*([\d.]+)|([\d.]+)\s*₪/)
          if (m) price = parseFloat(m[1] || m[2] || '0')
        }

        const imgEl = row.querySelector('img')
        const img = getImgUrl(imgEl as HTMLImageElement)

        let productPage: string | undefined
        const link = row.querySelector('a[href]') as HTMLAnchorElement | null
        if (link && link.href && !link.href.startsWith('javascript:')) {
          productPage = link.href
        }
        const rowWithData = row.closest('[data-id], [data-product-id], [data-item-id]')
        if (!productPage && rowWithData) {
          const id = rowWithData.getAttribute('data-id') || rowWithData.getAttribute('data-product-id') || rowWithData.getAttribute('data-item-id')
          if (id) productPage = `${opts.baseUrl}/item/${id}`
        }

        seenTitles.add(title.toLowerCase())
        result.products.push({
          productPage,
          titleAr: title,
          titleEn: title,
          descriptionAr: description || undefined,
          descriptionEn: description || undefined,
          price,
          imageUrl: img,
          categoryIndex: catIdx,
          categoryName: catHeaders[catIdx]?.title,
        })
      })

      // Build categories from headers
      catHeaders.forEach((h) => {
        result.categories.push({ titleAr: h.title, titleEn: h.title })
      })

      if (result.products.length === 0) {
        const itemSelectors = '[class*="item"], [class*="product"], [class*="list-item"]'
        menuRoot.querySelectorAll(itemSelectors).forEach((el) => {
          const titleEl = el.querySelector('h6, h5, h4, [class*="name"], [class*="title"]')
          const title = (titleEl?.textContent || '').trim()
          if (!title || title.length < 2 || seenTitles.has(title.toLowerCase())) return

          const m = (el.textContent || '').match(/₪\s*([\d.]+)|([\d.]+)\s*₪/)
          const price = m ? parseFloat(m[1] || m[2] || '0') : 0
          if (price <= 0) return

          const imgEl = el.querySelector('img')
          seenTitles.add(title.toLowerCase())
          result.products.push({
            titleAr: title,
            titleEn: title,
            price,
            imageUrl: getImgUrl(imgEl as HTMLImageElement),
            categoryIndex: 0,
          })
        })
      }

      if (result.categories.length === 0 && result.products.length > 0) {
        result.categories.push({ titleAr: 'قائمة الطعام', titleEn: 'Menu' })
      }

      return result
    }, { baseUrl })

    // Try to get English titles by switching language
    if (rawData.products.length > 0) {
      try {
        const enUrl = targetUrl.includes('?') ? targetUrl.replace(/language=ar/, 'language=en') : `${targetUrl}?language=en`
        if (enUrl !== targetUrl) {
          console.log('   Fetching English version...')
          await page.goto(enUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
          await page.waitForTimeout(3000)
          await page.waitForSelector('#vue-merchant-menu', { timeout: 10000 }).catch(() => {})
          for (let i = 0; i < 25; i++) {
            await page.evaluate(() => window.scrollBy(0, 400))
            await page.waitForTimeout(400)
          }
          await page.evaluate(() => window.scrollTo(0, 0))
          await page.waitForTimeout(1500)

          const enProducts = await page.evaluate(() => {
            const items: { titleEn: string; descriptionEn: string }[] = []
            const menuRoot = document.getElementById('vue-merchant-menu')
            if (!menuRoot) return items
            menuRoot.querySelectorAll('.list-item-rows, [class*="list-item-rows"]').forEach((row) => {
              const titleEl = row.querySelector('h6, h5, h4, [class*="item-name"], [class*="product-name"]')
              const descEl = row.querySelector('p.ellipsis-2-lines, [class*="description"]')
              const title = (titleEl?.textContent || '').trim()
              const desc = (descEl?.textContent || '').trim()
              if (title) items.push({ titleEn: title, descriptionEn: desc })
            })
            return items
          })

          for (let i = 0; i < rawData.products.length && i < enProducts.length; i++) {
            if (enProducts[i]?.titleEn) {
              rawData.products[i].titleEn = enProducts[i].titleEn
              if (enProducts[i].descriptionEn) {
                rawData.products[i].descriptionEn = enProducts[i].descriptionEn
                rawData.products[i].descriptionAr = rawData.products[i].descriptionAr || rawData.products[i].descriptionEn
              }
            }
          }
        }
      } catch (e) {
        console.log('   Could not fetch English names:', (e as Error).message)
      }
    }

    await browser.close()
    return rawData
  } catch (e) {
    await browser.close()
    throw e
  }
}

async function uploadImage(
  client: { assets: { upload: (t: string, b: Buffer, o: { filename: string }) => Promise<{ _id: string }> } },
  url: string
): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZonifyYummyImporter/1.0)' } })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const ext = url.includes('.png') ? 'png' : url.includes('.webp') ? 'webp' : 'jpg'
    const asset = await client.assets.upload('image', buf, { filename: `yummy-${Date.now()}.${ext}` })
    return asset._id
  } catch {
    return null
  }
}

async function main() {
  if (!YUMMY_URL) {
    console.error('❌ Provide --url "https://www.yummy.ps/dominoz-pizza-r"')
    process.exit(1)
  }
  if (!YUMMY_URL.includes('yummy.ps')) {
    console.error('❌ URL must be a Yummy.ps restaurant page')
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

  console.log('\n🚀 Yummy.ps Importer')
  console.log(`   URL: ${YUMMY_URL}`)
  console.log(`   Owner: ${OWNER_EMAIL} (${clerkUser.id})`)
  console.log(`   Country: ${DEFAULT_COUNTRY}, City: ${DEFAULT_CITY}\n`)

  const scraped = await scrapeYummyPage(YUMMY_URL)
  console.log(`   Scraped: ${scraped.nameAr || scraped.nameEn}`)
  console.log(`   Categories: ${scraped.categories.length}, Products: ${scraped.products.length}`)

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

  const canonicalSlug = getCanonicalSlugFromUrl(YUMMY_URL)
  const baseSlug = canonicalSlug || slugify(scraped.nameEn || scraped.nameAr || 'yummy-import')

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

    const titleEn = (prod.titleEn || prod.titleAr || '').trim()
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
      price: prod.price,
      isAvailable: true,
      sortOrder: created,
      ...(prod.productPage ? { sourceUrl: prod.productPage } : {}),
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

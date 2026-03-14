/**
 * Baladi Supermarket Catalog Importer
 *
 * Scrapes product data from https://www.baladisupermarket.com/ and imports
 * into Sanity as masterCatalogProduct documents.
 *
 * Product images: img.image with ng-src/src (CloudFront).
 *
 * Usage:
 *   npx tsx scripts/import-baladi.ts                           # Scrape + import
 *   npm run import:baladi:cat -- 95818                         # Short: category ID only (default: grocery)
 *   npm run import:baladi:cat -- 95818 retail                  # Category ID + market category
 *   npm run import:baladi:url -- --url "..." --market-category grocery  # Full URL
 *   npx tsx scripts/import-baladi.ts --backfill-existing --interactive-auth        # Update/skip-ready (200/session)
 *   npx tsx scripts/import-baladi.ts --backfill-existing --interactive-auth --overwrite-all --reset-checkpoint  # One-time overwrite all
 *
 * Requires: SANITY_API_TOKEN in .env.local (with write access)
 * Install Playwright: npx playwright install chromium
 */

import { chromium, type BrowserContext, type Page } from 'playwright'
import path from 'path'
import { config } from 'dotenv'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

// Load .env.local
config({ path: path.join(process.cwd(), '.env.local') })

const MAX_PRODUCTS_PER_RUN = parseInt(process.env.BALADI_MAX_PRODUCTS || '50', 10)
const BASE_URL = 'https://www.baladisupermarket.com'
const BALADI_HEADLESS = process.env.BALADI_HEADLESS !== 'false'
const BALADI_CF_CLEARANCE = (process.env.BALADI_CF_CLEARANCE || '').trim()
const INTERACTIVE_AUTH = process.argv.includes('--interactive-auth')
const RESET_CHECKPOINT = process.argv.includes('--reset-checkpoint')
const OVERWRITE_ALL = process.argv.includes('--overwrite-all')

/** Interactive sessions use 200 per run; otherwise use env/default. */
const EFFECTIVE_LIMIT = INTERACTIVE_AUTH ? Math.max(MAX_PRODUCTS_PER_RUN, 200) : MAX_PRODUCTS_PER_RUN
const CHECKPOINT_PATH = path.join(process.cwd(), '.tmp', 'baladi-backfill-checkpoint.json')

type BackfillCheckpoint = {
  projectId: string
  dataset: string
  lastProcessedIndex: number
  updatedTotal: number
  skippedTotal: number
  failedTotal: number
  updatedAt: string
}

/**
 * Baladi category URLs to scrape (manually provided).
 * Maps to our market categories: grocery, bakery, retail.
 */
const BALADI_CATEGORIES: Array<{ name: string; url: string; marketCategory: string }> = [
  { name: 'Dairy & Eggs', url: `${BASE_URL}/categories/95010/products`, marketCategory: 'grocery' },
  { name: 'Deli & Salads', url: `${BASE_URL}/categories/79606/products`, marketCategory: 'grocery' },
  { name: 'Energy Bars', url: `${BASE_URL}/categories/95814/products`, marketCategory: 'grocery' },
  { name: 'Pets Food & Accessories', url: `${BASE_URL}/categories/120233/products`, marketCategory: 'retail' },
  { name: 'Candy & Sweets', url: `${BASE_URL}/categories/79655/products`, marketCategory: 'grocery' },
  { name: 'Frozen', url: `${BASE_URL}/categories/95817/products`, marketCategory: 'grocery' },
  { name: 'Bakery', url: `${BASE_URL}/categories/79698/products`, marketCategory: 'bakery' },
  { name: 'Beauty & Baby', url: `${BASE_URL}/categories/79577/products`, marketCategory: 'retail' },
  { name: 'Fresh Fruits', url: `${BASE_URL}/categories/79709/products`, marketCategory: 'grocery' },
  { name: 'Fresh Vegetables', url: `${BASE_URL}/categories/79706/products`, marketCategory: 'grocery' },
  { name: 'Fresh Meat', url: `${BASE_URL}/categories/79823/products`, marketCategory: 'grocery' },
  { name: 'Chicken & Turkey', url: `${BASE_URL}/categories/79822/products`, marketCategory: 'grocery' },
  { name: 'Cleaning', url: `${BASE_URL}/categories/79742/products`, marketCategory: 'retail' },
  { name: 'Grocery', url: `${BASE_URL}/categories/79632/products`, marketCategory: 'grocery' },
]

/** Known market category values (if last positional matches, it's market not a category ID) */
const MARKET_WORDS = new Set(['grocery', 'bakery', 'retail', 'pharmacy', 'restaurant', 'cafe', 'other'])

/** Positional args: exclude flags, node path, and script/tsx path (often argv[0], argv[1]) */
const POSITIONAL = process.argv.slice(2).filter((a) => !a.startsWith('--'))

/** --category-ids 95818,95010,95817 or comma-separated */
const CATEGORY_IDS_ARG = (() => {
  const i = process.argv.indexOf('--category-ids')
  if (i >= 0 && process.argv[i + 1]) {
    return process.argv[i + 1]
      .split(/[,\s]+/)
      .map((s) => s.replace(/\D/g, ''))
      .filter(Boolean)
  }
  return null
})()

/** Category IDs from positional: all numeric except last if it's a market word */
const POSITIONAL_IDS = (() => {
  if (CATEGORY_IDS_ARG) return CATEGORY_IDS_ARG
  if (POSITIONAL.length === 0) return []
  const last = POSITIONAL[POSITIONAL.length - 1]?.toLowerCase()
  const ids = MARKET_WORDS.has(last ?? '')
    ? POSITIONAL.slice(0, -1)
    : POSITIONAL
  return ids.map((s) => s.replace(/\D/g, '')).filter(Boolean)
})()

/** When set via --url, only scrape this URL. Use with --market-category. */
const MANUAL_URL = (() => {
  const i = process.argv.indexOf('--url')
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1].trim()
  /** Shortcut: first category ID → single URL */
  const catId = POSITIONAL_IDS[0]
  if (catId) return `${BASE_URL}/categories/${catId}/products`
  return null
})()

/** Multiple category IDs to process (for --category-ids or multiple positionals) */
const MANUAL_CATEGORY_IDS =
  POSITIONAL_IDS.length > 1
    ? POSITIONAL_IDS
    : CATEGORY_IDS_ARG && CATEGORY_IDS_ARG.length > 1
      ? CATEGORY_IDS_ARG
      : null

/** When set via --market-category or last positional, override category for all products from MANUAL_URL. */
const MANUAL_MARKET_CATEGORY = (() => {
  const i = process.argv.indexOf('--market-category')
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1].trim()
  if (POSITIONAL.length > 0) {
    const last = POSITIONAL[POSITIONAL.length - 1]?.toLowerCase()
    if (MARKET_WORDS.has(last ?? '')) return last ?? null
  }
  return null
})()

const CATEGORY_URLS = MANUAL_CATEGORY_IDS?.length
  ? MANUAL_CATEGORY_IDS.map((id) => `${BASE_URL}/categories/${id}/products`)
  : MANUAL_URL
    ? [MANUAL_URL.startsWith('http') ? MANUAL_URL : `${BASE_URL}${MANUAL_URL.startsWith('/') ? '' : '/'}${MANUAL_URL}`]
    : [BASE_URL, ...BALADI_CATEGORIES.map((c) => c.url)]
const SCRAPE_POOL_LIMIT = Math.max(EFFECTIVE_LIMIT * 6, 150)

/** Baladi category ID → our market category (grocery, bakery, retail, pharmacy). */
const CATEGORY_ID_MAP: Record<string, string> = Object.fromEntries(
  BALADI_CATEGORIES.map((c) => {
    const id = c.url.match(/\/categories\/(\d+)/)?.[1]
    return id ? [id, c.marketCategory] : []
  }).filter((e): e is [string, string] => e.length === 2)
)

const CATEGORY_MAP: Record<string, string> = {
  ...CATEGORY_ID_MAP,
  grocery: 'grocery',
  supermarket: 'grocery',
  'grocery-market': 'grocery',
  fruits: 'grocery',
  vegetables: 'grocery',
  dairy: 'grocery',
  beverages: 'grocery',
  bakery: 'bakery',
  'bakery-bread': 'bakery',
  retail: 'retail',
  pharmacy: 'pharmacy',
  default: 'grocery',
}

type ScrapedProduct = {
  nameAr: string
  nameEn: string
  price?: string
  imageUrl: string
  category: string
  brand?: string
  unitText?: string
  productUrl?: string
}

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .slice(0, 80)
}

/** Core word for matching (e.g. "apples" from "Gala Apples" or "Apples Loose"). */
function coreName(s: string): string {
  return normalizeKey(s)
    .replace(/\b(loose|organic|fresh|gala|red|green|large|medium|small|per\s*kg|kg)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
}

/** Find best scraped match for our product name. Uses exact, then partial (contains). */
function findBestScrapedMatch(
  ourNameEn: string,
  ourNameAr: string,
  byName: Map<string, ScrapedProduct>
): ScrapedProduct | null {
  const kEn = normalizeKey(ourNameEn)
  const kAr = normalizeKey(ourNameAr)
  const coreEn = coreName(ourNameEn)
  const coreAr = coreName(ourNameAr)
  if (!kEn && !kAr) return null
  const exact = byName.get(kEn) || byName.get(kAr)
  if (exact) return exact
  for (const [scrapedKey, scraped] of byName) {
    if (!scraped?.imageUrl) continue
    const ourCores = [coreEn, coreAr].filter((c) => c.length >= 3)
    const scrapedCore = coreName(scraped.nameEn || scraped.nameAr)
    for (const our of ourCores) {
      if (!our) continue
      if (scrapedKey.includes(our) || scrapedCore.includes(our)) return scraped
      if (our.includes(scrapedCore) && scrapedCore.length >= 3) return scraped
    }
  }
  return null
}

/** Infer unitType from product name, price, or unit text. */
function inferUnitType(name: string, price: string, unitText: string): 'kg' | 'piece' | 'pack' {
  const combined = `${name} ${price} ${unitText}`.toLowerCase()
  if (/(^|\s)(kg|ק"ג|קילו|kilo|per\s*kg)($|\s)/i.test(combined) || /למשקל|per\s*kg/i.test(combined)) return 'kg'
  if (/(^|\s)(pack|חבילה|חבילת|מארז|מארזים|pack of)($|\s)/i.test(combined)) return 'pack'
  return 'piece'
}

function resolveImageUrl(url: string): string {
  if (!url || !url.trim()) return ''
  const u = url.trim()
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  if (u.startsWith('//')) return `https:${u}`
  return new URL(u, BASE_URL).href
}

/** Product images come from CloudFront. Prefer/require cloudfront.net for correct product images. */
function isCloudfrontImage(url: string): boolean {
  return /cloudfront\.net/i.test(url)
}

/** Extract product image URL. Only accepts CloudFront (correct product images). */
function pickProductImageUrl(candidates: string[]): string {
  const resolved = candidates.map(resolveImageUrl).filter(Boolean)
  return resolved.find(isCloudfrontImage) || ''
}

/** Get image URL from img element. Baladi uses Angular ng-src; also check src, data-src, etc. */
async function getImgUrl(el: { getAttribute: (name: string) => Promise<string | null> } | null): Promise<string> {
  if (!el) return ''
  const attrs = ['ng-src', 'src', 'data-src', 'data-lazy-src', 'data-original']
  for (const a of attrs) {
    const v = await el.getAttribute(a)
    if (v?.trim()) return v.trim()
  }
  const srcset = await el.getAttribute('data-srcset')
  if (srcset) return srcset.split(' ')[0]?.trim() || ''
  return ''
}

/** Scroll page to trigger lazy-loaded content (infinite scroll). Repeat until no new products load. */
async function scrollToLoadAllProducts(page: Page, maxScrolls = 40): Promise<void> {
  let lastCount = 0
  let sameCountRuns = 0
  for (let i = 0; i < maxScrolls; i++) {
    const count = await page.$$eval('sp-product', (els) => els.length).catch(() => 0)
    if (count > lastCount) {
      lastCount = count
      sameCountRuns = 0
    } else {
      sameCountRuns++
      if (sameCountRuns >= 3) break // No new products for 3 scrolls, we're done
    }
    // Scroll to bottom to trigger lazy load
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await new Promise((r) => setTimeout(r, 2000))
  }
}

async function extractSpProductsFromPage(page: Page, targetUrl: string): Promise<ScrapedProduct[]> {
  const rows = await page.$$eval('sp-product', (nodes) => {
    return nodes.map((node) => {
      const root = node as HTMLElement
      const nameEl = root.querySelector('.name') as HTMLElement | null
      const name = (nameEl?.getAttribute('title') || nameEl?.textContent || '').trim()
      const price = ((root.querySelector('.price') as HTMLElement | null)?.textContent || '').trim()
      const metaImage = (root.querySelector('meta[itemprop="image"]') as HTMLMetaElement | null)?.content?.trim() || ''
      const img = root.querySelector('img.image') as HTMLImageElement | null
      const imageUrl =
        metaImage ||
        img?.getAttribute('ng-src') ||
        img?.getAttribute('src') ||
        img?.src ||
        img?.getAttribute('data-src') ||
        img?.getAttribute('data-lazy-src') ||
        img?.getAttribute('data-original') ||
        ''
      const productUrl =
        (root.querySelector('a[href*="/products/"], a[href*="/product"]') as HTMLAnchorElement | null)?.href?.trim() || ''

      return {
        name,
        price,
        imageUrl: (imageUrl || '').trim(),
        productUrl,
      }
    }).filter((x) => !!x.name)
  }).catch(() => [] as Array<{ name: string; price: string; imageUrl: string; productUrl: string }>)

  return rows.map((r) => ({
    nameAr: r.name,
    nameEn: r.name,
    price: r.price,
    imageUrl: pickProductImageUrl([r.imageUrl]),
    category: getCategoryFromUrl(targetUrl),
    productUrl: r.productUrl || undefined,
  }))
}

async function discoverCategoryProductUrls(page: Page): Promise<string[]> {
  const selectors = [
    'a[href*="/categories/"][href*="/products"]',
    'a[href*="/categories/"]',
    'a[href*="/department/"]',
    'a[href*="/catalog/"]',
    'a[href*="/category/"]',
    'nav a[href*="baladisupermarket"]',
    'footer a[href*="baladisupermarket"]',
    '[class*="category"] a[href]',
    '[class*="menu"] a[href]',
  ]
  const seen = new Set<string>()
  for (const sel of selectors) {
    const links = await page.$$eval(sel, (els) =>
      els
        .map((e) => (e as HTMLAnchorElement).href || e.getAttribute('href') || '')
        .map((s) => s.trim())
        .filter((s) => s && s.includes('baladisupermarket'))
    ).catch(() => [] as string[])
    for (const href of links) {
      const u = resolveImageUrl(href)
      if (u && !seen.has(u)) seen.add(u)
    }
  }
  return Array.from(seen)
}

function extractProductsFromHtml(html: string, targetUrl: string): ScrapedProduct[] {
  const blocks = html.match(/<sp-product[\s\S]*?<\/sp-product>/gi) || []
  const out: ScrapedProduct[] = []
  for (const block of blocks) {
    const nameMeta = block.match(/itemprop=["']name["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim()
    const nameDiv = block.match(/class=["'][^"']*\bname\b[^"']*["'][^>]*>([^<]+)</i)?.[1]?.trim()
    const altName = block.match(/<img[^>]*class=["'][^"']*\bimage\b[^"']*["'][^>]*alt=["']([^"']+)["']/i)?.[1]?.trim()
    const name = nameMeta || nameDiv || altName || ''
    const metaImage = block.match(/itemprop=["']image["'][^>]*content=["']([^"']*cloudfront[^"']+)["']/i)?.[1]?.trim()
    const ngSrcImage = block.match(/<img[^>]*class=["'][^"']*\bimage\b[^"']*["'][^>]*ng-src=["']([^"']*cloudfront[^"']+)["']/i)?.[1]?.trim()
    const srcImage = block.match(/<img[^>]*class=["'][^"']*\bimage\b[^"']*["'][^>]*src=["']([^"']*cloudfront[^"']+)["']/i)?.[1]?.trim()
    const price = block.match(/<span[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([^<]+)</i)?.[1]?.trim() || ''
    const imageUrl = pickProductImageUrl([metaImage || '', ngSrcImage || '', srcImage || ''])
    if (!name || !imageUrl) continue
    out.push({
      nameAr: name,
      nameEn: name,
      price,
      imageUrl,
      category: getCategoryFromUrl(targetUrl),
    })
  }
  return out
}

async function promptInteractiveCloudflare(page: Page, url: string) {
  if (!INTERACTIVE_AUTH) return
  console.log(`   🔐 Cloudflare challenge detected for ${url}`)
  console.log('   Solve the challenge in the opened browser window, then press Enter here.')
  const rl = createInterface({ input, output })
  try {
    await rl.question('   Press Enter after challenge is solved...')
  } finally {
    rl.close()
  }
  await page.waitForTimeout(1500)
}

async function gotoBaladi(page: Page, url: string, timeout = 45000): Promise<boolean> {
  await page.goto(url, { waitUntil: 'load', timeout })
  for (let i = 0; i < 12; i++) {
    const title = await page.title().catch(() => '')
    const bodyText = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
    const challenged = /just a moment/i.test(title) || bodyText.includes('security verification')
    if (!challenged) return true
    if (INTERACTIVE_AUTH) {
      await promptInteractiveCloudflare(page, url)
      continue
    }
    await new Promise((r) => setTimeout(r, 3000))
    await page.reload({ waitUntil: 'load', timeout }).catch(() => {})
  }
  return false
}

async function applyBaladiCookies(context: BrowserContext) {
  if (!BALADI_CF_CLEARANCE) return
  await context.addCookies([{
    name: 'cf_clearance',
    value: BALADI_CF_CLEARANCE,
    domain: 'www.baladisupermarket.com',
    path: '/',
    secure: true,
    httpOnly: false,
    sameSite: 'None',
  }]).catch(() => {})
}

async function loadBackfillCheckpoint(projectId: string, dataset: string): Promise<BackfillCheckpoint | null> {
  if (RESET_CHECKPOINT) {
    await rm(CHECKPOINT_PATH, { force: true }).catch(() => {})
    return null
  }
  try {
    const raw = await readFile(CHECKPOINT_PATH, 'utf8')
    const parsed = JSON.parse(raw) as BackfillCheckpoint
    if (parsed.projectId !== projectId || parsed.dataset !== dataset) return null
    if (typeof parsed.lastProcessedIndex !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

async function saveBackfillCheckpoint(state: BackfillCheckpoint) {
  await mkdir(path.dirname(CHECKPOINT_PATH), { recursive: true })
  await writeFile(CHECKPOINT_PATH, JSON.stringify(state, null, 2), 'utf8')
}

async function clearBackfillCheckpoint() {
  await rm(CHECKPOINT_PATH, { force: true }).catch(() => {})
}

type ImageDownloadResult = { buffer: Buffer; ext: string }

type WriteClient = {
  fetch: (query: string, params?: Record<string, unknown>) => Promise<unknown>
  create: (doc: Record<string, unknown>) => Promise<{ _id: string }>
  patch: (id: string) => { set: (data: Record<string, unknown>) => { commit: () => Promise<unknown> } }
  assets: { upload: (type: string, buf: Buffer, opts: { filename: string }) => Promise<{ _id: string }> }
}

/** Backfill mode: fetch each existing product by name from Baladi search, update image in Sanity. */
async function runBackfillExisting(writeClient: WriteClient, projectId: string, dataset: string) {
  const allProducts = await writeClient.fetch(
    `*[_type == "masterCatalogProduct"]{ _id, nameEn, nameAr, category, "image": image }`
  )
  const list = ((allProducts ?? []) as Array<{ _id: string; nameEn?: string; nameAr?: string; category?: string; image?: { asset?: { _ref?: string } } }>)
    .sort((a, b) => normalizeKey(a.nameEn ?? a.nameAr ?? '').localeCompare(normalizeKey(b.nameEn ?? b.nameAr ?? '')))
  if (list.length === 0) {
    console.log('   No master catalog products found.')
    return
  }
  console.log(`   Found ${list.length} products. Mode: ${OVERWRITE_ALL ? 'overwrite-all' : 'update/skip-ready'}. Limit: ${EFFECTIVE_LIMIT}/session.`)
  if (OVERWRITE_ALL) {
    console.log('   Overwrite mode: replacing images for ALL products.')
  } else {
    console.log('   Normal mode: skipping products that already have image + names + category.')
  }
  console.log(`   Crawling Baladi products...`)

  const checkpoint = await loadBackfillCheckpoint(projectId, dataset)
  const startIndex = Math.min(Math.max((checkpoint?.lastProcessedIndex ?? -1) + 1, 0), list.length)
  if (checkpoint && startIndex < list.length) {
    console.log(`   Resuming from checkpoint at product ${startIndex + 1}/${list.length}`)
  }

  const browser = await chromium.launch({
    headless: INTERACTIVE_AUTH ? false : BALADI_HEADLESS,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  })
  await applyBaladiCookies(context)

  const page = await context.newPage()
  const queue = [...CATEGORY_URLS]
  const seenPages = new Set<string>()
  const byName = new Map<string, ScrapedProduct>()

  while (queue.length > 0 && seenPages.size < 60 && byName.size < 2500) {
    const url = queue.shift()
    if (!url) break
    const full = resolveImageUrl(url)
    if (seenPages.has(full)) continue
    seenPages.add(full)
    try {
      const ok = await gotoBaladi(page, full, 35000)
      if (!ok) {
        console.log(`   ⚠ Cloudflare challenge not passed for ${full}`)
        continue
      }
      await page.waitForSelector('sp-product, img.image, .name', { timeout: 12000 }).catch(() => {})
      await new Promise((r) => setTimeout(r, 1800))

      const discovered = await discoverCategoryProductUrls(page)
      for (const d of discovered) {
        if (!seenPages.has(d) && queue.length < 200) queue.push(d)
      }

      let spProducts = await extractSpProductsFromPage(page, full)
      if (spProducts.length === 0) {
        const html = await page.content()
        const htmlProducts = extractProductsFromHtml(html, full)
        if (htmlProducts.length > 0) spProducts = htmlProducts
      }
      for (const p of spProducts) {
        if (!p.nameEn || !p.imageUrl) continue
        const k1 = normalizeKey(p.nameEn)
        const k2 = normalizeKey(p.nameAr)
        const c1 = coreName(p.nameEn)
        const c2 = coreName(p.nameAr)
        if (k1 && !byName.has(k1)) byName.set(k1, p)
        if (k2 && !byName.has(k2)) byName.set(k2, p)
        if (c1 && c1.length >= 3 && !byName.has(c1)) byName.set(c1, p)
        if (c2 && c2.length >= 3 && !byName.has(c2)) byName.set(c2, p)
      }
      console.log(`   Crawled ${full} → ${spProducts.length} products (${byName.size} indexed)`)
      await new Promise((r) => setTimeout(r, 1000))
    } catch {
      /* skip */
    }
  }

  let updated = 0
  let skipped = 0
  let failed = 0
  const usedScrapedKeys = new Set<string>()
  const existingKeys = new Set(list.map((r) => normalizeKey(r.nameEn ?? r.nameAr ?? '')))

  for (let idx = startIndex; idx < list.length; idx++) {
    const rec = list[idx]
    if (updated >= EFFECTIVE_LIMIT) break
    const nameEn = (rec.nameEn ?? '').trim()
    const nameAr = (rec.nameAr ?? '').trim()
    const kEn = normalizeKey(nameEn)
    const kAr = normalizeKey(nameAr)
    const scraped = findBestScrapedMatch(nameEn, nameAr, byName)
    if (!scraped?.imageUrl) {
      skipped++
      await saveBackfillCheckpoint({
        projectId,
        dataset,
        lastProcessedIndex: idx,
        updatedTotal: (checkpoint?.updatedTotal ?? 0) + updated,
        skippedTotal: (checkpoint?.skippedTotal ?? 0) + skipped,
        failedTotal: (checkpoint?.failedTotal ?? 0) + failed,
        updatedAt: new Date().toISOString(),
      })
      continue
    }
    if (!OVERWRITE_ALL) {
      const hasFullData =
        !!(rec.nameEn ?? '').trim() &&
        !!(rec.nameAr ?? '').trim() &&
        !!(rec.category ?? '').trim() &&
        !!rec.image?.asset?._ref
      if (hasFullData) {
        skipped++
        await saveBackfillCheckpoint({
          projectId,
          dataset,
          lastProcessedIndex: idx,
          updatedTotal: (checkpoint?.updatedTotal ?? 0) + updated,
          skippedTotal: (checkpoint?.skippedTotal ?? 0) + skipped,
          failedTotal: (checkpoint?.failedTotal ?? 0) + failed,
          updatedAt: new Date().toISOString(),
        })
        continue
      }
    }

    try {
      const result = await downloadImageToBuffer(scraped.imageUrl)
      if (!result || result.buffer.length < 100) {
        failed++
        continue
      }
      const asset = await writeClient.assets.upload('image', result.buffer, {
        filename: `baladi-${slugify(nameEn || nameAr)}.${result.ext}`,
      })
      await writeClient.patch(rec._id).set({
        category: scraped.category || 'grocery',
        searchQuery: [scraped.nameEn, scraped.nameAr].filter(Boolean).join(' ').slice(0, 200) || 'product',
        image: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } },
      }).commit()
      updated++
      usedScrapedKeys.add(normalizeKey(scraped.nameEn || scraped.nameAr))
      console.log(`   ✓ ${nameEn || nameAr}: image/category updated`)
    } catch (err) {
      failed++
      console.error(`   ✗ ${nameEn || nameAr}:`, err instanceof Error ? err.message : String(err))
    }
    await saveBackfillCheckpoint({
      projectId,
      dataset,
      lastProcessedIndex: idx,
      updatedTotal: (checkpoint?.updatedTotal ?? 0) + updated,
      skippedTotal: (checkpoint?.skippedTotal ?? 0) + skipped,
      failedTotal: (checkpoint?.failedTotal ?? 0) + failed,
      updatedAt: new Date().toISOString(),
    })
    await new Promise((r) => setTimeout(r, 800))
  }

  let created = 0
  const uniqueScraped = new Map<string, ScrapedProduct>()
  for (const [k, p] of byName) {
    if (!p?.imageUrl) continue
    const key = normalizeKey(p.nameEn || p.nameAr)
    if (usedScrapedKeys.has(key) || existingKeys.has(key)) continue
    if (uniqueScraped.has(key)) continue
    uniqueScraped.set(key, p)
  }
  for (const [key, scraped] of uniqueScraped) {
    if (updated + created >= EFFECTIVE_LIMIT) break
    try {
      const result = await downloadImageToBuffer(scraped.imageUrl)
      if (!result || result.buffer.length < 100) continue
      const asset = await writeClient.assets.upload('image', result.buffer, {
        filename: `baladi-${slugify(scraped.nameEn || scraped.nameAr)}.${result.ext}`,
      })
      const unitType = inferUnitType(scraped.nameEn || '', scraped.price || '', scraped.unitText || '')
      const searchQuery = [scraped.nameEn, scraped.nameAr, scraped.brand].filter(Boolean).join(' ').slice(0, 200) || 'product'
      await writeClient.create({
        _type: 'masterCatalogProduct',
        nameEn: scraped.nameEn || scraped.nameAr,
        nameAr: scraped.nameAr || scraped.nameEn,
        category: scraped.category || 'grocery',
        unitType,
        searchQuery,
        image: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } },
      })
      created++
      existingKeys.add(key)
      console.log(`   + Created ${scraped.nameEn || scraped.nameAr}`)
    } catch (err) {
      console.error(`   ✗ Create ${scraped.nameEn}:`, err instanceof Error ? err.message : String(err))
    }
    await new Promise((r) => setTimeout(r, 600))
  }

  const finishedAll = startIndex + updated + skipped + failed >= list.length
  if (finishedAll) {
    await clearBackfillCheckpoint()
    console.log('   Checkpoint cleared (all products processed).')
  } else {
    console.log(`   Checkpoint saved at ${CHECKPOINT_PATH}`)
  }

  await browser.close()
  console.log(`\n✅ Backfill done. Updated: ${updated}, Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`)
}

async function downloadImageToBuffer(url: string, retries = 2): Promise<ImageDownloadResult | null> {
  const fullUrl = resolveImageUrl(url)
  if (!fullUrl) return null
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(fullUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      })
      if (!res.ok) {
        if (i < retries) await new Promise((r) => setTimeout(r, 500 * (i + 1)))
        continue
      }
      const arr = await res.arrayBuffer()
      if (arr.byteLength < 100) return null
      const ct = res.headers.get('content-type') || ''
      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg'
      return { buffer: Buffer.from(arr), ext }
    } catch {
      if (i < retries) await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
  return null
}

async function main() {
  const token = process.env.SANITY_API_TOKEN || process.env.SANITY_API
  if (!token) {
    console.error('❌ SANITY_API_TOKEN or SANITY_API must be set in .env.local')
    process.exit(1)
  }

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || 'production'

  if (!projectId) {
    console.error('❌ NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_PROJECT_ID must be set in .env.local')
    process.exit(1)
  }

  const { createClient } = await import('next-sanity')
  const client = createClient({
    projectId,
    dataset,
    apiVersion: '2026-01-27',
    token,
    useCdn: false,
  })

  const writeClient = client as {
    fetch: (query: string, params?: Record<string, unknown>) => Promise<unknown>
    create: (doc: Record<string, unknown>) => Promise<{ _id: string }>
    patch: (id: string) => { set: (data: Record<string, unknown>) => { commit: () => Promise<unknown> } }
    assets: { upload: (type: string, buf: Buffer, opts: { filename: string }) => Promise<{ _id: string }> }
  }

  if (typeof writeClient.assets?.upload !== 'function') {
    console.error('❌ Sanity client does not support assets.upload. Ensure SANITY_API_TOKEN has write access.')
    process.exit(1)
  }

  const backfillExisting = process.argv.includes('--backfill-existing')
  console.log(backfillExisting ? '🔄 Backfill mode: fixing existing products with Baladi images' : '🚀 Starting Baladi Supermarket import...')
  if (MANUAL_CATEGORY_IDS?.length) {
    console.log(`   📎 Categories: ${MANUAL_CATEGORY_IDS.join(', ')} (${MANUAL_CATEGORY_IDS.length} total)`)
  } else if (MANUAL_URL) {
    console.log(`   📎 Single URL: ${MANUAL_URL}`)
  }
  if (MANUAL_URL || MANUAL_CATEGORY_IDS?.length) {
    console.log(`   📎 Market category: ${MANUAL_MARKET_CATEGORY ?? 'grocery'}`)
  }
  console.log(`   Limit: ${EFFECTIVE_LIMIT} products per session${INTERACTIVE_AUTH ? ' (interactive)' : ''}`)

  if (backfillExisting) {
    if (!INTERACTIVE_AUTH) {
      console.log('   ⚠ Non-interactive backfill is usually blocked by Cloudflare.')
      console.log('   Use: npm run import:baladi:backfill:interactive')
    }
    await runBackfillExisting(writeClient, projectId, dataset)
    return
  }

  // Fetch products needing images (for prioritization) and complete products (to skip when scraping)
  const [productsNeedingImages, completeProductKeys] = await Promise.all([
    writeClient.fetch<
      Array<{ _id: string; nameEn?: string; nameAr?: string }>
    >(
      `*[_type == "masterCatalogProduct" && (!defined(image) || !defined(image.asset) || !defined(image.asset._ref))]{ _id, nameEn, nameAr }`
    ),
    writeClient.fetch<Array<{ nameEn?: string; nameAr?: string }>>(
      `*[_type == "masterCatalogProduct" && defined(image.asset._ref)]{ nameEn, nameAr }`
    ),
  ])
  const needsImageMap = new Map<string, { _id: string; nameEn?: string; nameAr?: string }>()
  for (const x of productsNeedingImages ?? []) {
    const k1 = normalizeKey(x.nameEn ?? '')
    const k2 = normalizeKey(x.nameAr ?? '')
    if (k1) needsImageMap.set(k1, x)
    if (k2) needsImageMap.set(k2, x)
  }
  const completeKeys = new Set((completeProductKeys ?? []).map((x) => normalizeKey(x.nameEn ?? x.nameAr ?? '')))
  console.log(`   ${needsImageMap.size} products need images, ${completeKeys.size} complete (will replace wrong images)`)

  const browser = await chromium.launch({
    headless: INTERACTIVE_AUTH ? false : BALADI_HEADLESS,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  })
  await applyBaladiCookies(context)

  const products: ScrapedProduct[] = []
  const seenUrls = new Set<string>()

  function isUsefulProduct(_p: { nameAr: string; nameEn: string }): boolean {
    return true // Include all: new products + replace wrong images for existing
  }

  try {
    const page = await context.newPage()

    // Search backfill: for products missing images, visit search page to try to get image.
    // Skip when MANUAL_URL — we're importing from one URL only, avoid 50+ search navigations.
    const needsImageList = MANUAL_URL ? [] : Array.from(needsImageMap.values())
    const seenNeedsImage = new Set<string>()
    const MAX_SEARCH_BACKFILL = 50
    for (let i = 0; i < Math.min(needsImageList.length, MAX_SEARCH_BACKFILL); i++) {
      const rec = needsImageList[i]
      const nameEn = (rec.nameEn ?? '').trim()
      const nameAr = (rec.nameAr ?? '').trim()
      const query = nameEn || nameAr
      if (!query || seenNeedsImage.has(normalizeKey(query))) continue
      seenNeedsImage.add(normalizeKey(query))
      try {
        const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(query)}`
        const ok = await gotoBaladi(page, searchUrl, 20000)
        if (!ok) continue
        await new Promise((r) => setTimeout(r, 2000))
        const card = await page.$('.product-item, .product, .product-card, [class*="product"]')
        if (card) {
          await card.hover().catch(() => {})
          await new Promise((r) => setTimeout(r, 300))
        }
        const extracted = await page.evaluate(() => {
          const card = document.querySelector('.product-item, .product, .product-card, [class*="product"]')
          const img = card?.querySelector('img.image') as HTMLImageElement | null
          const src =
            img?.getAttribute('ng-src') ||
            img?.src ||
            img?.getAttribute('data-src') ||
            img?.getAttribute('data-lazy-src') ||
            img?.getAttribute('data-original') ||
            ''
          const link = card?.querySelector('a[href*="/product"], a[href*="/p/"], a[href*="/item"]') as HTMLAnchorElement | null
          return { imageUrl: (src || '').trim(), productUrl: (link?.href || '').trim() }
        })
        const imageUrl = pickProductImageUrl(extracted.imageUrl ? [extracted.imageUrl] : [])
        if (imageUrl) {
          products.push({
            nameAr: nameAr || nameEn,
            nameEn: nameEn || nameAr,
            price: '',
            imageUrl,
            category: 'grocery',
            productUrl: extracted.productUrl || undefined,
          })
          seenUrls.add(imageUrl + (nameAr || nameEn))
          console.log(`   🔍 Search backfill: found image for ${nameAr || nameEn}`)
        }
      } catch {
        /* skip */
      }
      await new Promise((r) => setTimeout(r, 1000))
    }

    const totalCategories = CATEGORY_URLS.length
    let categoryIndex = 0
    for (const targetUrl of CATEGORY_URLS) {
      if (products.length >= SCRAPE_POOL_LIMIT) break
      categoryIndex++
      if (totalCategories > 1) {
        console.log(`\n   [${categoryIndex}/${totalCategories}] Scraping: ${targetUrl}`)
      } else {
        console.log(`   Scraping: ${targetUrl}`)
      }
      try {
        const ok = await gotoBaladi(page, targetUrl, 45000)
        if (!ok) {
          console.log(`   ⚠ Cloudflare challenge not passed for ${targetUrl}`)
          continue
        }

        // Wait for dynamic content. Product image: img.image (Angular ng-src, CloudFront)
        await page.waitForSelector('img.image, .name, .price', { timeout: 15000 }).catch(() => {})
      await new Promise((r) => setTimeout(r, 2000)) // Extra wait for lazy-loaded images

      // Scroll to load all products (Baladi uses infinite scroll / load-on-scroll)
      if (MANUAL_URL) {
        console.log(`   Scrolling to load all products (infinite scroll)...`)
        await scrollToLoadAllProducts(page)
        const totalVisible = await page.$$eval('sp-product', (els) => els.length).catch(() => 0)
        console.log(`   Loaded ${totalVisible} products on page`)
      }

      // Strategy A (primary): Parse sp-product cards directly (contains meta[itemprop=image] / img.image).
      let spProducts = await extractSpProductsFromPage(page, targetUrl)
      if (spProducts.length === 0) {
        const html = await page.content()
        const htmlProducts = extractProductsFromHtml(html, targetUrl)
        if (htmlProducts.length > 0) spProducts = htmlProducts
      }
      for (const p of spProducts) {
        if (products.length >= SCRAPE_POOL_LIMIT) break
        if (!p.nameEn || !p.imageUrl) continue
        if (!isUsefulProduct({ nameAr: p.nameAr, nameEn: p.nameEn })) continue
        const dedupKey = `${normalizeKey(p.nameEn)}|${p.imageUrl}`
        if (seenUrls.has(dedupKey)) continue
        seenUrls.add(dedupKey)
        products.push(p)
      }
      if (spProducts.length > 0) {
        console.log(`   Found ${spProducts.length} products from ${targetUrl}`)
        if (CATEGORY_URLS.length === 1) {
          console.log(`   Single category done. Proceeding to import...`)
          break
        }
        // Multiple categories: move to next URL immediately so we don't hang on extra strategies
        console.log(`   Moving to next category...`)
        await new Promise((r) => setTimeout(r, 1500))
        continue
      }

      // Strategy 0: Try to extract from preloaded data (ZuZ/Baladi data.js or window vars)
      let dataJsProducts: unknown[] | null = await page.evaluate(() => {
        const win = window as unknown as Record<string, unknown>
        const keys = ['products', 'items', 'catalog', 'data', 'preloaded', '__PRELOADED_STATE__', 'initialState']
        for (const k of keys) {
          const v = win[k]
          if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') return v
          if (v && typeof v === 'object') {
            const o = v as Record<string, unknown>
            if (Array.isArray(o.products)) return o.products
            if (Array.isArray(o.items)) return o.items
            if (Array.isArray(o.catalog)) return o.catalog
          }
        }
        return null
      }).catch(() => null)

      // Fallback: fetch data.js directly from Node (avoids CORS)
      if (!dataJsProducts?.length) {
        const dataJsUrl = await page.evaluate(() => {
          const s = document.querySelector('script[src*="data.js"]') as HTMLScriptElement | null
          return s?.src || null
        })
        if (dataJsUrl) {
          try {
            const res = await fetch(dataJsUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BediCatalogImporter/1.0)' },
            })
            const text = await res.text()
            const match = text.match(/(?:products|items|catalog)\s*[:=]\s*(\[[\s\S]*?\])\s*[,;\)]/m) ||
              text.match(/"products"\s*:\s*(\[[\s\S]*?\])/m) ||
              text.match(/"items"\s*:\s*(\[[\s\S]*?\])/m)
            if (match) {
              try {
                const parsed = JSON.parse(match[1]) as unknown[]
                if (Array.isArray(parsed) && parsed.length > 0) dataJsProducts = parsed
              } catch { /* ignore */ }
            }
          } catch { /* ignore */ }
        }
      }

      if (dataJsProducts && Array.isArray(dataJsProducts)) {
        let addedFromData = 0
        for (const row of dataJsProducts) {
          if (products.length >= SCRAPE_POOL_LIMIT) break
          const r = row as Record<string, unknown>
          const nameAr = String(r.nameAr ?? r.name ?? r.titleAr ?? r.title ?? r.displayName ?? '').trim()
          const nameEn = String(r.nameEn ?? r.name ?? r.titleEn ?? r.title ?? nameAr).trim()
          const img = r.image ?? r.imageUrl ?? r.img ?? r.thumbnail ?? r.picture ?? (r.images as unknown[])?.[0]
          let imageUrl = resolveImageUrl(String(img ?? ''))
          if (imageUrl && !isCloudfrontImage(imageUrl)) imageUrl = '' // Prefer CloudFront product images only
          const price = r.price != null ? String(r.price) : ''
          const brand = r.brand ? String(r.brand).trim() : undefined
          const unitText = r.unit ? String(r.unit).trim() : (r.unitType ? String(r.unitType).trim() : '')
          if (!nameAr) continue
          if (!isUsefulProduct({ nameAr, nameEn: nameEn || nameAr })) continue
          const dedupKey = (imageUrl || '') + nameAr
          if (seenUrls.has(dedupKey)) continue
          seenUrls.add(dedupKey)
          addedFromData++
          products.push({
            nameAr,
            nameEn: nameEn || nameAr,
            price,
            imageUrl,
            category: getCategoryFromUrl(targetUrl),
            brand,
            unitText,
          })
        }
        if (addedFromData > 0) {
          console.log(`   Found ${addedFromData} products from preloaded data`)
          await new Promise((r) => setTimeout(r, 1500))
          continue
        }
      }

      // Strategy 1: Find product containers. Product image: .details.show-on-hover img.image (CloudFront)
      const productSelector = '.product-item, .product, .product-card, .item, [class*="product"], [class*="item"]'
      const productElements = await page.$$(productSelector)

      if (productElements.length > 0) {
        for (const el of productElements) {
          if (products.length >= SCRAPE_POOL_LIMIT) break
          try {
            const nameEl = await el.$('.name')
            const priceEl = await el.$('.price')
            const brandEl = await el.$('.brand, .manufacturer, [class*="brand"]')
            const unitEl = await el.$('.unit, .unit-type, [class*="unit"]')
            const linkEl = await el.$('a[href*="/product"], a[href*="/p/"], a[href*="/item"]')

            const nameAr = nameEl ? (await nameEl.textContent())?.trim() || '' : ''
            const nameEn = nameAr
            const price = priceEl ? (await priceEl.textContent())?.trim() || '' : ''
            const brand = brandEl ? (await brandEl.textContent())?.trim() || undefined : undefined
            const unitText = unitEl ? (await unitEl.textContent())?.trim() || '' : ''
            const productUrl = linkEl ? resolveImageUrl(await linkEl.getAttribute('href') || '') : undefined

            // Product image: img.image (Angular ng-src, CloudFront). Hover to reveal show-on-hover content.
            await el.hover().catch(() => {})
            await new Promise((r) => setTimeout(r, 300))
            const candidates: string[] = []
            for (const sel of ['img.image', '.details.show-on-hover img.image', '.details img.image', 'img']) {
              const img = await el.$(sel)
              const s = await getImgUrl(img)
              if (s && !candidates.includes(s)) candidates.push(s)
            }
            const imageUrl = pickProductImageUrl(candidates)
            if (!nameAr) continue
            if (!isUsefulProduct({ nameAr, nameEn })) continue
            const dedupKey = (imageUrl || '') + nameAr
            if (seenUrls.has(dedupKey)) continue
            seenUrls.add(dedupKey)
            const catFromUrl = getCategoryFromUrl(targetUrl)
            products.push({ nameAr, nameEn, price, imageUrl, category: catFromUrl, brand, unitText, productUrl })
          } catch {
            /* skip */
          }
        }
      }

      // Strategy 2: By-index extraction. img.image (Angular ng-src, CloudFront). Always run to capture images.
      const names = await page.$$eval('.name', (els) => els.map((e) => (e.textContent || '').trim()).filter(Boolean))
      const prices = await page.$$eval('.price', (els) => els.map((e) => (e.textContent || '').trim()).filter(Boolean))
      const images = await page.$$eval('img.image', (els) =>
        els.map((e) => {
          const img = e as HTMLImageElement
          const src =
            img?.getAttribute('ng-src') ||
            img?.src ||
            img?.getAttribute('data-src') ||
            img?.getAttribute('data-lazy-src') ||
            img?.getAttribute('data-original') ||
            ''
          return (src || '').trim()
        }).filter(Boolean)
      )
      const units = await page.$$eval('.unit, .unit-type, [class*="unit"]', (els) => els.map((e) => (e.textContent || '').trim()).filter(Boolean)).catch(() => [] as string[])
      const maxLen = Math.max(names.length, prices.length, images.length, 1)
      for (let i = 0; i < Math.min(maxLen, SCRAPE_POOL_LIMIT - products.length); i++) {
        const nameAr = names[i] || names[0] || ''
        const nameEn = nameAr
        const price = prices[i] ?? ''
        const imageUrl = pickProductImageUrl([images[i], images[0]].filter(Boolean) as string[])
        const unitText = units[i] ?? ''
        if (nameAr && isUsefulProduct({ nameAr, nameEn }) && !seenUrls.has((imageUrl || '') + nameAr)) {
          seenUrls.add((imageUrl || '') + nameAr)
          products.push({ nameAr, nameEn, price, imageUrl, category: getCategoryFromUrl(targetUrl), unitText })
        }
      }

        await new Promise((r) => setTimeout(r, 1500)) // Rate limit between pages
      } catch (err) {
        console.error(`   ✗ Error scraping ${targetUrl}:`, err instanceof Error ? err.message : String(err))
        if (totalCategories > 1) {
          console.log(`   Continuing to next category...`)
        }
      }
    }

    // Backfill images: visit product pages for products that need images but we didn't get from listing.
    // Skip when MANUAL_URL — avoids extra page navigations that can confuse the browser.
    const MAX_BACKFILL = MANUAL_URL ? 0 : 10
    const needsBackfill = products.filter(
      (p) =>
        !p.imageUrl &&
        p.productUrl &&
        (needsImageMap.has(normalizeKey(p.nameEn)) || needsImageMap.has(normalizeKey(p.nameAr)))
    )
    for (let i = 0; i < Math.min(needsBackfill.length, MAX_BACKFILL); i++) {
      const p = needsBackfill[i]
      if (!p?.productUrl) continue
      try {
        const detailPage = await browser.newPage()
        const ok = await gotoBaladi(detailPage, p.productUrl, 20000)
        if (!ok) {
          await detailPage.close()
          continue
        }
        await new Promise((r) => setTimeout(r, 1500))
        const productContainer = await detailPage.$('.product, .product-detail, [class*="product"]')
        if (productContainer) {
          await productContainer.hover().catch(() => {})
          await new Promise((r) => setTimeout(r, 300))
        }
        const imgSrc = await detailPage.evaluate(() => {
          const img = document.querySelector('img.image') as HTMLImageElement | null
          return (
            img?.getAttribute('ng-src') ||
            img?.src ||
            img?.getAttribute('data-src') ||
            img?.getAttribute('data-lazy-src') ||
            img?.getAttribute('data-original') ||
            ''
          )
        })
        await detailPage.close()
        const imageUrl = pickProductImageUrl(imgSrc ? [imgSrc] : [])
        if (imageUrl) {
          p.imageUrl = imageUrl
          console.log(`   📷 Backfilled image for ${p.nameAr}`)
        }
      } catch {
        /* skip */
      }
      await new Promise((r) => setTimeout(r, 800))
    }

  } finally {
    await browser.close()
  }

  console.log(`\n📦 Scraped ${products.length} products. Importing to Sanity...\n`)
  if (products.length === 0) {
    console.log('   No products to import. Check that the page has sp-product elements with CloudFront images.')
    return
  }

  let created = 0
  let updated = 0
  let skipped = 0
  let failed = 0
  let changedThisRun = 0

  const existingRows = await writeClient.fetch<Array<{
    _id: string
    nameEn?: string
    nameAr?: string
    category?: string
    image?: { asset?: { _ref?: string } }
  }>>(
    `*[_type == "masterCatalogProduct"]{ _id, nameEn, nameAr, category, "image": image }`
  )
  const existingByKey = new Map<string, { _id: string; nameEn?: string; nameAr?: string; category?: string; image?: { asset?: { _ref?: string } } }>()
  for (const row of (existingRows ?? [])) {
    const kEn = normalizeKey(row.nameEn ?? '')
    const kAr = normalizeKey(row.nameAr ?? '')
    if (kEn && !existingByKey.has(kEn)) existingByKey.set(kEn, row)
    if (kAr && !existingByKey.has(kAr)) existingByKey.set(kAr, row)
  }

  for (const p of products) {
    if (changedThisRun >= EFFECTIVE_LIMIT) break
    try {
      const existing = existingByKey.get(normalizeKey(p.nameEn)) || existingByKey.get(normalizeKey(p.nameAr)) || null

      if (existing) {
        const needsNameEn = !(existing.nameEn ?? '').trim()
        const needsNameAr = !(existing.nameAr ?? '').trim()
        const needsCategory = !(existing.category ?? '').trim()
        const hasImage = !!existing.image?.asset?._ref
        const hasFullData = !needsNameEn && !needsNameAr && !needsCategory && hasImage
        if (hasFullData && !OVERWRITE_ALL) {
          skipped++
          continue
        }

        const patch: Record<string, unknown> = {}
        if (needsNameEn && (p.nameEn || p.nameAr)) patch.nameEn = p.nameEn || p.nameAr
        if (needsNameAr && p.nameAr) patch.nameAr = p.nameAr
        if (needsCategory && p.category) patch.category = p.category
        if (p.unitText || p.price) {
          patch.unitType = inferUnitType(p.nameEn || '', p.price || '', p.unitText || '')
        }
        patch.searchQuery = [p.nameEn, p.nameAr, p.brand].filter(Boolean).join(' ').slice(0, 200) || 'product'

        // Always replace image when we have correct CloudFront URL (fixes wrong images)
        if (p.imageUrl) {
          await new Promise((r) => setTimeout(r, 300)) // Slight delay to avoid rate limits
          const result = await downloadImageToBuffer(p.imageUrl)
          if (result && result.buffer.length > 0) {
            const asset = await writeClient.assets.upload('image', result.buffer, {
              filename: `baladi-${slugify(p.nameEn || p.nameAr)}.${result.ext}`,
            })
            patch.image = { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: asset._id } }
          }
        }

        if (Object.keys(patch).length > 0) {
          await writeClient.patch(existing._id).set(patch).commit()
          updated++
          changedThisRun++
          console.log(`   ↻ Updated ${p.nameAr}${patch.image ? ' (+image)' : ''}`)
        } else {
          skipped++
        }
        continue
      }

      let imageRef: string | undefined
      if (p.imageUrl) {
        await new Promise((r) => setTimeout(r, 300)) // Slight delay to avoid rate limits
        const result = await downloadImageToBuffer(p.imageUrl)
        if (result && result.buffer.length > 0) {
          const asset = await writeClient.assets.upload('image', result.buffer, {
            filename: `baladi-${slugify(p.nameEn || p.nameAr)}.${result.ext}`,
          })
          imageRef = asset._id
        }
      }

      const unitType = inferUnitType(p.nameEn || '', p.price || '', p.unitText || '')
      const searchQuery = [p.nameEn, p.nameAr, p.brand].filter(Boolean).join(' ') || 'product'

      await writeClient.create({
        _type: 'masterCatalogProduct',
        nameEn: p.nameEn || p.nameAr,
        nameAr: p.nameAr,
        category: p.category,
        unitType,
        searchQuery: searchQuery.slice(0, 200),
        ...(imageRef && { image: { _type: 'image', asset: { _type: 'reference', _ref: imageRef } } }),
      })
      created++
      changedThisRun++
      console.log(`   ✓ Created ${p.nameAr}${imageRef ? ' (+image)' : ''}`)
    } catch (err) {
      failed++
      console.error(`   ✗ ${p.nameAr}:`, err instanceof Error ? err.message : String(err))
    }
  }

  console.log(`\n✅ Done. Created: ${created}, Updated: ${updated}, Changed this run: ${changedThisRun}/${EFFECTIVE_LIMIT}, Skipped (complete): ${skipped}, Failed: ${failed}`)
}

function getCategoryFromUrl(url: string): string {
  if (MANUAL_MARKET_CATEGORY) return MANUAL_MARKET_CATEGORY
  const idMatch = url.match(/\/categories\/(\d+)/)
  if (idMatch && idMatch[1] in CATEGORY_ID_MAP) return CATEGORY_ID_MAP[idMatch[1]]
  const lower = url.toLowerCase()
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (key !== 'default' && lower.includes(key)) return val
  }
  return CATEGORY_MAP.default
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

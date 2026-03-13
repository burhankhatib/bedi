# Baladi Supermarket Global Catalog Importer — Setup & Run Guide

This guide walks you through setting up and running the Baladi Supermarket catalog importer for Bedi Delivery. The importer scrapes products from [baladisupermarket.com](https://www.baladisupermarket.com/) and imports them into Sanity as `masterCatalogProduct` documents for use in the Quick Add catalog.

---

## 1. Prerequisites

- **Node.js 18+**
- **npm** (or pnpm/yarn)
- **SANITY_API_TOKEN** with write access (in `.env.local`)
- **Playwright** Chromium browser (installed by the script or manually)

---

## 2. Environment Setup

Ensure your `.env.local` contains:

```bash
# Sanity (required for import)
NEXT_PUBLIC_SANITY_PROJECT_ID="your-project-id"
NEXT_PUBLIC_SANITY_DATASET="production"
SANITY_API_TOKEN="sk..."   # Must have write access

# Optional: limit products per run (default: 50)
BALADI_MAX_PRODUCTS=50

# Optional anti-bot settings for Baladi/Cloudflare:
# Run headed browser and pass manual verification once
BALADI_HEADLESS=false
# Optional: paste cf_clearance cookie value from your browser session
BALADI_CF_CLEARANCE=""
```

**Important:** The script loads `.env.local` automatically. The `SANITY_API_TOKEN` must have **Editor** or **Admin** permissions in your Sanity project.

---

## 3. Install Dependencies

From the project root:

```bash
npm install
npx playwright install chromium
```

This installs:
- `playwright` — browser automation
- `tsx` — TypeScript execution
- `dotenv` — env loading

---

## 4. Run the Importer

**Standard mode** (scrape category pages + import):

```bash
npm run import:baladi
```

**Import a single category by URL** (CLI or Admin UI):

```bash
npm run import:baladi:url -- --url "https://www.baladisupermarket.com/categories/95010/products" --market-category grocery
```

- Opens a visible browser. Solve the Cloudflare check when prompted, then press Enter.
- Use `--url` with any Baladi category page (with or without `?page=2` etc.).
- Use `--market-category` to map to your catalog: `grocery`, `bakery`, `retail`, `pharmacy`, `restaurant`, `cafe`, or `other`.
- **Admin UI:** Paste a URL and click Import. If it fails (Cloudflare blocks headless), the UI shows the command above to run locally.

**Backfill existing products** (fix images for ALL products already in Sanity — searches Baladi by product name):

```bash
npm run import:baladi:backfill
```

**Interactive backfill** (recommended — non-interactive is blocked by Cloudflare):

```bash
npm run import:baladi:backfill:interactive
```

- Opens a visible browser. Complete the Cloudflare check, then press Enter when prompted.
- Limit: **200 products per session**.
- Skips products that already have image + names + category; only updates incomplete ones and adds new products.
- Auto-saves progress and resumes on the next run.

**One-time overwrite all** (replace every product image with Baladi):

```bash
npm run import:baladi:backfill:overwrite
```

- Resets checkpoint and overwrites all existing products with Baladi images.
- Run once, then use `import:baladi:backfill:interactive` for normal update/skip-ready mode.

**Restart from product 1** (clear checkpoint):

```bash
npm run import:baladi:backfill:reset
```

Or directly:

```bash
npx tsx scripts/import-baladi.ts
npx tsx scripts/import-baladi.ts --backfill-existing
```

---

## 5. What the Script Does

### Scraping (Playwright)

- Launches a headless Chromium browser
- Visits Baladi category pages (configurable in `CATEGORY_URLS`)
- Waits for dynamic content to load
- Extracts products using:
  - **`.name`** — product name (Arabic)
  - **`.price`** — price text
  - **`.image`** — product image (`img` src or container `href`)

### Sanity Pipeline

- Downloads each image via `fetch` to a buffer
- Uploads to Sanity with `client.assets.upload('image', buffer)`
- Creates `masterCatalogProduct` documents with:
  - `nameEn`, `nameAr` (from scraped name)
  - `category` (mapped from URL)
  - `unitType: 'piece'`
  - `searchQuery` (fallback for Unsplash)
  - `image` (Sanity asset reference)

### De-duplication

- Checks for existing `masterCatalogProduct` with same `nameEn` or `nameAr`
- Skips creation if a duplicate exists

### Rate Limiting

- `MAX_PRODUCTS_PER_RUN` (default: 50) caps products per execution
- 1.5 second delay between category pages
- Override with: `BALADI_MAX_PRODUCTS=100 npm run import:baladi`

---

## 6. Configuration (scripts/import-baladi.ts)

### `MAX_PRODUCTS_PER_RUN` / `BALADI_MAX_PRODUCTS`

Limit products per run to avoid rate limits and long runs.

### `CATEGORY_URLS`

Add Baladi category URLs to scrape:

```ts
const CATEGORY_URLS = [
  'https://www.baladisupermarket.com',
  'https://www.baladisupermarket.com/grocery',
  'https://www.baladisupermarket.com/products',
  // Add more as you discover them
]
```

### `CATEGORY_MAP`

Maps URL path segments to Bedi category values (`grocery`, `bakery`, `retail`, etc.).

---

## 7. Quick Add Integration

The existing **CatalogProductsModal** and `/api/tenants/[slug]/master-catalog` already:

1. Query: `*[_type == 'masterCatalogProduct' && category == $selectedCategory]`
2. Show products with names and images
3. On **Quick Add**, call `/api/tenants/[slug]/products/from-catalog` with `masterCatalogId`
4. The API creates a new `product` document linked to the store, copies titles, category, and uses the master catalog image asset

**No frontend changes are required** — imported Baladi products appear automatically in the Quick Add catalog for grocery/supermarket businesses.

---

## 8. Sanity Write Token

The script reads `SANITY_API_TOKEN` or `SANITY_API` from `.env.local`. To get a token:

1. Go to [sanity.io/manage](https://sanity.io/manage)
2. Select your project
3. **API** → **Tokens** → **Add API token**
4. Name it e.g. "Baladi Importer"
5. Permissions: **Editor** (read + write)
6. Add to `.env.local`:
   ```bash
   SANITY_API_TOKEN="sk..."
   ```

---

## 9. Selector Updates

If Baladi changes their HTML structure, update the selectors in `scripts/import-baladi.ts`:

- **Product container:** `productSelector` (line ~120)
- **Name:** `.name`
- **Price:** `.price`
- **Image:** `.image img, .image`

---

## 10. Troubleshooting

| Issue | Solution |
|-------|----------|
| `SANITY_API_TOKEN must be set` | Add token to `.env.local` |
| Product images empty in admin UI | Run `npm run import:baladi:backfill` to fix existing products |
| `Just a moment... / security verification` | Use `npm run import:baladi:backfill:interactive` to manually pass Cloudflare once. If needed also set `BALADI_CF_CLEARANCE` |
| `Product selector not found` | Site structure changed; inspect with `await page.screenshot({ path: 'debug.png' })` and update selectors |
| `assets.upload is not a function` | Use a token with **Editor** permission |
| No products scraped | Check `CATEGORY_URLS`; run with `headless: false` to watch the browser |
| Rate limit / timeout | Lower `BALADI_MAX_PRODUCTS`; increase delay between pages |

---

## 11. Running in Debug Mode

To watch the browser and debug selectors:

In `scripts/import-baladi.ts`, change:

```ts
const browser = await chromium.launch({ headless: false })
```

Then run `npm run import:baladi` and observe the page.

---

## 12. Summary Checklist

- [ ] `.env.local` has `SANITY_API_TOKEN`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`
- [ ] `npm install` and `npx playwright install chromium` completed
- [ ] Run `npm run import:baladi`
- [ ] Verify products in Sanity Studio (`masterCatalogProduct` type)
- [ ] Test Quick Add in a grocery/supermarket tenant’s menu

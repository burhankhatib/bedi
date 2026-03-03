# Sanity API consumption research: why public pages can hit 200+ requests

This document explains why visiting only static public pages (home, search, join, contact, tenant menus) can consume 200+ Sanity API calls, and how to reduce it.

---

## 1. Does the Clerk proxy change affect Sanity?

**No.** The proxy change only skips **Clerk** `auth()` for public API routes. It does not change how many times your app calls Sanity. Every `client.fetch()` in your API routes or server components still triggers one Sanity API request (or a CDN lookup) per call.

---

## 2. Sanity requests per public page (current behavior)

Each `client.fetch()` (or `clientNoCdn.fetch()`) = **1 Sanity API request**. Below counts are for a single page load or single API call with no response caching.

### Home page `/` (with city chosen)

| Source | API route | Sanity fetches per request |
|--------|-----------|----------------------------|
| LocationContext | GET /api/home/cities | 1 |
| HeroBanner | GET /api/home/banners | 2 (banners + bannerSettings) |
| CategoryGrid | GET /api/home/categories | 2 (categories + tenants) |
| SubcategoriesSection | GET /api/home/sections | 3 (categoriesWithImages, subcategoriesInUse, tenantsWithSubs) |
| PopularProductsSection | GET /api/home/popular-products | 1 |

**Home total: 9 Sanity requests** per load. If HeroBanner fetches twice (once without city, once with), add 2 more = **11**.

### Search page `/search` (with city)

| Source | API route | Sanity fetches |
|--------|-----------|----------------|
| SearchPageClient (useEffect) | GET /api/home/tenants | 1 |
| SearchPageClient (useEffect) | GET /api/home/categories | 2 |
| SearchPageClient (useEffect) | GET /api/home/sections | 3 |

**Search total: 6** per load. **Each filter change** (category/section/area) refetches tenants (1) and sections (3) = **4 more** per change. So 3 filter changes = 6 + 12 = **18** Sanity requests for one search session.

### Join page `/join`

| Source | Server-side | Sanity fetches |
|--------|-------------|----------------|
| getHomePageStats() in join/page.tsx | lib/home-stats.ts | 5 (Promise.all: count tenants, count orders, order quantities, count drivers, tenant locations) |

**Join total: 5** (or 0 if the in-memory 60s cache in home-stats hit).

### Contact page `/contact`

- GET /api/countries → **0** (country-state-city, no Sanity).
- GET /api/cities → **0** (country-state-city / fallback list, no Sanity).

**Contact total: 0** Sanity requests.

### Tenant menu `/t/[slug]` (server component)

| Step | Location | Sanity fetches |
|------|----------|----------------|
| generateMetadata() | getTenantBySlug(slug) | 1 |
| generateMetadata() | clientNoCdn.fetch(restaurantInfo) | 1 |
| Page body | getTenantBySlug(slug) again | 1 |
| Page body | Promise.all([ MENU_QUERY_TENANT, TENANT_FOR_MENU_QUERY ]) | 2 |
| Page body | getDeliveryAreasCount(siteId) | 1 |

**Per tenant menu: 6 Sanity requests.** getTenantBySlug is called **twice** (metadata + page).

### Order page `/order` (when editing items)

- GET /api/menu (when isEditingItems) → **1** (and route has `revalidate = 0`, so no cache).

---

## 3. How one user can reach 200+ Sanity requests

Example “static public only” session:

- **Home** (with city): 11
- **Search** (load + 5 filter changes): 6 + 5×4 = 26
- **Join**: 5
- **5 tenant menus**: 5×6 = 30
- **Back to home** (refresh or navigate): 11
- **Search again** (2 filter changes): 6 + 8 = 14
- **3 more tenant menus**: 18  
- **A few refreshes** of home/search: e.g. 2×(11+6) = 34

Total: 11+26+5+30+11+14+18+34 = **144**. With more tenant menus, more filter toggles, or more refreshes, **200+ is easy**.

So the main drivers are:

1. **No response caching** – Every GET to /api/home/* and /api/menu hits Sanity every time (no `revalidate` or short `max-age`).
2. **Multiple fetches per route** – e.g. /api/home/sections = 3, /api/home/categories = 2, /api/home/banners = 2.
3. **Duplicate work on tenant menu** – getTenantBySlug + metadata fetch + page fetch + delivery areas with no deduplication.
4. **Search refetches on every filter change** – Each change triggers tenants + sections again (4 Sanity requests).
5. **HeroBanner** – Can fetch banners twice (no city, then with city).

---

## 4. Root causes summary

| Cause | Impact | Fix |
|-------|--------|-----|
| No HTTP/Next caching on public GETs | Same URL refetches Sanity every time | Add `revalidate` or `Cache-Control` (e.g. 60s) for /api/home/* and /api/menu |
| getTenantBySlug + metadata + page | Same slug fetched 2× in one request | Dedupe with `React.cache()` (or pass tenant into metadata) |
| Multiple client.fetch per route | 2–3 Sanity calls per API call | Combine queries where possible (banners+settings, etc.) |
| Search filter changes | 4 Sanity requests per change | Client-side cache (SWR/React Query) or short revalidate for same params |
| HeroBanner fetches twice | +2 Sanity requests | Fetch only when city is set (or single fetch with city in deps) |

---

## 5. Recommended changes (in order of impact)

### P0 – Cache public Sanity-backed GET responses

- **/api/home/cities**  
  - Add `export const revalidate = 60` (or equivalent) so the same response is reused for 60s.
- **/api/home/banners**, **/api/home/categories**, **/api/home/sections**, **/api/home/tenants**, **/api/home/popular-products**  
  - Same: `revalidate = 60` (or send `Cache-Control: public, max-age=60`).
- **/api/menu** (public menu)  
  - Short cache, e.g. `revalidate = 60`, so repeated visits or refreshes don’t hit Sanity every time.

This alone can cut Sanity requests by a large factor for repeated views of the same data (e.g. same city, same slug).

### P1 – Deduplicate getTenantBySlug on tenant menu

- In `lib/tenant.ts`, wrap `getTenantBySlug` with `React.cache()` (or use a request-scoped cache) so that the same `slug` in the same request (metadata + page) reuses the same result.
- Avoids 1–2 Sanity requests per tenant menu page load.

### P2 – Reduce fetches per route

- **/api/home/banners**: Combine banners + bannerSettings into one GROQ query (e.g. extend the main query to pull bannerSettings or use a single fetch with a projection). Saves 1 request per banners load.
- **/api/home/categories**: Filter categories in GROQ by tenant businessType in one query instead of fetch(categories) + fetch(tenants). Saves 1 request per categories load.
- **/api/home/sections**: Harder to merge into one query; leave as-is or refactor later. Still benefits from P0 caching.

### P3 – Client-side behavior

- **HeroBanner**: Only call the banners API when `isChosen && city` (or after a short delay) so you don’t do one fetch without city and one with. Saves 2 Sanity requests on home in typical flow.
- **Search**: Use SWR or React Query for /api/home/tenants and /api/home/sections with the same key (e.g. city+category+section+area) so identical params don’t refetch. Doesn’t reduce “first load” Sanity calls but avoids duplicate calls when toggling filters back and forth.

---

## 6. Sanity client and CDN

- `sanity/lib/client.ts` uses `useCdn: true` for the default `client`. So **read** requests from API routes that use `client` go through Sanity’s CDN; identical GROQ queries may be served from cache on Sanity’s side.
- That still counts as API usage (or cached usage) per request; it does **not** cache the **response** of your Next.js API. So without P0, every browser request to your API triggers Sanity again (or a CDN lookup). Adding **response** caching (revalidate / Cache-Control) is what reduces the number of Sanity calls from your app.

---

## 7. Summary

- **Clerk proxy change** does not affect Sanity; only Clerk usage changes.
- **200+ Sanity requests** from “just visiting static public pages” is explained by: no response caching, multiple fetches per route, duplicate tenant fetches on menu, and refetches on search filter changes and refreshes.
- **Highest-impact fix**: add **revalidate = 60** (or equivalent) and/or **Cache-Control: public, max-age=60** for all public GET routes that hit Sanity (/api/home/*, /api/menu). Then deduplicate **getTenantBySlug** and, where easy, combine queries (banners+settings, categories) and tighten client behavior (HeroBanner, search cache).

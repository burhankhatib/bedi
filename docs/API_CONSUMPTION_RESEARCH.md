# API consumption research: why "a couple of pages" can consume 200+ APIs

This document summarizes codebase findings on what drives high API consumption (Clerk, your own `/api/*` routes, and Sanity) and recommends changes to reduce it.

---

## 1. Main finding: Clerk middleware runs on every request (including every `/api/*`)

**File:** [proxy.ts](proxy.ts) (Clerk middleware)

The middleware `config.matcher` includes:

- `'/(api|trpc)(.*)'` → **every** request to `/api/*` runs the middleware.

Inside the handler, **every** matched request runs:

```ts
const { userId, sessionClaims } = await auth()
```

So:

- Every document request (page load) → 1× `auth()` (Clerk API).
- Every client-side `fetch('/api/...')` → 1× `auth()` (Clerk API).

**Example:** Home page with city chosen triggers at least:

- 1× page
- `/api/home/cities`
- `/api/home/banners`
- `/api/home/categories`
- `/api/home/sections`
- `/api/home/popular-products`

→ **6× `auth()`** for a single home load.  
If “200 APIs” means **Clerk** usage, then ~30–35 such page loads (or fewer with more API-heavy pages) can already reach 200.

**Recommendation (high impact):**  
Do **not** call `auth()` for **public** API routes. Only run Clerk auth for:

- Protected **pages** (dashboard, driver, tenant manage, admin).
- API routes that actually require the user (e.g. `/api/me/*`, `/api/driver/*`, `/api/admin/*`, `/api/tenants/*` for mutate/read of that tenant, `/api/orders` when creating/updating, etc.).

For public routes (e.g. `/api/home/*`, `/api/countries`, `/api/cities`, `/api/contact`, `/api/menu` for public menu, etc.), return `nextWithPath(req)` **without** calling `auth()`. That alone can cut Clerk API usage by a large factor for typical browsing.

---

## 2. Client-side fetches per page (no deduplication or caching)

There is no global request deduplication (e.g. SWR/React Query with a single key per resource). Multiple components can trigger the same or overlapping requests.

### Home page `/`

| Source | When | Request(s) |
|--------|------|------------|
| [LocationContext](components/LocationContext.tsx) | Once on mount | `GET /api/home/cities` |
| [HeroBanner](components/home/HeroBanner.tsx) | On mount and when `city`/`lang`/`isChosen` change | `GET /api/home/banners` (can run twice: without city, then with city) |
| [CategoryGrid](components/home/CategoryGrid.tsx) | When `isChosen` and `city` are set | `GET /api/home/categories?city=...` |
| [SubcategoriesSection](components/home/SubcategoriesSection.tsx) | Same | `GET /api/home/sections?city=...` |
| [PopularProductsSection](components/home/PopularProductsSection.tsx) | Same | `GET /api/home/popular-products?city=...` |

So for home with city chosen: **at least 5–6 client API calls**, each also triggering Clerk middleware (and thus Clerk API) if auth is not skipped for these routes.

### Search page `/search`

| Source | When | Request(s) |
|--------|------|------------|
| [SearchPageClient](app/(main)/search/SearchPageClient.tsx) | When city chosen | `GET /api/home/tenants?city=...&category=...&section=...&area=...` |
| Same | When city chosen | `GET /api/home/categories?city=...` |
| Same | When city + category chosen | `GET /api/home/sections?city=...&category=...` |

So **3 API calls** on search load; changing filters re-runs tenants (and sections when category changes), so **2–3 extra** calls per filter change. All of these again go through Clerk if middleware is unchanged.

### Other pages

- **Contact:** `/api/countries`, then `/api/cities?country=...` when country is set, plus `/api/contact` on submit.
- **Join:** Stats are fetched **server-side** in [join/page.tsx](app/(main)/join/page.tsx) via `getHomePageStats()` (no extra client fetch for that).
- **Tenant menu `/t/[slug]`:** [OrderContent](app/(main)/order/OrderContent.tsx) calls `fetch('/api/menu')`; other flows may add more.
- **Tenant manage:** Many sub-pages each call `/api/tenants/[slug]/...` (business, orders/count, etc.) with `cache: 'no-store'`, so no HTTP caching.

So “a couple of pages” can easily be **10–20+ client-side API calls**. With current middleware, that’s **10–20+ Clerk `auth()` calls** even if the user is not signed in.

---

## 3. Sanity: multiple `client.fetch` per API route

Your Next.js API routes use Sanity’s `client.fetch` (and sometimes `clientNoCdn`). Each `client.fetch` is one Sanity API request. So a single **HTTP** request to your backend can trigger **several** Sanity API calls.

Examples:

- [app/api/home/categories/route.ts](app/api/home/categories/route.ts): **2** `client.fetch` (categories + tenants).
- [app/api/home/banners/route.ts](app/api/home/banners/route.ts): **2** `client.fetch` (banners + bannerSettings).
- [app/api/home/sections/route.ts](app/api/home/sections/route.ts): **3** `client.fetch` (categoriesWithImages, subcategoriesInUse, tenantsWithSubs).
- [app/api/home/tenants/route.ts](app/api/home/tenants/route.ts): **1** large `client.fetch` (complex query).

So one home load (cities, banners, categories, sections, popular-products) can be on the order of **1 + 2 + 2 + 3 + 1 = 9+ Sanity API calls** from those five routes alone. If “200 APIs” is **Sanity** usage, then ~20–25 full home loads (or fewer with search and other pages) can reach 200.

---

## 4. No HTTP caching for many client fetches

Many client-side `fetch` calls use `cache: 'no-store'` or no cache, and several API routes send `Cache-Control: no-store, no-cache, must-revalidate`. So:

- Repeated visits to the same page or same data (e.g. same city/category) do not benefit from browser or CDN cache.
- Every navigation or refocus can trigger the same set of requests again.

Examples:

- [TenantBusinessContext](app/(main)/t/[slug]/manage/TenantBusinessContext.tsx): `fetch(..., { cache: 'no-store' })`.
- [ManageNavClient](app/(main)/t/[slug]/manage/ManageNavClient.tsx): `fetch(..., { cache: 'no-store' })` for orders count.
- [OrderDetailsModal](components/Orders/OrderDetailsModal.tsx): products fetched with `cache: 'no-store'`.
- [TenantOrdersLive](app/(main)/t/[slug]/orders/TenantOrdersLive.tsx): orders with `cache: 'no-store'`.

So repeated use of the same page or modal can repeatedly hit the same APIs.

---

## 5. Clerk usage beyond middleware

- **FirebaseClerkSync** ([components/FirebaseClerkSync.tsx](components/FirebaseClerkSync.tsx)): When signed in, calls `getToken({ template: 'firebase' })` once (guarded by `synced.current`). So at most **one extra** Clerk token request per sign-in.
- **useUser / useAuth** are used in many components (SiteHeader, ContactPageClient, MenuLayout, driver/tenant/admin flows). Clerk typically deduplicates these at the client, but the main cost here is still **middleware** on every request.

So the largest lever remains: **stop calling `auth()` for public API routes**.

---

## 6. Polling / intervals

- [DriverStatusContext](app/(main)/driver/DriverStatusContext.tsx): `setInterval(update, 60000)` → refetch every 60s when on driver pages.
- [MenuLayout](components/Menu/MenuLayout.tsx): `setInterval(update, 1000)` → every 1s (likely for a clock or similar).
- [BillingManageClient](app/(main)/t/[slug]/manage/billing/BillingManageClient.tsx): `setInterval` for PayPal status.
- [CustomerTrackPushSetup](app/(main)/t/[slug]/track/[token]/CustomerTrackPushSetup.tsx): `setInterval` for token refresh.

If the user stays on a page that polls (e.g. driver dashboard or track page), that adds more API (and thus Clerk) calls over time.

---

## 7. Summary and recommended actions

| Priority | Issue | Recommendation |
|----------|--------|----------------|
| **P0** | Clerk `auth()` runs on **every** `/api/*` request | In middleware, skip `auth()` for public API routes (e.g. `/api/home/*`, `/api/countries`, `/api/cities`, `/api/contact`, `/api/menu` for public menu). Only call `auth()` when the path is a protected page or a protected API route. |
| **P1** | No request deduplication or caching | Introduce a data layer (e.g. SWR or React Query) for home/search and other high-traffic GET endpoints; use short stale-while-revalidate for public data. |
| **P1** | HeroBanner fetches banners twice (no city, then with city) | Fetch banners only when `isChosen && city` (or after a short delay) to avoid the first “no city” request, or reuse a single fetch with city in the dependency array. |
| **P2** | Many API routes use `cache: 'no-store'` or no cache | For public/read-only data (e.g. home tenants, categories, sections), allow short cache (e.g. 60s) or use `stale-while-revalidate` where freshness allows. |
| **P2** | Sanity: multiple fetches per route | Where possible, combine GROQ queries or use a single query with projections to reduce Sanity API calls per HTTP request. |
| **P3** | Polling (driver status, menu clock, etc.) | Keep intervals as-is for UX where needed; ensure those routes are protected so only authenticated users trigger them. |

Implementing **P0** (skip Clerk auth for public APIs) should immediately reduce Clerk API consumption for typical browsing (e.g. home + search + a few other pages) from dozens to a small number (e.g. one per page load for protected pages, zero for public pages and their public API calls). That alone can explain and fix most of the “200 APIs from a couple of pages” if the counter is Clerk.

---

## 8. Defining “public” API routes for middleware

To implement P0, define a allowlist or blocklist so middleware only runs `auth()` when needed.

**Public (skip auth):** e.g.

- `/api/home/*` (cities, banners, categories, sections, tenants, popular-products)
- `/api/countries`, `/api/cities`
- `/api/contact`
- `/api/menu` (public menu)
- `/api/geo`
- `/api/areas` (when used for public tenant areas)
- `/api/tenants/[slug]/track/*` (public tracking)
- Static/health if any

**Protected (run auth):** e.g.

- `/api/me/*`
- `/api/driver/*`
- `/api/admin/*`
- `/api/tenants/*` (except public track)
- `/api/orders` (create/update; may need to allow GET for public order status with token)
- `/api/reports`
- `/api/verify-phone/*`
- etc.

You can do:

- In middleware: `if (path.startsWith('/api/') && isPublicApiPath(path)) return nextWithPath(req)` **before** calling `auth()`, and implement `isPublicApiPath(path)` with the list above (and adjust for any new routes).

This keeps protection for sensitive routes while cutting Clerk usage on public traffic.

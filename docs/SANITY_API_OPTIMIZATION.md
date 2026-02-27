# Sanity API Consumption Investigation & Optimization

## Summary

Your project has used **80% of its monthly Sanity API quota**. This document identifies the main consumption sources and provides actionable optimizations that **preserve real-time updates** for Tenants, Drivers, and Customer Orders as required.

---

## 1. API Consumption Sources (by impact)

### 1.1 HIGH IMPACT: `/join` page – Homepage Stats Live

**Location:** `components/saas/HomePageStatsSection.tsx` → `/api/home-stats/live`

| Issue | Impact |
|-------|--------|
| **Listen subscription** | `client.listen('*[_type in ["order","tenant","driver"]]')` – subscribes to **ALL** orders, tenants, and drivers |
| **Per-change cascade** | Every order/tenant/driver change triggers `getHomePageStats()` |
| **getHomePageStats()** | 5 parallel API calls per trigger, including: |
| – | `*[_type == "order"]{ items[] { quantity } }` – **full scan of all orders** (very heavy as order count grows) |
| – | 4 other count/location queries |
| **Multiple viewers** | Each /join visitor keeps an SSE connection open → N viewers × 1 order change = N × 5 API calls |

**Result:** Public `/join` page, open to all visitors, creates Listen connections and heavy re-fetching on every document change.

**Recommendation:** Remove live updates from `/join` stats (not required for Tenants/Drivers/Orders). Use static stats with optional periodic refresh instead.

---

### 1.2 HIGH IMPACT: `loading.tsx` – Sanity fetch on every loading state

**Location:** `app/loading.tsx` (root loading)

| Issue | Impact |
|-------|--------|
| Uses `sanityFetch` | Triggers Sanity Live (Listen) on every loading skeleton |
| Runs on route transitions | Each navigation that shows loading triggers a fetch |
| Query | Restaurant info (logo, name) – rarely changes |

**Result:** Extra Listen usage on every navigation, even when the target page does not need it.

**Recommendation:** Use `client.fetch` (no Live) for loading state, or skip fetching and show a static placeholder.

---

### 1.3 MEDIUM IMPACT: SanityLive on all main routes

**Location:** `app/(main)/layout.tsx` – `<SanityLive />` renders for every route under `(main)`.

| Issue | Impact |
|-------|--------|
| Renders everywhere | Dashboard, onboarding, tenant pages, orders, analytics, join, homepage, etc. |
| sanityFetch usage | Dashboard, onboarding, tenant menu, orders, analytics, loading.tsx, `/api/menu` |
| Listen multiplexing | One shared connection, but still Listen usage for all queries on all pages |

**Result:** SanityLive/Live subscriptions run even on routes that don’t strictly need real-time (e.g. `/join`, homepage).

**Recommendation:** Only render SanityLive on layouts/pages that use `sanityFetch` and need real-time. Avoid it for `/join` and other public landing pages.

---

### 1.4 MEDIUM IMPACT: `getHomePageStats` query design

**Location:** `lib/home-stats.ts`

| Issue | Impact |
|-------|--------|
| `*[_type == "order"]{ items[] { quantity } }` | Fetches all orders and all line items to compute products sold |
| Grows with data | Cost grows with order count and items per order |

**Recommendation:** For products sold, consider:
- A `count()` + aggregation if Sanity supports it
- Or incremental counters stored on a tenant/global document, updated when orders are created/updated
- Or caching products-sold with a longer TTL and refreshing periodically

---

### 1.5 LOW–MEDIUM IMPACT: useCdn usage

**Current usage:**

| Context | useCdn | Notes |
|---------|--------|-------|
| Default client | true | Correct for read-only, cacheable data |
| Writes, live data | false | Correct for mutations and real-time reads |
| `getHomePageStats` | uses default (true) | Uses APICDN; issue is query volume, not CDN |

**Recommendation:** Keep `useCdn: false` where fresh data or mutations are needed. Continue using CDN for banners, categories, tenants, cities, and other read-only content.

---

## 2. Real-time features to KEEP

These use custom SSE + `client.listen()` and are important for Tenants, Drivers, and Orders:

| Route | Used by | Purpose |
|-------|---------|---------|
| `/api/tenants/[slug]/orders/live` | Tenant orders page | Order updates |
| `/api/driver/orders/live` | Driver orders page | Order list for drivers |
| `/api/driver/status/live` | Driver app | Driver status |
| `/api/tenants/[slug]/track/[token]/live` | Customer tracking | Order status for customer |
| `/api/tenants/[slug]/order/[orderId]/live` | Tenant order detail | Single order updates |
| `/api/tenants/[slug]/menu/live` | Tenant menu management | Menu changes |

**Action:** Keep all of these. They are scoped, authenticated, and only active when the user is on the relevant page.

---

## 3. Optimization Plan

### Phase 1: Quick wins (no real-time impact)

1. **Remove live updates from `/join` stats**
   - Replace SSE `/api/home-stats/live` with static stats from page load
   - Optionally add polling (e.g. every 60s) if you want some refresh

2. **Fix `loading.tsx`**
   - Use `client.fetch` instead of `sanityFetch` for restaurant info
   - Or remove the fetch and use a static loading UI

3. **Use CDN for `getHomePageStats`**
   - Ensure `getHomePageStats` uses default client (`useCdn: true`) – already does
   - If you keep live on /join, at least make initial load and any polling use CDN

### Phase 2: Structural changes

4. **Limit SanityLive scope**
   - Move `<SanityLive />` out of the root `(main)` layout
   - Render it only in layouts for: dashboard, onboarding, tenant pages, orders, analytics
   - Exclude: `/join`, `/`, `/sign-in`, `/sign-up`, and other public pages

5. **Optimize `getHomePageStats`**
   - Replace `*[_type == "order"]{ items[] { quantity } }` with a more efficient approach
   - Consider aggregate/cached values instead of full scans

### Phase 3: Advanced (if needed)

6. **Cache homepage stats**
   - Cache stats in Redis or in-memory (e.g. 60s TTL)
   - Reduces Sanity calls when multiple users view stats

7. **Debounce / batch Listen callbacks**
   - In `/api/home-stats/live` (if you keep it), debounce `getHomePageStats` on Listen events
   - Reduces bursts of 5× API calls when many documents change at once

---

## 4. Expected impact

| Change | API reduction (rough) | Real-time impact |
|--------|------------------------|------------------|
| Remove /join stats live | **High** (Listen + 5 fetches per change per viewer) | None – stats are not critical real-time |
| Fix loading.tsx | **Medium** (per navigation) | None |
| Limit SanityLive scope | **Medium** (no Listen on public pages) | None – dashboard/orders/etc. keep live |
| Optimize getHomePageStats query | **Medium** (if /join keeps polling or live) | None |

---

## 5. Sanity pricing context

- **API requests** – Standard fetch calls (CDN or non-CDN).
- **Listen API** – Persistent subscriptions; each active subscription contributes to usage.
- **APICDN** – Cached reads, usually cheaper than direct API.
- Many Listen subscriptions + heavy re-fetches on document change (e.g. `/join` stats) can dominate usage.

---

## 6. Implementation priority

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 1 | Remove live from /join stats; use static + optional polling | Low | High |
| 2 | Replace sanityFetch with client.fetch in loading.tsx | Low | Medium |
| 3 | Scope SanityLive to authenticated / real-time layouts | Medium | Medium |
| 4 | Optimize getHomePageStats query | Medium | Medium |

If you want, the next step is implementing Phase 1 (removing /join live and fixing loading.tsx) in the codebase.

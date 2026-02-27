# Sanity API Consumption – Estimate After Optimizations

## Plan context

- **Target quota:** 250,000 API requests/month (Growth plan)
- **Sanity API vs CDN:** Only requests to `api.sanity.io` count toward API quota; requests to `apicdn.sanity.io` (useCdn: true) count toward the separate 1M API CDN quota

---

## What counts as API requests (toward 250K)

| Request type | Endpoint | Counts? |
|--------------|----------|---------|
| `client.fetch` with `useCdn: false` | api.sanity.io | ✅ Yes |
| `client.fetch` with `useCdn: true` | apicdn.sanity.io | ❌ No (separate CDN quota) |
| Mutations (create, patch, delete) | api.sanity.io | ✅ Yes |
| Listen connections | api.sanity.io | Typically 1 request per connection setup; events are streamed |

Listen connections are limited (1k concurrent on Growth) but may still contribute to the API quota when established. Exact counting for Listen is not fully documented.

---

## Optimizations implemented (summary)

| Change | Impact |
|--------|--------|
| 1. Removed /join stats live SSE | No Listen on /join; no repeated getHomePageStats on every order/tenant/driver change |
| 2. loading.tsx: sanityFetch → client.fetch | No SanityLive on loading; uses CDN when useCdn: true |
| 3. ConditionalSanityLive scope | SanityLive only on /dashboard, /onboarding, /t/*, /orders, /order (excludes /, /join, /analytics, /manage/analytics, /manage/history, /driver/history) |
| 4. getHomePageStats: math::sum | Single aggregation instead of full order scan |
| 5. getHomePageStats 60s cache | Max 1 stats call per minute per server instance |

---

## Usage model – estimated monthly API calls

Assumptions (adjust for your traffic):

- ~5,000 unique visitors/month
- ~50 active tenants, ~20 drivers
- ~500 orders/month
- ~10 orders/day during peak

### 1. API requests (useCdn: false) – count toward 250K

| Source | Est. per event | Events/month | Est. API calls |
|--------|----------------|--------------|----------------|
| Order creation | ~3–5 fetches + 1 mutation | 500 orders | ~2,500 |
| Driver actions (accept/decline/complete) | ~2–4 fetches + 1 mutation each | ~400 actions | ~1,600 |
| Tenant order actions (assign, status) | ~3–5 fetches + mutation | ~300 actions | ~1,500 |
| Driver profile, location updates | ~2–3 fetches | ~200 | ~500 |
| Tenant menu/business updates | ~2–4 fetches | ~100 | ~300 |
| Push subscriptions, uploads | ~2 fetches | ~50 | ~100 |
| Other mutations (customer upsert, etc.) | 1–2 each | ~600 | ~900 |
| **Subtotal mutations + live reads** | | | **~7,400** |

### 2. Live Listen connections (SSE routes)

| Route | When active | Est. concurrent | Notes |
|-------|-------------|-----------------|-------|
| Tenant orders live | 1 per tenant on orders page | ~10 | Scoped |
| Driver orders live | 1 per driver on orders | ~5 | Scoped |
| Driver status live | 1 per driver app open | ~3 | Scoped |
| Order tracking (customer) | 1 per tracking page | ~2 | Short-lived |
| Order detail live | 1 per order detail view | ~3 | Scoped |
| Menu live | 1 per tenant on menu manage | ~2 | Scoped |
| **Total Listen** | | **~25** | Well under 1k limit |

Listen connections: setup likely counts as API requests; ongoing events are streamed and likely do not count per event. Assume ~1 API request per connection per 30 min (reconnect), so ~25 × 48 × 30 ≈ 36,000 if all connections reconnect every 30 min. That would be high. More realistic: initial connection + occasional reconnects, ~25 × 30 ≈ 750 API calls/month for Listen setup.

### 3. SanityLive (next-sanity live)

| Before | After |
|--------|-------|
| On every page (/, /join, /sign-in, etc.) | Only on /dashboard, /onboarding, /t/*, /orders, /order |
| ~80% of page loads | ~20–30% of page loads |

Assumption: ~1,500 page loads/month on live-enabled routes (dashboard, tenant, orders). SanityLive creates Listen subscriptions; estimate ~1–2 API calls per page load for setup. → ~1,500–3,000 API calls/month.

### 4. getHomePageStats (/join page load)

| Before | After |
|--------|-------|
| 1 Listen + 5 API calls on any order/tenant/driver change | 5 API calls on page load only |
| N viewers × (changes × 5) | 1 × 5 per page load, 60s cache |

Assumption: ~500 /join visits/month. With 60s cache: ~500 / 30 ≈ 17 uncached fetches. Each fetch: 5 API calls (useCdn: true → CDN). So no API calls if all use CDN. If any use useCdn: false: 17 × 5 = 85. `getHomePageStats` uses default client (useCdn: true) → 0 API calls.

### 5. loading.tsx

| Before | After |
|--------|-------|
| sanityFetch (SanityLive) on every loading state | client.fetch (useCdn: true) |
| Listen setup on many navigations | No Listen; CDN reads |

→ 0 API calls (CDN only).

### 6. Other direct API (useCdn: false) calls

- Driver orders, tenant orders, order tracking: need fresh data → useCdn: false.
- Writes: always API.

Rough split:

- Mutations: ~3,000/month
- Fresh reads (orders, driver status, etc.): ~8,000/month
- **Subtotal:** ~11,000 API calls

---

## Estimated total – after optimizations

| Category | Est. API calls/month |
|----------|----------------------|
| Mutations + fresh reads (orders, drivers, tenants) | ~11,000 |
| Listen connection setups (SSE + SanityLive) | ~2,500 |
| Miscellaneous (Studio, edge cases) | ~1,500 |
| **Total** | **~15,000** |

Buffer for spikes and unknowns: ×2 → **~30,000 API calls/month**.

---

## Before vs after (rough comparison)

| Scenario | Est. monthly API calls |
|----------|------------------------|
| Before (with /join live, SanityLive everywhere, heavy getHomePageStats) | ~80,000–150,000+ |
| After optimizations | ~15,000–30,000 |
| **250K quota headroom** | **~220K–235K** |

---

## Conclusion

Under these assumptions, the changes should:

1. Keep usage comfortably under 250K API calls/month (about 6–10% of quota).
2. Remove the main drivers of API usage: /join live Listen + repeated getHomePageStats.
3. Preserve real-time behavior where it matters: tenant orders, driver orders, customer tracking.

---

## Caveats

1. Traffic assumptions (visitors, orders, tenants, drivers) drive the numbers; adjust for your real traffic.
2. Sanity’s exact counting for Listen is not fully documented; Listen-related API usage could be higher than assumed.
3. Studio usage (editing, Vision, etc.) adds API calls and is not modeled in detail.
4. Growth spikes (marketing, seasonal events) can increase usage; consider monitoring and alerting.

---

## Monitoring

- Use [Sanity Manage → Usage](https://www.sanity.io/manage) to track API and CDN usage.
- Watch API request trends in the first 1–2 weeks after deploying these changes.
- If usage approaches 200K/month, consider:
  - Increasing `getHomePageStats` cache TTL (e.g. 5–10 minutes)
  - Further limiting SanityLive to fewer routes
  - Caching more read-heavy endpoints

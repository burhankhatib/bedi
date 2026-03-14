# Sanity API & CDN Caching Research

Goal: Reduce Sanity API consumption by using CDN where possible, while keeping real-time updates where needed.

## Summary

| Area | Current | Recommendation |
|------|---------|----------------|
| **Home APIs** (sections, categories, tenants, search, popular-products) | `client` (CDN) | ✅ Already CDN. Add revalidate/cache headers. |
| **Menu page** (`/t/[slug]`) | `client` + revalidate 60 | ✅ Good |
| **Menu API** (`/api/menu`) | `client` + revalidate 60 | ✅ Good |
| **Business Dashboard** (products, categories, business, subscription) | Mixed; some no-CDN | ✅ Already enhanced with refresh param |
| **Tenant areas** (delivery zones) | `clientNoCdn` | Switch to CDN + refresh param |
| **Menu section suggestions** | `freshClient` (no CDN) | Switch to CDN (static reference data) |
| **Business subcategories** | `freshClient` (no CDN) | Switch to CDN (static reference data) |
| **Orders count** (nav badge) | noCacheClient | ✅ Must stay real-time |
| **Tables** | clientNoCdn | Add refresh param, use CDN by default |
| **Catalog products** | `client` | ✅ Already CDN |
| **Tenant lookups** | Many use `useCdn: false` | Review: use CDN for display-only |

## High-Traffic Routes (Customer-Facing)

### Already Optimized
- **api/home/sections** – `client.fetch`, `revalidate: 60` (Next.js caches per URL for 60s)
- **api/home/categories** – `client.fetch`, `revalidate: 60`
- **api/home/tenants** – `client.fetch`, `revalidate: 60`
- **api/home/search** – `client.fetch`
- **api/home/popular-products** – `client.fetch`
- **api/menu** – `client.fetch`, `revalidate: 60`
- **app/(main)/t/[slug]** – `client.fetch`, `revalidate: 60`

### Implemented (this session)
- **api/home/sections** & **api/home/categories** – Switched from `force-dynamic` to `revalidate: 60`
- **api/tenants/[slug]/areas** GET – Switched to CDN by default; `?refresh=1` for fresh data

## Dashboard & Management Routes

### Already Enhanced (previous session)
- products GET, categories GET, business GET, subscription GET – CDN by default, `?refresh=1` for fresh

### Implemented (this session)
- **api/tenants/[slug]/areas** GET – CDN by default, `?refresh=1` for fresh
- **api/tenants/[slug]/tables** GET – CDN by default, `?refresh=1` for fresh
- **api/tenants/[slug]/menu-section-suggestions** – Uses CDN, `revalidate: 300`
- **api/business-subcategories** – Uses CDN, `revalidate: 300`

## Must Stay Real-Time (no CDN)

- **api/tenants/[slug]/orders/count** – New orders badge
- **api/tenants/[slug]/orders** (list, history, by-phone, by-table) – Live order data
- **Orders page** – Live order list
- **auth/tenant lookup** when checking subscription expiry, permissions
- **Write operations** – All use writeClient (no CDN)

## getTenantBySlug Usage

Default uses CDN. Many call with `useCdn: false`:
- **Keep no-CDN**: manage layout (past_due check), billing (display), products (limit), staff/tables (plan check)
- **Could use CDN**: delivery-price (if not time-sensitive), some read-only lookups

## Cache Headers Strategy

- **CDN reads**: `Cache-Control: s-maxage=60, stale-while-revalidate=120`
- **Fresh reads** (refresh=1): `Cache-Control: no-store`
- **Real-time**: `Cache-Control: no-store` (orders count, etc.)

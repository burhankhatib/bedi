# API Requests per Single Delivery Order

This document estimates how many **API requests** your app consumes for **one delivery order** across the three actors: **tenant/business**, **customer**, and **driver**. It is based on the current codebase (polling intervals, SSE, and order flow).

---

## Summary (one delivery, typical path)

| Actor | Action-only requests | Live updates (SSE only) | Total (example) |
|-------|----------------------|--------------------------|-----------------|
| **Customer** | 1 (create) | 1 initial + 1 SSE + ~6 refetches on status change | **~8** (track page: SSE-driven only) |
| **Tenant** | 2–3 (ack + request or assign) | 1 initial (SSR) + 1 SSE; refetch only on event | **2–3** attributable |
| **Driver** | 2–3 (accept + complete + refresh GETs) | 1 initial + 1 SSE; refetch only on event | **~5** attributable |

- **Attributable “action” requests per order:** about **8–10** (create, ack, request/assign, accept, complete, plus a few list refreshes).
- **Customer track page:** no polling; one SSE connection per track page. Refetch only when the order document changes (~6 status steps). New orders appear **instantly** for tenant and driver via SSE.

---

## 1. Customer

### 1.1 Placing the order

| Endpoint | Method | Count |
|----------|--------|--------|
| `/api/orders` | POST | **1** |

- Single request to create the order (and upsert customer in Sanity).
- Used from: `CartSlider`, `CartDrawer`, `OrderContent`, etc.

### 1.2 Tracking the order (track page)

Two track entry points:

- **Token-based:** `/t/[slug]/track/[token]` → `GET /api/tenants/[slug]/track/[token]` and SSE `.../track/[token]/live`.
- **Order ID + phone:** `/t/[slug]/order/[orderId]?phone=...` → `GET /api/tenants/[slug]/order/[orderId]/track?phone=...` and SSE `.../order/[orderId]/live?phone=...`.

Behavior (same for both):

- **Initial load:** 1 × GET track.
- **SSE only:** 1 × GET to the `.../live` URL (long-lived EventSource). Each server-sent event triggers a **refetch** of the track URL (1 GET per status change). No polling.

So for one order, while the **customer has the track page open**:

| Request | Count |
|---------|--------|
| GET track (initial) | 1 |
| GET .../live (SSE connection) | 1 |
| GET track (on each status change) | ~6 (new → preparing → waiting_for_delivery → driver_on_the_way → out-for-delivery → completed) |

Example: **~8** requests from the customer for that one order’s tracking (1 + 1 + 6).

Optional (not counted above):

- `GET/POST .../track/[token]/push-subscription` if the customer enables push on the track page.

---

## 2. Tenant / Business

### 2.1 Orders list (shared across all orders)

- **Initial load:** Orders are fetched **server-side** in `app/(main)/t/[slug]/orders/page.tsx` (Sanity direct), plus one client `fetchOrders()` on mount.
- **Client:** `TenantOrdersLive` uses **SSE only** (no polling): `GET /api/tenants/[slug]/orders/live`. Each Sanity order change triggers one refetch via `fetchOrders`, so **new orders appear instantly**.

### 2.2 Actions attributable to this one order

| Endpoint | Method | When | Count |
|----------|--------|------|--------|
| `/api/tenants/[slug]/orders/status` | PATCH | Acknowledge new order (new → preparing) | **1** |
| `/api/tenants/[slug]/orders/request-driver` | POST | “Request delivery” (broadcast to drivers) | **0 or 1** |
| `/api/tenants/[slug]/orders/assign-driver` | PATCH | Manually assign a driver | **0 or 1** |
| `/api/tenants/[slug]/orders/update-items` | PATCH | Edit items (optional) | 0 or 1 |
| `/api/tenants/[slug]/orders/unassign-driver` | POST | Unassign (optional) | 0 or 1 |

Typical path: **1 PATCH (ack) + 1 POST (request-driver)** or **1 PATCH (ack) + 1 PATCH (assign-driver)** → **2–3** requests per order.

---

## 3. Driver

### 3.1 Orders list (shared across all orders)

- **Client:** `app/(main)/driver/orders/page.tsx` uses **SSE only** (no polling): initial `GET /api/driver/orders` on mount, then `GET /api/driver/orders/live`. Each delivery order change triggers one refetch, so **new orders appear instantly**.

### 3.2 Actions attributable to this one order

| Endpoint | Method | When | Count |
|----------|--------|------|--------|
| `/api/driver/orders/[orderId]/accept` | POST | Accept delivery | **1** |
| `/api/driver/orders/[orderId]/complete` | POST | Mark delivered | **1** |
| `/api/driver/orders/[orderId]/decline` | POST | Decline (optional) | 0 or 1 |
| `/api/driver/orders/[orderId]/cancel` | POST | Cancel after accept (optional) | 0 or 1 |
| `/api/driver/orders/[orderId]/reconfirm` | POST | Reconfirm after items change (optional) | 0 or 1 |

After **accept** and **complete**, the client calls `fetchOrders()` (and a couple of timeouts), so **~2–3 extra GETs** to `/api/driver/orders` are attributable to this order’s lifecycle.

So: **2 POSTs (accept + complete) + ~3 GETs (list refresh)** ≈ **5** requests attributable to this order.

### 3.3 Other driver APIs (not per order)

- Push: `/api/driver/push-subscription`, `/api/driver/push-send-welcome`, `/api/driver/push-send-offline-reminder` — **per session**.  
- **Driver location API removed** (was unused in PWA).

---

## 4. Total per delivery order (rounded)

- **Typical total:**  
  - Customer: 1 (create) + ~8 (track page: initial + SSE + refetches on status change)  
  - Tenant: 2 (ack + request or assign)  
  - Driver: 2 (accept + complete) + ~3 (list GETs)  
  → **~16–18** API requests for one delivery (no polling; SSE-only updates).

- **If tenant and driver have their dashboards open:**  
  - One SSE connection each; refetch only when Sanity order data changes. New orders show **instantly** when the document is created/updated.

---

## 5. Where the numbers come from (code references)

| Behavior | Location |
|----------|----------|
| Create order | `POST /api/orders` — `app/api/orders/route.ts`, `components/Cart/CartSlider.tsx`, `CartDrawer.tsx` |
| Customer track (SSE only) | `app/(main)/t/[slug]/track/[token]/OrderTrackClient.tsx`, `order/[orderId]/OrderTrackClient.tsx` — `useSanityLiveStream` → `GET .../track/[token]/live` or `.../order/[orderId]/live` |
| Tenant orders (SSE only) | `app/(main)/t/[slug]/orders/TenantOrdersLive.tsx` — `useSanityLiveStream` → `GET /api/tenants/[slug]/orders/live`; initial fetch on mount |
| Tenant ack / status | `OrderNotificationsWrapper` → PATCH `.../orders/status`; `OrdersClient` → same for manual status |
| Tenant request/assign | `OrderDetailsModal` → `request-driver`, `assign-driver` |
| Driver orders (SSE only) | `app/(main)/driver/orders/page.tsx` — `useSanityLiveStream` → `GET /api/driver/orders/live`; initial fetch on mount |
| Driver accept/complete | Same file → POST `.../orders/[orderId]/accept`, `.../complete` |

---

## 6. SSE-only updates (current behavior)

- **Customer track:** No polling. One SSE connection per track page; refetch only when the order document changes in Sanity.
- **Tenant/Driver lists:** No polling. One SSE connection each; refetch only on order changes. New orders appear **instantly** when created/updated in Sanity.
- **Server:** SSE endpoints (`.../orders/live`, `.../track/.../live`) use Sanity `listen()` so one connection replaces repeated GETs; clients refetch only when data actually changes.

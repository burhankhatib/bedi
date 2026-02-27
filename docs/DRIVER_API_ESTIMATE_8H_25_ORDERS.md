# Driver API consumption estimate (8h online, 25 orders)

**Scenario:** One driver is **online for 8 hours** and **receives an average of 25 orders** (20 accept + complete, 5 decline). No polling; status and orders use **event-driven SSE** (fetch only when Sanity data changes).

**Optimizations applied:**
- **Status:** No polling; fetch on mount, window focus, and when driver doc changes (SSE).
- **Orders live:** Scoped to this driver (new delivery requests + orders assigned to them); no events for other drivers’ orders. Debounce 700ms so rapid changes = 1 fetch.
- **After actions:** No extra fetch after accept/decline/complete/cancel/reconfirm; live stream refetches when Sanity order doc updates.

---

## 1. Next.js API requests (per driver, 8h session)

| Source | Requests | Notes |
|--------|----------|--------|
| **Status** | | |
| GET /api/driver/status | ~10 | 1 on mount + ~8 on focus + ~1 when SSE fires (e.g. auto-offline at 8h) |
| GET /api/driver/status/live | 1 | One SSE connection |
| PATCH /api/driver/status | 0–1 | Toggle online at start |
| **Orders** | | |
| GET /api/driver/orders | ~1 + E | 1 on mount + E from live (scoped + debounced). E ≈ 25 new + 20 accept + 20 complete + 5 decline = 70 events → debounced to ~25–40 fetches |
| GET /api/driver/orders/live | 1 | One SSE (scoped to this driver) |
| POST …/accept | 20 | |
| POST …/decline | 5 | |
| POST …/complete | 20 | |
| **Profile & push** | 4–5 | Profile ×2, push-subscription, welcome |

**Total Next.js API: ~85–110 requests** per driver per 8h (25 orders) — down from ~220–235.

---

## 2. Sanity API operations (per driver, 8h session)

| Source | Reads | Writes | Notes |
|--------|-------|--------|--------|
| **Status** | ~22 | 1 | GET + auto-offline + Listen |
| **Orders list** | ~60–90 | — | ~25–40 GET × 2 (driver + orders) |
| **Orders live** | 1 + 1 | — | 1 read for driverId on connect; 1 Listen (scoped) |
| **Order actions** | 110 | 45 | Accept 60+20, decline 10+5, complete 40+20 |
| **Profile & push** | ~6 | 1 | |

**Total Sanity (approx.):** **~200–230 reads**, **~47 writes**, **~250–280 operations** per driver per 8h (25 orders) — down from ~500–520.

---

## 3. Summary (per driver, 8h online, 25 orders)

| Metric | Before | After |
|--------|--------|--------|
| **Next.js API requests** | ~220–235 | **~85–110** |
| **Sanity API total** | ~500–520 | **~250–280** |

---

## 4. Notes

- **Orders live** listens to *all* delivery orders. If other orders in the system change, this driver gets more events and more GET /api/driver/orders. The estimate assumes most events are from this driver’s 25 orders.
- **Accept** triggers 3× `fetchOrders()` in the client (immediate + 400ms + 1200ms), which increases GET /api/driver/orders and thus Sanity reads.
- **Status** uses no polling; only mount, focus, and SSE (driver doc change), so status stays low.
- Scaling: **~65 Sanity operations per order** on average (500 ÷ 25 ≈ 20 reads + ~2 writes per order from orders list + actions).

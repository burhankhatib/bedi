# Auto Delivery Request — Feature Plan

## Overview

When a new delivery order arrives, the tenant sees it on the dashboard. Currently, the tenant must manually click **Request Delivery** to notify drivers. This plan adds:

1. **Auto Delivery Request** — A dropdown to set preparation time (default 20 min). When the timer ends, the system automatically triggers a delivery request.
2. **Save my choice** — Tenant preference persisted for future orders.
3. **Manual override** — Tenant can still trigger delivery request early.
4. **Tenant notification** — Notify tenant when auto-request fires.

---

## Current Architecture (Relevant Parts)

| Component | Location | Purpose |
|-----------|----------|---------|
| Order cards | `OrdersClient.tsx`, `TenantOrdersLive.tsx` | Display orders; Request Delivery button |
| Order details modal | `OrderDetailsModal.tsx` | Full order view; Request Delivery, driver assignment |
| Request driver API | `POST /api/tenants/[slug]/orders/request-driver` | Sets `deliveryRequestedAt`, calls `notifyDriversOfDeliveryOrder()` |
| Driver notification | `lib/notify-drivers-for-order.ts` | FCM/Web Push to online drivers in same city |
| Order schema | `sanity/schemaTypes/order.ts` | `deliveryRequestedAt`, `status`, etc. |
| Tenant schema | `sanity/schemaTypes/tenant.ts` | `supportsDriverPickup` (auto-dispatch for new orders) |
| Cron | `retry-delivery-requests` (every 3 min) | Re-pings drivers for orders waiting > 3 min |

---

## Data Model Changes

### 1. Order Document (Sanity)

Add fields to `order`:

```groq
# New fields
autoDeliveryRequestMinutes: number    # 0 = immediately, 5, 10, 15, 20 (default), 25, 30, 35, 40
autoDeliveryRequestScheduledAt: datetime  # When tenant set the timer (order acknowledged time + minutes)
autoDeliveryRequestTriggeredAt: datetime  # When system actually fired; null until triggered
```

- `autoDeliveryRequestMinutes`: null/undefined = None (no auto-request), 0 = Immediately, 5, 10, 15, 20, 25, 30, 35, 40
- `autoDeliveryRequestScheduledAt`: Computed when tenant picks a time (e.g. acknowledgedAt + 20 min)
- `autoDeliveryRequestTriggeredAt`: Set when cron or manual request fires; used to avoid duplicate triggers

### 2. Tenant Document (Sanity)

Add fields:

```groq
# Per-tenant preference
defaultAutoDeliveryRequestMinutes: number | null   # null = None, 0 = immediately, 5–40 min. Default 20 when feature used (first option in UI).
saveAutoDeliveryRequestPreference: boolean  # "Save my choice for future orders"
```

---

## UI Changes

### 1. Order Card (Delivery orders, status: new / acknowledged / preparing)

**Location:** `OrdersClient.tsx` (grid + table views) and `OrderDetailsModal.tsx`

**Current:** "Request Delivery" button + "Assign driver" dropdown.

**New:** Add an **Auto Delivery Request** section when the order has no driver yet, in a prominent **M3-style visual box** with a subtle pulse to draw the tenant's attention:

```
╔═══════════════════════════════════════════════════════════════╗
║  ◉ Auto Delivery Request                    [pulse highlight] ║
║  ┌─────────────────────────────────────────────────────────┐  ║
║  │ [Dropdown: 20 minutes (default) | None | Immediately |   │  ║
║  │  5 | 10 | 15 | 25 | 30 | 35 | 40 minutes]               │  ║
║  └─────────────────────────────────────────────────────────┘  ║
║  ☐ Save my choice for future orders                           ║
║                                                               ║
║  [Request Delivery Now]  [Assign Driver ▼]                    ║
║  (When countdown active: [Stop countdown] — full card only)    ║
╚═══════════════════════════════════════════════════════════════╝
```

- **Default first option:** 20 minutes (pre-selected when tenant has no saved preference)
- **Dropdown order:** 20 min (first/default), None, Immediately, 5, 10, 15, 25, 30, 35, 40
- **Save my choice:** When checked + Apply/Save, PATCH tenant with `defaultAutoDeliveryRequestMinutes` and `saveAutoDeliveryRequestPreference`
- **Request Delivery Now:** Same as current manual Request Delivery (override)
- **Stop countdown:** On the full card (OrderDetailsModal), tenant can cancel the scheduled auto-request if they need more preparation time
- Show a countdown or "Request in X min" when auto is scheduled

#### Visual design (Material Design 3 + pulse)

- **Container:** M3 surface container (e.g. `bg-primary-container` or tonal surface), 8dp grid spacing, rounded corners (12dp–16dp), subtle border
- **Pulse animation:** Use Motion Pro (`motion/react`):
  - Subtle `animate` on `opacity` and/or `boxShadow` (e.g. ring glow) with a gentle, looping pulse (2–3s duration)
  - M3 Standard Easing (cubic-bezier) ~200–300ms for interactions
  - Example: `animate={{ boxShadow: ['0 0 0 0 rgba(primary, 0)', '0 0 0 8px rgba(primary, 0.15)'] }}` + `transition={{ repeat: Infinity, duration: 2 }}`
- **Visibility:** The box should stand out as a clear call-to-action for new orders; pulse draws eye without being distracting

### 2. Order Details Modal (Full Card)

Same **Auto Delivery Request** section in the delivery step (Step 3: Request/Assign), in the same M3-style box with pulse. When tenant opens an order:
- **Default:** 20 minutes (first option) if tenant has no saved preference
- Load tenant's `defaultAutoDeliveryRequestMinutes` if `saveAutoDeliveryRequestPreference` is true
- Pre-fill dropdown for this order
- Allow per-order override
- **Stop countdown:** When an auto-request is scheduled (countdown running), show a **Stop countdown** / **Cancel auto-request** button. On click: clear `autoDeliveryRequestScheduledAt` and `autoDeliveryRequestMinutes` for this order. Tenant can then set a new time if needed, or use manual Request Delivery when ready.

### 3. Tenant Notification When Auto-Request Fires

- Use existing tenant push (FCM / Web Push) for new orders
- Add a dedicated notification: "Delivery request sent! Drivers in your area have been notified for Order #XXXX."
- Can reuse `sendTenantAndStaffPush` or a variant in `lib/notify-drivers-for-order.ts` or a new helper

---

## Backend Logic

### 1. New API: PATCH Order — Set Auto Delivery Request

**Endpoint:** `PATCH /api/tenants/[slug]/orders/[orderId]/auto-delivery-request`

**Body:**
```json
{
  "minutes": 20,    // null = None (disable auto-request)
  "savePreference": true
}
```

**Behavior:**
- Validate order is delivery, not cancelled, no driver yet
- If `minutes === null`: Clear `autoDeliveryRequestMinutes`, `autoDeliveryRequestScheduledAt` (tenant opts out or stops countdown)
- Else: Compute `autoDeliveryRequestScheduledAt = now + minutes` (or now if 0)
- Set `autoDeliveryRequestMinutes`, `autoDeliveryRequestScheduledAt` on order
- If `savePreference`, PATCH tenant with `defaultAutoDeliveryRequestMinutes`, `saveAutoDeliveryRequestPreference`

**Stop countdown:** Same endpoint with `minutes: null` clears the schedule. Call from full card when tenant taps "Stop countdown".

### 2. New Cron: Auto Delivery Request Trigger

**Path:** `/api/cron/auto-delivery-request`

**Schedule:** Every minute (`* * * * *` in `vercel.json`)

**Logic:**
```txt
1. Query orders where:
   - orderType == "delivery"
   - status in ["new", "acknowledged", "preparing", "waiting_for_delivery"]
   - !assignedDriver
   - defined(autoDeliveryRequestScheduledAt)   // Excludes "None" (tenant's own drivers or no auto)
   - autoDeliveryRequestScheduledAt <= now
   - !autoDeliveryRequestTriggeredAt

2. For each order:
   a. Call existing request-driver logic (set deliveryRequestedAt, notifyDriversOfDeliveryOrder)
   b. Set autoDeliveryRequestTriggeredAt = now
   c. Notify tenant: "Delivery request sent for Order #XXXX"
```

### 3. Tenant Notification on Auto-Trigger

- Reuse `sendTenantAndStaffPush` or equivalent
- Payload: title "Delivery Request Sent", body "Order #XXXX — Drivers have been notified."

---

## Flow Summary

```
1. New delivery order placed
2. Tenant opens dashboard, sees order
3. Tenant (optionally) sets Auto Delivery Request: "20 minutes" + ☐ Save my choice
4. If Save: Tenant document updated; future orders pre-fill 20 min
5. System waits until autoDeliveryRequestScheduledAt
6. Cron runs every minute, finds orders where scheduledAt <= now
7. Cron: sets deliveryRequestedAt, calls notifyDriversOfDeliveryOrder, sets autoDeliveryRequestTriggeredAt
8. Cron: sends push to tenant "Delivery request sent for Order #XXXX"
9. Tenant can at any time click "Request Delivery Now" to override (manual)
10. Tenant can click "Stop countdown" on the full card to cancel the auto-request if they need more preparation time; they can then set a new time or request manually when ready
```

---

## Default & Options

- **Default first option:** 20 minutes — pre-selected when tenant has no saved preference; displayed first in dropdown
- **None** = Tenant does not use auto delivery request (e.g. has own drivers, or prefers full manual control)
- When **None** is selected: `autoDeliveryRequestMinutes` = null, `autoDeliveryRequestScheduledAt` = null. Cron will never pick up the order
- Tenant can still use **Request Delivery Now** or **Assign Driver** manually

## Visual Design (M3 + Pulse)

- **Material Design 3:** Use M3 surface containers, 8dp grid, standard easing (200–300ms)
- **Pulse transition:** Subtle looping pulse on the Auto Delivery Request box (e.g. ring/glow) via `motion/react` to make it visible without being distracting
- **Implementation:** `motion.div` with `animate` + `transition={{ repeat: Infinity, duration: 2 }}` on `boxShadow` or `opacity`

---

## Enhancements to Consider

| Enhancement | Description |
|-------------|-------------|
| **Visual countdown** | Show "Request in 18 min" or a progress bar on the card |
| **Pulse stop after interaction** | Stop pulse animation once tenant has interacted (selected an option) |
| **Per-order override** | Allow changing minutes after first set (e.g. "I need more time") |
| **Scheduled orders** | For scheduled delivery orders, compute auto-request relative to `scheduledFor` (e.g. 20 min before scheduled time) |
| **Driver pickup stores** | For `supportsDriverPickup` tenants, optionally still show Auto Delivery Request for tuning (e.g. delay before first ping) |
| **Audit log** | Store `autoDeliveryRequestTriggeredAt` for analytics |
| **Undo / cancel auto** | "Stop countdown" / "Cancel auto request" on full card — tenant can stop if they need more prep time (implemented in plan) |
| **Sound** | Option to play sound when auto-request fires (like new order) |

---

## Files to Create/Modify

### Create
- `app/api/tenants/[slug]/orders/[orderId]/auto-delivery-request/route.ts` — PATCH to set minutes + save preference
- `app/api/cron/auto-delivery-request/route.ts` — Cron to trigger delivery requests
- `sanity/schemaTypes/order.ts` — Add `autoDeliveryRequestMinutes`, `autoDeliveryRequestScheduledAt`, `autoDeliveryRequestTriggeredAt`
- `sanity/schemaTypes/tenant.ts` — Add `defaultAutoDeliveryRequestMinutes`, `saveAutoDeliveryRequestPreference`

### Modify
- `app/(main)/orders/OrdersClient.tsx` — Add Auto Delivery Request UI on order cards (M3 box + pulse)
- `components/Orders/OrderDetailsModal.tsx` — Add Auto Delivery Request section (M3 box + pulse)
- `app/(main)/t/[slug]/orders/TenantOrdersLive.tsx` — Pass through to OrdersClient (if needed)
- `vercel.json` — Add cron `auto-delivery-request` every minute
- `lib/notify-drivers-for-order.ts` or new helper — Notify tenant when auto-request fires
- `app/api/tenants/[slug]/orders/route.ts` — Include new order fields in fetch
- `app/api/tenants/[slug]/orders/request-driver/route.ts` — Optionally set `autoDeliveryRequestTriggeredAt` when manual (to avoid cron re-triggering; actually manual doesn't set scheduledAt so cron won't pick it up)

---

## Edge Cases

1. **Order acknowledged before auto fires** — If tenant acknowledges (new → preparing) and minutes = 20, `autoDeliveryRequestScheduledAt` is computed from when they set it (or from acknowledgedAt if we change logic).
2. **Manual request before auto** — Manual request sets `deliveryRequestedAt`; we should set `autoDeliveryRequestTriggeredAt` on manual too so cron doesn't re-process. Or: cron only processes orders with `autoDeliveryRequestScheduledAt` set and `!autoDeliveryRequestTriggeredAt`; manual request doesn't set `autoDeliveryRequestScheduledAt`, so no conflict.
3. **Driver assigned before auto** — Order won't match cron query (assignedDriver exists).
4. **Order cancelled** — Exclude from cron.
5. **Immediately (0 min)** — `autoDeliveryRequestScheduledAt = now`; next cron run (within 1 min) will pick it up. Or: trigger synchronously when tenant selects "Immediately" (call request-driver from client).

---

## Implementation Order

1. Schema (order + tenant)
2. PATCH API for setting auto-delivery-request
3. Cron job for auto-trigger
4. Tenant notification when auto fires
5. UI on order cards (OrdersClient)
6. UI in OrderDetailsModal
7. Fetch tenant preference on load, pre-fill dropdown
8. "Save my choice" persistence

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Schema + migrations | 0.5 day |
| PATCH API | 0.5 day |
| Cron + tenant notify | 0.5 day |
| UI (cards + modal) | 1 day |
| Save preference + pre-fill | 0.5 day |
| Testing + edge cases | 0.5 day |
| **Total** | **~3.5 days** |

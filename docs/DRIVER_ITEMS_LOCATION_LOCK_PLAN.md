# Driver Order Items — Location-Based Lock (Safety Procedure)

## Constraint & Stack

- **Pusher:** Yes. The project uses Pusher for real-time events. Use Pusher (not Sanity) for delivery of "items unlocked" and location/arrival signals.
- **Sanity:** Do **not** use any Sanity APIs for this feature. All logic, persistence, and data access must go through a non-Sanity backend (e.g. your own API/database, Firebase, Supabase, or data passed via request/context).

---

## Overview

Force drivers to be physically at the business location before they can view order items. This prevents drivers from purchasing the same items from a nearby business that is not part of the platform, ensuring honesty and that the customer’s chosen business is honored.

---

## Goals

1. **Lock items until driver is at business** — Driver cannot view order items until within 50m of the business (using `tenant.locationLat` / `locationLng`).
2. **Clear visual state** — Grayed-out button with "Order's list locked" and explanatory message.
3. **FCM on arrival** — When the driver enters the 50m radius, send an FCM push: "You can now view the items in the order because you have reached [Business Name]."
4. **Server-side enforcement** — APIs must not return items when the driver is outside the radius (client cannot bypass).

---

## Current Architecture (Reference Only)

| Component | Purpose |
|-----------|---------|
| Order items API | Returns orders with `items` array |
| Full menu API | Browse menu for replacements |
| Items update API | Save picked/edited items |
| Driver location | Receives `lat`, `lng`; persists somewhere (must use non-Sanity store) |
| Driver UI | `DriverOrdersV2.tsx` — "Order Details" button expands items panel |
| Pusher | `triggerPusherEvent(channel, event, data)` — use for real-time "items-unlocked", etc. |

---

## Data Model (Non-Sanity)

Store **driver arrival at business** in your backend (e.g. PostgreSQL, Firebase):

- **Table/key:** e.g. `order_driver_arrival` or `driver_arrived_at_business_{orderId}`
- **Fields:** `orderId`, `driverId`, `arrivedAt` (datetime)
- **Purpose:** Send FCM only once per order; optionally show "unlocked at" in UI.

---

## Radius and Distance

- **Radius:** 50 meters.
- **Conversion:** 50m ≈ 0.05 km. Use `distanceKm()` from `lib/maps-utils.ts`.
- **Check:** `distanceKm(driverLocation, businessLocation) <= 0.05` → driver is at business.

---

## API Changes (Non-Sanity Data Layer)

All reads/writes for driver location, order/business data, and arrival state must use your non-Sanity backend. Example flow:

### 1. GET /api/driver/orders (or your equivalent)

- For each order in `driver_on_the_way` (or `preparing` if driver is assigned):
  - Get driver location from your backend (not Sanity).
  - Get business location from your orders/tenants data (not Sanity).
  - If business has no location: treat as unlocked (fallback).
  - If `distanceKm(driver, business) <= 0.05`: return full `items` and `itemsLocked: false`.
  - Else: return `items: []` and `itemsLocked: true`, `itemsLockedBusinessName: businessName`.

### 2. GET /api/driver/orders/[orderId]/full-menu

- Get driver location and business location from your backend.
- If `distanceKm > 0.05`: return `403` with `{ error: 'You must be at [Business Name] to view the menu.' }`.

### 3. PATCH /api/driver/orders/[orderId]/items

- Same distance check using your backend.
- If `distanceKm > 0.05`: return `403` with `{ error: 'You must be at [Business Name] to update items.' }`.

### 4. POST /api/driver/location — Pusher + FCM on arrival

When the driver submits a new location:

1. Persist `lat`, `lng`, `lastLocationAt` in your backend (not Sanity).
2. For each active order in `driver_on_the_way` assigned to this driver:
   - Get business location from your backend.
   - Compute `distanceKm(newLocation, businessLocation)`.
   - If `distance <= 0.05` and not already recorded in your `order_driver_arrival` (or equivalent):
     - Store arrival in your backend.
     - **Trigger Pusher:** `triggerPusherEvent('private-driver-orders', 'items-unlocked', { orderId, businessName })` so the open driver app can refresh immediately.
     - **Send FCM to driver:** "يمكنك الآن عرض عناصر الطلب لأنك وصلت إلى [Business Name]."
     - **Send FCM to customer:** `sendCustomerOrderStatusPush({ orderId, newStatus: 'driver_arrived_at_business' })` — see below.

---

## UI Changes

### DriverOrdersV2 — Order Details Button

**Current:** Button shows "Order Details" / "Hide order details" when `(o.items?.length ?? 0) > 0`.

**New logic:**

- When `itemsLocked === true`:
  - Render a **disabled** (grayed-out) button.
  - **Button label:** "Order's list locked"
  - **Subtitle below:** "You have to be at [Business Name] to be able to view the items you need to collect."
  - Use M3 surface-variant or error surface for the locked state.
- When `itemsLocked === false`:
  - Show the usual "Order Details" / "Hide order details" button.
  - Expand to show items as today.

**Visual spec (locked state):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  [🔒] Order's list locked                                            │
│       (grayed out, disabled, no hover effect)                       │
│                                                                      │
│  You have to be at [Business Name] to be able to view the items      │
│  you need to collect.                                                │
└─────────────────────────────────────────────────────────────────────┘
```

- Use `opacity-60` or `bg-slate-700/50` for the disabled state.
- Icon: Lock (e.g. from `lucide-react`).

### Active Order Panel (driver_on_the_way)

The same locked/unlocked logic applies when the active order is in the “pickup” phase. The "Order Details" button in the active-order card must also show the locked state when `itemsLocked` is true.

---

## FCM Push Payloads

**Note:** All FCM notifications are sent in Arabic.

### Driver (on arrival at business)

- **Title (ar):** "تم فتح العناصر"
- **Body (ar):** "يمكنك الآن عرض عناصر الطلب لأنك وصلت إلى [Business Name]."
- **URL:** `/driver/orders`

### Customer (on driver arrival at business)

- **Trigger:** When driver first enters 50m of business.
- **Title (ar):** "وصل السائق إلى المتجر"
- **Body (ar):** "السائق [nickname] وصل إلى [Business Name]."
- **URL:** `/t/[slug]/track/[token]` (customer track page)
- **Implementation:** Add `driver_arrived_at_business` to `sendCustomerOrderStatusPush` in `lib/customer-order-push.ts`. Use `assignedDriverName` (nickname) and business name. All text in Arabic.

---

## Edge Cases

| Case | Handling |
|------|----------|
| Business has no location | Treat as unlocked (legacy tenants). Log a warning so they can add location. |
| Driver has no location yet | Treat as locked. Items stay hidden until first location update. |
| `lastLocationAt` is stale | Use last known location. Driver may need to open app / move to refresh. |
| Order in `out-for-delivery` | Items already picked; no need to lock. Consider always unlocked after `driverPickedUpAt`. |
| Multiple orders | Each order checked against its own business location. |
| Driver uses mock location | Server uses `lastKnownLat/Lng` from DB; client cannot override. GPS spoofing would require device-level compromise. |

---

## When to Lock vs Unlock

- **Lock:** Order status is `driver_on_the_way` (or `preparing` with assigned driver) and driver is > 50m from business.
- **Unlock:** Driver is ≤ 50m from business.
- **After pickup:** Once `driverPickedUpAt` is set, items can remain visible (driver already collected). Optional: keep locked until pickup for consistency.

---

## Scope: All Delivery Orders or Personal Shopper Only?

- **Recommendation:** Apply to **all delivery orders**. Rationale:
  - Personal Shopper: driver shops at store → must be at correct store.
  - Pre-packed: driver picks up bag → still must go to correct business.
- Alternative: Only lock for `requiresPersonalShopper === true` if you want a lighter first version.

---

## Files to Create/Modify

### Create

- `lib/driver-items-lock.ts` — Helper: `isDriverAtBusiness(driverLat, driverLng, businessLat, businessLng): boolean` (uses 50m).
- `lib/send-driver-arrived-at-business-push.ts` — Send FCM when driver reaches business (optional; could live inside location route).

### Modify

- **Driver APIs** — Add `itemsLocked` logic using your non-Sanity data layer; strip/empty `items` when locked.
- **Full-menu API** — Add location check; return 403 when locked.
- **Items PATCH API** — Add location check; return 403 when locked.
- **Location API** — Persist to your backend; on arrival, trigger Pusher + send FCM.
- `app/(main)/driver/orders/DriverOrdersV2.tsx` — Locked UI; subscribe to Pusher `items-unlocked` to refresh when driver arrives.

---

## Implementation Order

1. Add `order_driver_arrival` (or equivalent) to your non-Sanity backend.
2. Add `lib/driver-items-lock.ts` helper (`distanceKm <= 0.05`).
3. Update driver orders API to compute `itemsLocked` from your backend data.
4. Update `DriverOrdersV2` with locked button and message; subscribe to Pusher `items-unlocked` for instant refresh.
5. Add location check to full-menu and items PATCH APIs.
6. In location API: persist location to your backend; on arrival, trigger Pusher + FCM.
7. Test with mock locations / staging.

---

## Enhancements

- **Pusher refresh:** When driver arrives, trigger `items-unlocked` on `private-driver-orders` (or `order-{orderId}`) so the driver app refreshes and shows items immediately without pull-to-refresh. The app already uses `usePusherStream` / `usePusherSubscription`; add a listener for this event.
- **Distance display:** Show "You are X m away" when locked, to guide the driver.
- **Map hint:** Optional "Navigate to business" button when locked.
- **Analytics:** Use `driverArrivedAtBusinessAt` for time-to-arrival and route quality metrics.

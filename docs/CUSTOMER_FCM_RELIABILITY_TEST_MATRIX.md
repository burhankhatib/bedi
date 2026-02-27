# Customer FCM Reliability Test Matrix

Use this checklist after deploying customer push reliability changes.

## Preconditions

- FCM server credentials are configured.
- Browser notifications are allowed for at least one device.
- `PUSH_BACKFILL_SECRET` is set if backfill route is used.
- Test user has a Clerk account and can place orders.

## 1) Multi-device customer fanout

- Sign in as the same customer on Device A and Device B.
- Enable customer notifications on both devices.
- Place one order and move status through:
  - `new` -> `preparing` -> `waiting_for_delivery` -> `driver_on_the_way` -> `out-for-delivery` -> `completed`
- Verify both devices receive notifications for each status.

## 2) Cross-business coverage

- Using the same customer account, place order in Business X and Business Y.
- For each order, update statuses from dashboard/driver flows.
- Verify customer receives notifications for both businesses.

## 3) Order types

- Create one order for each type:
  - Dine-in
  - Receive in person
  - Delivery
- Trigger status transitions relevant to each type.
- Verify notifications are delivered for each type.

## 4) Track-page dismissal recovery

- Open tracking page, dismiss/deny initial prompt.
- Verify reminder UI remains visible and retry attempts continue.
- Re-enable notifications from browser settings.
- Verify UI recovers to enabled state and next status change arrives.

## 5) Legacy fallback behavior

- Use an old order that has `customerFcmToken` on order but no central subscription.
- Trigger a status update.
- Verify notification still delivers via legacy fallback.

## 6) Backfill route

- Run dry run:
  - `POST /api/admin/push/backfill-customer-subscriptions` with header `x-backfill-secret`
  - body `{ "dryRun": true, "limit": 500 }`
- Run actual migration:
  - body `{ "dryRun": false, "limit": 500 }`
- Verify response counts: `scanned`, `skipped`, `created`, `updated`.

## 7) Token invalidation

- Force an invalid/expired token case (remove app, rotate token).
- Trigger status update.
- Verify logs show permanent failure classification.
- Verify central subscription is marked inactive.

## Expected logs

- `[customer-push-subscription] central upsert`
- `[track-push-subscription] central upsert`
- `[track-push-subscription] hasPush check`
- `[customer-order-push] fanout`

# Customer FCM Reliability Test Matrix

Use this checklist to validate customer push notifications across the full order journey and multi-role accounts.

## Preconditions

- `FIREBASE_*` server env is configured.
- Customer service worker is registered (`/customer-sw.js`).
- Customer push registration uses `/customer-sw.js` as the primary service worker path (scope `/`).
- `PUSH_BACKFILL_SECRET` is set if using backfill API.

## One-time migration

- Dry run:
  - `POST /api/admin/push/backfill-customer-subscriptions`
  - Header: `x-backfill-secret: <PUSH_BACKFILL_SECRET>`
  - Body: `{ "dryRun": true, "limit": 500 }`
- Execute:
  - Body: `{ "dryRun": false, "limit": 5000 }`
- Verify response counts: `scanned`, `created`, `updated`, `skipped`.

## Functional matrix

### A) Single customer, single device, single business

1. Place order (delivery) from menu.
2. Enable notifications on tracking page.
3. Move status through:
   - `new -> preparing -> waiting_for_delivery -> driver_on_the_way -> out-for-delivery -> completed`
4. Verify a push notification is received at each status transition.

### B) Single customer, multiple businesses

1. Place order in business A, enable push.
2. Place order in business B.
3. Update statuses for both orders.
4. Verify customer receives push for both businesses.

### C) Single customer, multiple devices

1. Sign in as same Clerk account on device 1 and device 2.
2. Enable push on both devices.
3. Place one order and advance statuses.
4. Verify both devices receive push (fanout).

### D) Same Clerk user with customer + driver + tenant roles

1. Sign in as same account and enable each role's push flow.
2. Place customer order and update statuses.
3. Verify customer notifications are received (customer context only).
4. Verify driver/tenant notifications still work for their own flows.

### E) Permission recovery flows

1. Dismiss browser permission prompt on tracking page.
2. Verify reminder UI keeps prompting.
3. Deny permission and verify platform guidance text is shown.
4. Re-allow permission in browser settings.
5. Verify tracking UI automatically flips to enabled.

### F) iOS standalone gating

1. Open an order tracking page in iOS Safari tab (not installed).
2. Verify the UI explains Home Screen requirement and does not claim push is enabled.
3. Add app to Home Screen, reopen from icon, and enable push.
4. Verify order status pushes arrive in standalone mode.

## Observability log points

- Customer subscription upsert:
  - `[customer-push-subscription] ...`
  - `[track-push-subscription] central upsert`
- Customer push fanout:
  - `[customer-order-push] fanout`
- Track page status check:
  - `[track-push-subscription] hasPush check` (development)

## Pass criteria

- Customer receives status notifications for all order types.
- Customer receives notifications across multiple businesses.
- Multiple customer devices receive notifications for same order updates.
- Role coexistence does not break customer notification delivery.

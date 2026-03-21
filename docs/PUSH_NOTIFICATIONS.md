# Push Notifications (Critical)

Push is **core** to the product: **Business** gets new-order alerts when the orders page is closed; **Drivers** get delivery-request alerts. This doc describes the **stable reference implementation (Driver)** and how to reuse the same method for other functions (e.g. Business new order).

---

## Reference implementation: Driver new-delivery-request

This is the **canonical, stable pattern**. Do not change the Driver flow. Use it as the template for any new push feature.

### 1. Trigger (when to send)

- **Driver:** When a business requests a delivery captain: `POST /api/tenants/[slug]/orders/request-driver`.
- Server updates the order (e.g. sets `deliveryRequestedAt`), then sends push to the **right recipients** (e.g. online drivers in the same country/city).

### 2. Payload contract (same for all push types)

Every push uses a **single payload shape**:

```ts
{
  title: string   // Short, e.g. "New delivery request"
  body: string    // One line, e.g. "Order #123 needs a captain."
  url: string     // Path or full URL to open on click, e.g. "/driver/orders"
}
```

- **url** can be a path (e.g. `/driver/orders`) or an absolute URL. The service worker builds a full URL when needed: `path.startsWith('http') ? path : self.location.origin + path`.

### 3. API send pattern (exact order)

1. Check push is available: `isFCMConfigured() || isPushConfigured()`.
2. Fetch **recipient(s)** from Sanity (fresh read, no CDN): each has `fcmToken` and/or `pushSubscription` (endpoint + keys.p256dh + keys.auth).
3. Build **one** payload `{ title, body, url }`.
4. For **each** recipient:
   - Try **FCM first**: if recipient has `fcmToken` and `isFCMConfigured()`, call `sendFCMToToken(recipient.fcmToken, payload)`.
   - If not sent, try **Web Push**: if recipient has `pushSubscription` (endpoint, p256dh, auth) and `isPushConfigured()`, call `sendPushNotification(subscription, payload)`.

Driver example (request-driver route):

```ts
const payload = { title: 'New delivery request', body: `Order #${orderNumber} needs a captain.`, url: '/driver/orders' }
for (const d of matching) {
  let sent = false
  if (d.fcmToken && isFCMConfigured()) sent = await sendFCMToToken(d.fcmToken, payload)
  if (!sent && d.pushSubscription?.endpoint && ...) {
    sent = await sendPushNotification({ endpoint: ..., keys: { p256dh, auth } }, payload)
  }
}
```

### 4. FCM (lib/fcm.ts)

- **sendFCMToToken(token, payload)** sends a **data-only** message so the **service worker** receives the push even when the app is **closed or in background**.
- Payload is sent in `data`: `{ title, body, url }`. Default `url` is `/driver/orders` if omitted.
- Android: high priority, channel `high_importance_channel`. iOS: time-sensitive. Web: `webpush.fcmOptions.link` set when `url.startsWith('http')`, high urgency.
- Do not change this behaviour; it is what makes push reliable when the app is closed.

### 5. Service worker (driver-sw.js)

- **push:** Parse `event.data.json()` → FCM sends `raw.data` (or `raw.notification`). Read `title`, `body`, `url` from `dataPayload`/`raw`. Call `showNotification(title, { body, data: { url }, tag, renotify, requireInteraction, ... })`.
- **notificationclick:** Read `url` from `event.notification.data?.url`. Build `fullUrl` (if path, prepend `self.location.origin`). Reuse existing window: `client.navigate(fullUrl)` then `client.focus()`; else `openWindow(fullUrl)`.

Driver SW is registered at `/driver/sw.js` (scope `/driver`). The FCM token is bound to this SW when the driver enables push on the driver app.

### 6. Subscription (where tokens live)

- **Driver:** User enables push on the driver Orders page. `DriverPushContext` registers `/driver/sw.js`, gets FCM token (and optionally Web Push), POSTs to `POST /api/driver/push-subscription`. Token(s) stored on the **driver** document in Sanity: `fcmToken`, `pushSubscription`.
- **Business (tenant):** User enables push on `/t/[slug]/orders` (or manage). Token(s) stored on the **tenant** document: `fcmToken`, `pushSubscription`. Per business (per tenant/slug).
- **Customer:** Customer subscriptions are centralized in `userPushSubscription` keyed by `clerkUserId + roleContext=customer` so one user can receive notifications on multiple devices. Legacy order-level fields (`customerFcmToken`, `customerPushSubscription`) remain fallback for older orders.

---

## Reusing the pattern: Business new order

The **same stable method** as the Driver is used to notify the business when there is a new order (when the orders page is closed).

- **Trigger:** When an order is created: `POST /api/orders` (after the order document is created and has `site` = tenant `_id` and `tenantSlug`).
- **Recipients:** Single tenant: fetch tenant by `site._ref` from Sanity (fresh read), get `fcmToken` and `pushSubscription`.
- **Payload:** Same shape: `{ title: 'New order received', body: 'Order #… — open the app to view.', url: '/t/${tenantSlug}/orders' }`.
- **Send:** Same order: try `sendFCMToToken(tenant.fcmToken, payload)`, then if not sent `sendPushNotification(tenant.pushSubscription, payload)`.
- **SW:** Business uses `tenant-orders-sw.js` (or `tenant-sw.js`) registered at `/t/[slug]/orders/sw.js`. Same push/notificationclick behaviour: parse data, show notification, on click open `fullUrl` (path or absolute).

No driver code is changed; only the business send path follows the same contract and send order.

---

## Other functions (future)

To add push for another event (e.g. “order ready for pickup”, “driver assigned”):

1. **Trigger:** Decide which API or event triggers the send.
2. **Recipients:** Who should get it? Fetch from Sanity (fresh read) the document(s) that hold `fcmToken` and/or `pushSubscription`.
3. **Payload:** Build `{ title, body, url }`; `url` = path or full URL to open on tap.
4. **Send:** For each recipient, FCM first then Web Push fallback, same as Driver and Business.
5. **SW:** The recipient’s app must have a service worker that handles `push` and `notificationclick` the same way (parse `data`, show notification, open `fullUrl` on click). If the recipient uses an existing PWA (e.g. driver, tenant), that SW already does this.

---

## Env and dependencies

- **VAPID (Web Push):** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Generate: `npx web-push generate-vapid-keys`.
- **FCM:** Firebase Admin (service account file or `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`). See `docs/FIREBASE_FCM_SETUP.md`.

---

## Do not

- Change the **Driver** push flow, API, or `driver-sw.js`; it is the reference implementation.
- Remove or rename `lib/push.ts`, `sendPushNotification`, `isPushConfigured`; or `lib/fcm.ts`, `sendFCMToToken`, `isFCMConfigured`.
- Change where or how `pushSubscription` / `fcmToken` are stored (tenant/driver docs) without updating every send site.
- Use cached Sanity reads when fetching tokens for sending (use `useCdn: false` or write client).
- Alter service workers’ push and `notificationclick` handlers without testing end-to-end.

---

## Multiple PWAs on the same device (Business + Customer)

When the same device has the **Customer PWA** (scope `/`) and one or more **Business Orders** PWAs (scope `/t/[slug]/orders/`), each app has its own service worker. Push subscription must be tied to the **correct** SW so the right app receives the notification.

- **Business new-order push:** The business must enable notifications **from the Business Orders page** (`/t/[slug]/orders`). The code uses scope **with trailing slash** (`/t/[slug]/orders/`) so `getRegistration(scope)` finds the tenant-orders SW registered at `/t/[slug]/orders/sw.js`. If the scope did not match (e.g. no trailing slash), `getRegistration()` could return null and the saved token could be wrong or missing, so the business would not receive the push.
- **Per business:** Each tenant (business) has its own document and its own `fcmToken` / `pushSubscription`. Enabling push on King Broast only updates King Broast’s document.
- If the business still does not receive: have them open **that business’s Orders page** (e.g. from a home screen shortcut or direct URL), tap **Enable notifications** again so the token is re-saved for the tenant-orders SW, then test a new order.

## If push stops working

1. Check server logs for `[Push]` / `[FCM]` (e.g. 410 = expired subscription).  
2. Confirm VAPID and (if used) FCM env are set where the API runs.  
3. User may need to re-enable notifications (subscriptions expire).  
4. In Sanity, confirm the recipient document has `fcmToken` or `pushSubscription` (endpoint + keys).  
5. **Business only:** Ensure scope uses trailing slash and the user enabled push from the Orders page (see “Multiple PWAs on the same device” above).

## Business: new order = FCM + optional instant WhatsApp + 3‑minute reminder

1. **FCM / Web Push** runs immediately when an order is created (`NotificationService.onNewOrder` → `sendTenantAndStaffPush`), when server push is configured.
2. **Instant WhatsApp** runs immediately when the tenant has **Instant WhatsApp** enabled (`prioritizeWhatsapp`). Uses Meta template `new_order` with `formatTenantNewOrderWhatsAppSummary` (items, totals, customer, delivery address, Google Maps + Waze links). On success, stored on the order as `businessWhatsappInstantNotifiedAt`. **No second business WhatsApp** is sent for that order (one WhatsApp per order policy).
3. **~3 minute reminder WhatsApp** runs only if the order is still **`status == new`**, **no** successful instant WhatsApp was already sent (`!businessWhatsappInstantNotifiedAt`), and the reminder has not run yet — via Firestore job → `GET /api/cron/unaccepted-orders-whatsapp?orderId=…`. Same `new_order` template and formatter. On success, sets `businessWhatsappUnacceptedReminderAt` and `businessWhatsappNotifiedAt`.

## Super-admin: order notification diagnostics

For a single order, super-admins can call:

`GET /api/admin/orders/[orderId]/notifications-debug`

Response includes Sanity `notificationDiagnostics` (append-only log: push, instant WhatsApp errors, Firestore backup job queue, delayed WhatsApp cron), a snapshot of the Firestore `scheduledJobs` doc `order_unaccepted_whatsapp:{orderId}` when readable, and server flags (`fcmConfigured`, `webPushConfigured`, `firebaseAdminConfigured`).

The same log is stored on the order document in Sanity (`notificationDiagnostics`, hidden in Studio).

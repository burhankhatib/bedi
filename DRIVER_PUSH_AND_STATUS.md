# Driver dashboard: status (online/offline) and push notifications

## 1. Online/offline button (real-time and stability)

- **Sanity Live:** The driver’s online status is now synced in real time. The app subscribes to the driver document in Sanity; when you (or the API) change `isOnline` / `onlineSince`, the UI updates without waiting for the next poll.
- **Stability:** After each toggle (online ↔ offline), the app:
  - Sends the update to the API (PATCH `/api/driver/status`).
  - On success, refetches status once so the UI is guaranteed in sync with Sanity.
  - If the request fails or the server rejects (e.g. “can’t go offline with active deliveries”), it refetches so the button state matches the server.
- **Double-click:** The button is disabled while a request is in progress (`updating`), so multiple rapid clicks don’t send duplicate requests.
- **Polling:** A 15-second polling fallback remains so status stays correct even if the Sanity listen connection drops.

## 2. Push notifications when the PWA is closed

You **do not need OneSignal or another service** for basic push. The app uses the **Web Push API** with VAPID (via the `web-push` package already in the project).

### What’s in place

- **Service worker:** `public/driver-sw.js` is registered for scope `/driver/`. When the tenant “requests driver,” the server sends a Web Push to all online drivers (same country/city) that have a saved `pushSubscription`.
- **Subscription:** When the driver opens the driver app, `DriverPushSetup` registers the SW, asks for notification permission, subscribes to push, and sends the subscription to the API (`POST /api/driver/push-subscription`), which stores it on the driver document.
- **When it works:** If the driver has **allowed notifications** and the subscription is saved, they get a **notification and vibration** when a new delivery is requested, even when the app is in the background or closed (as long as the OS hasn’t killed the SW).

### What you need on the server

1. **VAPID keys** (one-time setup):
   ```bash
   npx web-push generate-vapid-keys
   ```
   Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY` (e.g. in `.env.local`).
2. **HTTPS** in production (required for Web Push).
3. **`web-push`** is already in `package.json`; no extra library is required for standard Web Push.

### UX in the driver app

- If the browser has not yet asked for notification permission (`default`), a short **Arabic hint** is shown at the top of the driver content: “للحصول على إشعارات الطلبات الجديدة عند إغلاق التطبيق: اسمح بالإشعارات” with a **تفعيل** (Enable) button. Clicking it triggers the permission prompt and, if granted, subscribes and saves the subscription.
- After permission is granted (or denied), the hint is hidden (or can be dismissed).

### iOS

- Web Push in **Safari** (iOS 16.4+) works when the user has **added the site to the Home Screen** (PWA) and **allowed notifications**.
- The driver should install the PWA (Add to Home Screen) and then allow notifications when prompted (or via the “Enable” hint). No OneSignal is required for this flow.

### When to consider OneSignal (or similar)

- You can keep using **only Web Push + VAPID** for:
  - Real-time delivery to **online** drivers when a tenant requests a driver.
  - Notifications when the app is in the background or closed (within OS limits).
- Consider **OneSignal** (or Firebase, etc.) if you need:
  - More aggressive delivery on iOS (e.g. better handling of background/killed app).
  - One dashboard for all platforms and devices.
  - Rich notifications, segments, or A/B tests.

So: **by default you can rely on the current Web Push setup**; add another library only if you hit limits (e.g. iOS delivery or product needs beyond “notify online drivers when a new order is requested”).

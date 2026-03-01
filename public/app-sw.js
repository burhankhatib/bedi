// Minimal service worker for Bedi Delivery main app (dashboard / tenant).
// Required for PWA installability on Android. No caching — install/activate only.
// Updates: do not skipWaiting in install so the client can show "Update available" and reload.
//
// Auth rule: never cache document/navigation requests so the server always validates auth
// and can redirect to sign-in (302) when needed. Avoids 500 or stale content for tenants.
'use strict'

self.addEventListener('install', () => {
  // Leave new SW in "waiting" so the app can prompt the user to reload
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const u = event.request.url
  const sameOrigin = self.location.origin === new URL(u).origin
  const isNavigate = event.request.mode === 'navigate'
  const pathname = new URL(u).pathname
  // Skip /studio so Sanity Studio loads without SW interference (avoids "Failed to fetch" / infinite loading)
  if (sameOrigin && pathname.startsWith('/studio')) return
  if (sameOrigin && isNavigate) {
    event.respondWith(fetch(event.request))
  }
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

// Unified Business PWA: FCM high-priority push for new orders (any business). Payload: data.title, data.body, data.url (/t/[slug]/orders).
self.addEventListener('push', function (event) {
  let data = { title: 'New order', body: 'Open to view and accept.', url: '/dashboard' }
  if (event.data) {
    try {
      const raw = event.data.json()
      const notif = raw.notification || {}
      const dataPayload = raw.data || raw
      data = {
        title: notif.title ?? dataPayload.title ?? raw.title ?? data.title,
        body: notif.body ?? dataPayload.body ?? raw.body ?? data.body,
        url: dataPayload.url ?? raw.url ?? data.url,
      }
    } catch (_) {}
  }
  const url = data.url || '/dashboard'
  const options = {
    body: data.body || 'Open the app to view the order.',
    icon: data.icon || '/adminslogo.webp',
    badge: data.icon || '/adminslogo.webp',
    data: { url: url },
    tag: 'bedi-business-new-order',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
  }
  event.waitUntil(self.registration.showNotification(data.title || 'New order', options))
})

// Always open the payload url (e.g. /t/[slug]/orders for the business that received the order).
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const path = event.notification.data?.url || '/dashboard'
  const fullUrl = path.startsWith('http') ? path : self.location.origin + (path.startsWith('/') ? path : '/' + path)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          if ('navigate' in client) client.navigate(fullUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl)
    })
  )
})

// Tenant PWA: handle push notifications when app is closed or in background (new orders).
// Auth rule: never cache document/navigation requests so the server always validates auth.
'use strict'

self.addEventListener('install', () => {})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const u = event.request.url
  const sameOrigin = self.location.origin === new URL(u).origin
  const isNavigate = event.request.mode === 'navigate'
  if (sameOrigin && isNavigate) {
    event.respondWith(fetch(event.request))
  }
})

self.addEventListener('push', function (event) {
  let data = { title: 'New order', body: 'You have a new order.', url: '/' }
  if (event.data) {
    try {
      const raw = event.data.json()
      // FCM: notification + data payload, or data-only { data: { title, body, url } }
      const notif = raw.notification || {}
      const dataPayload = raw.data || {}
      data = {
        title: notif.title ?? dataPayload.title ?? raw.title ?? data.title,
        body: notif.body ?? dataPayload.body ?? raw.body ?? data.body,
        url: dataPayload.url ?? raw.url ?? data.url,
      }
    } catch (_) {}
  }
  const options = {
    body: data.body || 'Open the app to view the order.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { url: data.url || '/' },
    tag: 'bedi-tenant-new-order',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
  }
  event.waitUntil(self.registration.showNotification(data.title || 'New order', options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const path = event.notification.data?.url || '/'
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

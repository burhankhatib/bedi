// Driver PWA: handle push notifications when app is closed or in background (only sent to online drivers).
// Auth rule: never cache document/navigation requests so the server always validates auth
// and can redirect to sign-in when needed.
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
  if (sameOrigin && isNavigate) {
    event.respondWith(fetch(event.request))
  }
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('push', function (event) {
  let data = { title: 'New delivery request', body: 'A delivery order is waiting.', url: '/driver/orders', dir: 'ltr' }
  if (event.data) {
    try {
      const raw = event.data.json()
      const notif = raw.notification || {}
      const dataPayload = raw.data || raw
      data = {
        title: notif.title ?? dataPayload.title ?? raw.title ?? data.title,
        body: notif.body ?? dataPayload.body ?? raw.body ?? data.body,
        url: dataPayload.url ?? raw.url ?? data.url,
        dir: dataPayload.dir === 'rtl' ? 'rtl' : 'ltr',
      }
    } catch (_) {}
  }
  const notifData = { url: data.url || '/driver/orders', dir: data.dir }
  const options = {
    body: data.body || 'Open the app to view and accept.',
    icon: '/driversLogo.webp',
    badge: '/driversLogo.webp',
    data: notifData,
    tag: 'bedi-driver-delivery',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
  }
  if (data.dir === 'rtl') {
    options.dir = 'rtl'
    options.lang = 'ar'
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Bedi Driver', options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const path = event.notification.data?.url || '/driver/orders'
  let fullUrl = path.startsWith('http') ? path : self.location.origin + (path.startsWith('/') ? path : '/' + path)
  if (fullUrl.includes('/driver/orders') && !fullUrl.includes('goOnline=1')) {
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + 'goOnline=1'
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.indexOf(self.location.origin) !== -1 && client.url.indexOf('/driver') !== -1 && 'focus' in client) {
          client.postMessage({ type: 'PUSH_NOTIFICATION_CLICK', url: fullUrl })
          if ('navigate' in client && client.url !== fullUrl) client.navigate(fullUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl)
    })
  )
})

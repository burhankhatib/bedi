// Business Orders PWA: dedicated SW for /t/[slug]/orders. Handles FCM push when app is closed (same as driver).
// Auth rule: never cache document/navigation requests so the server always validates auth.
'use strict'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

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
  let data = { title: 'طلب جديد', body: 'لديك طلب جديد.', url: '/', icon: '/adminslogo.webp', dir: 'rtl' }
  if (event.data) {
    try {
      const raw = event.data.json()
      const notif = raw.notification || {}
      const dataPayload = raw.data || raw
      data = {
        title: notif.title ?? dataPayload.title ?? raw.title ?? data.title,
        body: notif.body ?? dataPayload.body ?? raw.body ?? data.body,
        url: dataPayload.url ?? raw.url ?? data.url,
        icon: notif.icon ?? dataPayload.icon ?? raw.icon ?? data.icon,
        dir: dataPayload.dir === 'ltr' ? 'ltr' : 'rtl',
      }
    } catch (_) {}
  }
  const options = {
    body: data.body || 'افتح التطبيق لعرض الطلب.',
    icon: data.icon || '/adminslogo.webp',
    badge: data.icon || '/adminslogo.webp',
    data: { url: data.url || '/' },
    tag: 'bedi-tenant-order-update',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
    dir: data.dir,
    lang: data.dir === 'ltr' ? 'en' : 'ar',
  }
  event.waitUntil(self.registration.showNotification(data.title || 'طلب جديد', options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const path = event.notification.data?.url || '/'
  const fullUrl = path.startsWith('http') ? path : self.location.origin + (path.startsWith('/') ? path : '/' + path)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          client.postMessage({ type: 'PUSH_NOTIFICATION_CLICK', url: fullUrl })
          if ('navigate' in client && client.url !== fullUrl) client.navigate(fullUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl)
    })
  )
})

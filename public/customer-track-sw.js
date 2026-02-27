// Customer order tracking: push notifications when order status changes.
'use strict'

self.addEventListener('install', () => {})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', function (event) {
  let data = { title: 'Order update', body: 'Your order status has been updated.', url: '/' }
  if (event.data) {
    try {
      const raw = event.data.json()
      const notif = raw.notification || {}
      const dataPayload = raw.data || {}
      data = {
        title: notif.title ?? dataPayload.title ?? raw.title ?? data.title,
        body: notif.body ?? dataPayload.body ?? raw.body ?? data.body,
        url: dataPayload.url ?? raw.url ?? data.url,
      }
    } catch (_) {}
  }
  const path = data.url && data.url.startsWith('http') ? data.url : (self.location.origin + (data.url && data.url.startsWith('/') ? data.url : '/' + (data.url || '')))
  const options = {
    body: data.body || 'Tap to view your order.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { url: path },
    tag: 'bedi-customer-order-status',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Order update', options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url || self.location.origin + '/'
  const fullUrl = url.startsWith('http') ? url : self.location.origin + (url.startsWith('/') ? url : '/' + url)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const c of clientList) {
        if (c.url.indexOf(self.location.origin) !== -1 && 'focus' in c) {
          if ('navigate' in c && typeof c.navigate === 'function') c.navigate(fullUrl)
          return c.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl)
    })
  )
})

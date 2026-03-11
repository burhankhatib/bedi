/**
 * Customer PWA Service Worker
 * Scope: / (homepage, search, tenant menus, order flow)
 *
 * Required for Chrome "Install app" (not just "Add shortcut"):
 * - Must control the page and start_url (/) via fetch handler
 * - This SW handles all same-origin requests so the scope is fully controlled
 */
'use strict'

self.addEventListener('install', function (event) {
  // Activate this SW immediately so it controls the page and start_url (required for installability)
  event.waitUntil(Promise.resolve().then(function () { self.skipWaiting() }))
})

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

// Handle all same-origin requests so this SW controls the scope and start_url (Chrome installability)
self.addEventListener('fetch', function (event) {
  const url = event.request.url
  try {
    const reqUrl = new URL(url)
    if (reqUrl.origin !== self.location.origin) return
    // Do not control studio (different app)
    if (reqUrl.pathname.startsWith('/studio')) return
    // Respond so this SW is the controller for this request
    event.respondWith(fetch(event.request))
  } catch (_) {
    // Ignore invalid URLs
  }
})

self.addEventListener('push', function (event) {
  let data = { title: 'Bedi', body: '', url: '/' }
  if (event.data) {
    try {
      const raw = event.data.json()
      const notif = raw.notification || {}
      const dataPayload = raw.data || {}
      data = {
        title: notif.title ?? dataPayload.title ?? raw.title ?? data.title,
        body: notif.body ?? dataPayload.body ?? raw.body ?? data.body,
        url: dataPayload.url ?? raw.url ?? data.url ?? '/',
      }
    } catch (_) {}
  }
  const path = data.url && data.url.startsWith('http') ? data.url : (self.location.origin + (data.url && data.url.startsWith('/') ? data.url : '/' + (data.url || '')))
  const options = {
    body: data.body || 'Tap to open.',
    icon: '/customersLogo.webp',
    badge: '/customersLogo.webp',
    data: { url: path },
    tag: 'bedi-customer',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Bedi', options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url || self.location.origin + '/'
  const fullUrl = url.startsWith('http') ? url : self.location.origin + (url.startsWith('/') ? url : '/' + url)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const c = clientList[i]
        if (c.url && c.url.indexOf(self.location.origin) !== -1 && 'focus' in c) {
          if ('navigate' in c && typeof c.navigate === 'function') c.navigate(fullUrl)
          return c.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl)
    })
  )
})

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

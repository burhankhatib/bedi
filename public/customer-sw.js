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

// Handle same-origin requests ONLY for customer-owned paths.
// CRITICAL: We must NOT respond to paths belonging to other PWAs, otherwise
// Chrome considers those pages "already installed" under the customer PWA.
self.addEventListener('fetch', function (event) {
  var url = event.request.url
  try {
    var reqUrl = new URL(url)
    if (reqUrl.origin !== self.location.origin) return
    var p = reqUrl.pathname
    // Skip paths owned by other PWAs — let their own SWs handle them
    if (p.startsWith('/driver')) return
    if (p.startsWith('/dashboard')) return
    if (p.startsWith('/studio')) return
    // Skip all per-business paths: /t/[slug]
    if (p.startsWith('/t/')) return
    // Skip specific static resources that could confuse the cache
    if (p.endsWith('.webmanifest')) return
    if (p.endsWith('.js') && p.includes('sw')) return
    // Respond so this SW controls the page (required for Chrome installability)
    event.respondWith(fetch(event.request))
  } catch (_) {
    // Ignore invalid URLs
  }
})

self.addEventListener('push', function (event) {
  let data = { title: 'Bedi', body: '', url: '/', driverArrived: false }
  if (event.data) {
    try {
      const raw = event.data.json()
      const notif = raw.notification || {}
      const dataPayload = raw.data || raw
      data = {
        title: notif.title ?? dataPayload.title ?? raw.title ?? data.title,
        body: notif.body ?? dataPayload.body ?? raw.body ?? data.body,
        url: dataPayload.url ?? raw.url ?? data.url ?? '/',
        driverArrived: dataPayload.driverArrived === '1' || dataPayload.driverArrived === true,
      }
    } catch (_) {}
  }
  const path = data.url && data.url.startsWith('http') ? data.url : (self.location.origin + (data.url && data.url.startsWith('/') ? data.url : '/' + (data.url || '')))
  const options = {
    body: data.body || 'Tap to open.',
    icon: '/customersLogo.webp',
    badge: '/customersLogo.webp',
    data: { url: path },
    tag: data.driverArrived ? 'bedi-customer-arrived' : 'bedi-customer',
    renotify: true,
    requireInteraction: true,
    vibrate: data.driverArrived ? [500, 200, 500, 200, 500, 200, 500] : [200, 100, 200, 100, 200],
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
          const needsNav = c.url !== fullUrl && 'navigate' in c && typeof c.navigate === 'function'
          if (needsNav) {
            return c.navigate(fullUrl).then(function () { return c.focus() }).catch(function () { return c.focus() })
          }
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

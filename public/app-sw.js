// Legacy app SW — same as dashboard-sw.js for backward compatibility.
// Old PWA installs may still reference /app-sw.js; this prevents 404.
// New installs use /dashboard-sw.js. TenantDashboardPWA unregisters app-sw when user visits dashboard.
'use strict'

var PWA_ROLE = 'tenant-dashboard'
var PWA_DEFAULT_URL = '/dashboard'
var PWA_DEFAULT_ICON = '/adminslogo.webp'
var PWA_TAG = 'bedi-business-new-order'
var PWA_DEFAULT_TITLE = 'New order'
var PWA_DEFAULT_DIR = 'ltr'
var PWA_SKIP_WAITING = true

self.addEventListener('install', function (event) {
  if (PWA_SKIP_WAITING) event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', function (event) {
  try {
    var reqUrl = new URL(event.request.url)
    if (reqUrl.origin !== self.location.origin) return
    if (reqUrl.pathname.startsWith('/studio')) return
    if (reqUrl.pathname.endsWith('.webmanifest')) return
    if (reqUrl.pathname.endsWith('.js') && reqUrl.pathname.includes('sw')) return
    if (event.request.mode === 'navigate') event.respondWith(fetch(event.request))
  } catch (_) {}
})

self.addEventListener('push', function (event) {
  var data = { title: PWA_DEFAULT_TITLE, body: '', url: PWA_DEFAULT_URL, icon: PWA_DEFAULT_ICON, dir: PWA_DEFAULT_DIR }
  if (event.data) {
    try {
      var raw = event.data.json()
      var notif = raw.notification || {}
      var dataPayload = raw.data || raw
      data = {
        title: notif.title || dataPayload.title || raw.title || data.title,
        body: notif.body || dataPayload.body || raw.body || data.body,
        url: dataPayload.url || raw.url || data.url,
        icon: notif.icon || dataPayload.icon || raw.icon || data.icon,
        dir: dataPayload.dir || raw.dir || data.dir,
      }
    } catch (_) {}
  }
  var notifUrl = data.url || PWA_DEFAULT_URL
  var options = {
    body: data.body || 'Tap to open.',
    icon: data.icon || PWA_DEFAULT_ICON,
    badge: data.icon || PWA_DEFAULT_ICON,
    data: { url: notifUrl },
    tag: PWA_TAG,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
  }
  if (data.dir === 'rtl') {
    options.dir = 'rtl'
    options.lang = 'ar'
  }
  event.waitUntil(self.registration.showNotification(data.title || PWA_DEFAULT_TITLE, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var path = event.notification.data && event.notification.data.url ? event.notification.data.url : PWA_DEFAULT_URL
  var fullUrl
  try {
    fullUrl = new URL(path, self.location.origin).href
  } catch (_) {
    fullUrl = self.location.origin + (path.startsWith('/') ? path : '/' + path)
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i]
        if (client.url === fullUrl && 'focus' in client) return client.focus()
      }
      for (var j = 0; j < clientList.length; j++) {
        var c = clientList[j]
        if (c.url && c.url.indexOf(self.location.origin) !== -1 && 'focus' in c) {
          c.postMessage({ type: 'PUSH_NOTIFICATION_CLICK', url: fullUrl })
          if ('navigate' in c && c.url !== fullUrl) c.navigate(fullUrl)
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

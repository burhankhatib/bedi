// Bedi PWA – Universal Service Worker
// Role-specific configuration is injected before this code by the server route.
// Expected injected variables: PWA_ROLE, PWA_DEFAULT_URL, PWA_DEFAULT_ICON,
//   PWA_TAG, PWA_DEFAULT_TITLE, PWA_DEFAULT_DIR, PWA_SKIP_WAITING
'use strict'

// ─── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', function (event) {
  if (typeof PWA_SKIP_WAITING !== 'undefined' && PWA_SKIP_WAITING) {
    event.waitUntil(self.skipWaiting())
  }
  // else: leave new SW in "waiting" so the app can prompt the user to reload
})

// ─── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

// ─── Fetch ─────────────────────────────────────────────────────────────────────
// Network-first for navigation. Never cache documents so auth redirects work.
self.addEventListener('fetch', function (event) {
  try {
    var reqUrl = new URL(event.request.url)
    if (reqUrl.origin !== self.location.origin) return
    // Skip /studio so Sanity Studio loads without SW interference
    if (reqUrl.pathname.startsWith('/studio')) return
    if (event.request.mode === 'navigate') {
      event.respondWith(fetch(event.request))
    }
  } catch (_) {
    // Ignore invalid URLs
  }
})

// ─── Push ──────────────────────────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  var defaultIcon = (typeof PWA_DEFAULT_ICON !== 'undefined') ? PWA_DEFAULT_ICON : '/customersLogo.webp'
  var defaultUrl = (typeof PWA_DEFAULT_URL !== 'undefined') ? PWA_DEFAULT_URL : '/'
  var defaultTitle = (typeof PWA_DEFAULT_TITLE !== 'undefined') ? PWA_DEFAULT_TITLE : 'Notification'
  var defaultTag = (typeof PWA_TAG !== 'undefined') ? PWA_TAG : 'bedi-notification'
  var defaultDir = (typeof PWA_DEFAULT_DIR !== 'undefined') ? PWA_DEFAULT_DIR : 'ltr'

  var data = { title: defaultTitle, body: '', url: defaultUrl, icon: defaultIcon, dir: defaultDir }

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

  var notifUrl = data.url || defaultUrl
  var options = {
    body: data.body || 'Tap to open.',
    icon: data.icon || defaultIcon,
    badge: data.icon || defaultIcon,
    data: { url: notifUrl },
    tag: defaultTag,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
  }

  // RTL support
  if (data.dir === 'rtl') {
    options.dir = 'rtl'
    options.lang = 'ar'
  }

  event.waitUntil(
    self.registration.showNotification(data.title || defaultTitle, options)
  )
})

// ─── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var path = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : (typeof PWA_DEFAULT_URL !== 'undefined' ? PWA_DEFAULT_URL : '/')

  var fullUrl
  try {
    fullUrl = new URL(path, self.location.origin).href
  } catch (_) {
    fullUrl = self.location.origin + (path.startsWith('/') ? path : '/' + path)
  }

  // Driver: ensure ?goOnline=1 when routing to orders
  if (typeof PWA_ROLE !== 'undefined' && PWA_ROLE === 'driver') {
    if (fullUrl.indexOf('/driver/orders') !== -1 && fullUrl.indexOf('goOnline=1') === -1) {
      fullUrl += (fullUrl.indexOf('?') !== -1 ? '&' : '?') + 'goOnline=1'
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // 1. Exact match
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i]
        if (client.url === fullUrl && 'focus' in client) {
          return client.focus()
        }
      }
      // 2. Any same-origin window — navigate and focus
      for (var j = 0; j < clientList.length; j++) {
        var c = clientList[j]
        if (c.url && c.url.indexOf(self.location.origin) !== -1 && 'focus' in c) {
          c.postMessage({ type: 'PUSH_NOTIFICATION_CLICK', url: fullUrl })
          if ('navigate' in c && c.url !== fullUrl) c.navigate(fullUrl)
          return c.focus()
        }
      }
      // 3. Fallback: open new window
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl)
    })
  )
})

// ─── Skip Waiting Message ──────────────────────────────────────────────────────
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

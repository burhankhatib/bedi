// Bedi Tenant Dashboard PWA Service Worker
'use strict'

var PWA_ROLE = 'tenant-dashboard';
var PWA_DEFAULT_URL = '/dashboard';
var PWA_DEFAULT_ICON = '/adminslogo.webp';
var PWA_TAG = 'bedi-business-new-order';
var PWA_DEFAULT_TITLE = 'New order';
var PWA_DEFAULT_DIR = 'ltr';
// Stay in "waiting" until user taps Update — SKIP_WAITING is sent from PWAUpdateBanner
var PWA_SKIP_WAITING = false;

// ─── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', function (event) {
  if (PWA_SKIP_WAITING) {
    event.waitUntil(self.skipWaiting())
  }
})

// ─── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

// ─── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', function (event) {
  try {
    var reqUrl = new URL(event.request.url)
    if (reqUrl.origin !== self.location.origin) return
    if (reqUrl.pathname.startsWith('/studio')) return
    // Skip specific static resources that could confuse the cache
    if (reqUrl.pathname.endsWith('.webmanifest')) return
    if (reqUrl.pathname.endsWith('.js') && reqUrl.pathname.includes('sw')) return
    if (event.request.mode === 'navigate') {
      event.respondWith(fetch(event.request))
    }
  } catch (_) {}
})

// ─── Push ──────────────────────────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  var data = { title: PWA_DEFAULT_TITLE, body: '', url: PWA_DEFAULT_URL, icon: PWA_DEFAULT_ICON, dir: PWA_DEFAULT_DIR }

  if (event.data) {
    try {
      var raw = event.data.json()
      var notif = raw.notification || {}
      var dataPayload = raw.data || raw
    // Optional: we can extract a specific tag from the payload to allow different types of notifications to stack differently
    var tag = dataPayload.tag || raw.tag || PWA_TAG;

    data = {
      title: notif.title || dataPayload.title || raw.title || data.title,
      body: notif.body || dataPayload.body || raw.body || data.body,
      url: dataPayload.url || raw.url || data.url,
      icon: notif.icon || dataPayload.icon || raw.icon || data.icon,
      dir: dataPayload.dir || raw.dir || data.dir,
      tag: tag
    }
    } catch (_) {}
  }

  var notifUrl = data.url || PWA_DEFAULT_URL
  var options = {
    body: data.body || 'Tap to open.',
    icon: data.icon || PWA_DEFAULT_ICON,
    badge: data.icon || PWA_DEFAULT_ICON,
    data: { url: notifUrl },
    tag: data.tag || PWA_TAG,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
  }

  if (data.dir === 'rtl') {
    options.dir = 'rtl'
    options.lang = 'ar'
  }

  event.waitUntil(
    self.registration.showNotification(data.title || PWA_DEFAULT_TITLE, options)
  )
})

// ─── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var path = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : PWA_DEFAULT_URL

  var fullUrl
  try {
    fullUrl = new URL(path, self.location.origin).href
  } catch (_) {
    fullUrl = self.location.origin + (path.startsWith('/') ? path : '/' + path)
  }

  var targetPath = fullUrl.replace(self.location.origin, '').split('?')[0].split('#')[0]
  var pushClient = event.notification.data && event.notification.data.pushClient ? event.notification.data.pushClient : null

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      var i, c, p, dm

      // 1) Exact path match — focus without navigation
      for (i = 0; i < clientList.length; i++) {
        c = clientList[i]
        if (!c.url || c.url.indexOf(self.location.origin) !== 0) continue
        p = c.url.replace(self.location.origin, '').split('?')[0].split('#')[0]
        dm = c.displayMode
        var isStandalone = dm === 'standalone' || dm === 'fullscreen' || dm === 'minimal-ui'
        if (p === targetPath && 'focus' in c) {
          if (pushClient === 'pwa' && !isStandalone) continue
          if (pushClient === 'browser' && isStandalone) continue
          return c.focus()
        }
      }

      // 2) Prefer installed PWA window (standalone / fullscreen)
      if (pushClient !== 'browser') {
        var standaloneClient = null
        for (i = 0; i < clientList.length; i++) {
          c = clientList[i]
          if (!c.url || c.url.indexOf(self.location.origin) !== 0) continue
          if (!('navigate' in c)) continue
          dm = c.displayMode
          if (dm === 'standalone' || dm === 'fullscreen' || dm === 'minimal-ui') {
            standaloneClient = c
            break
          }
        }
        if (standaloneClient) {
          standaloneClient.postMessage({ type: 'PUSH_NOTIFICATION_CLICK', url: fullUrl })
          return standaloneClient.navigate(fullUrl).then(function () { return standaloneClient.focus() }).catch(function () { return standaloneClient.focus() })
        }
      }

      // 3) Prefer currently focused same-origin window
      for (i = 0; i < clientList.length; i++) {
        c = clientList[i]
        if (!c.url || c.url.indexOf(self.location.origin) !== 0) continue
        if (!c.focused || !('navigate' in c)) continue
        dm = c.displayMode
        var isStandalone2 = dm === 'standalone' || dm === 'fullscreen' || dm === 'minimal-ui'
        if (pushClient === 'pwa' && !isStandalone2) continue
        if (pushClient === 'browser' && isStandalone2) continue

        c.postMessage({ type: 'PUSH_NOTIFICATION_CLICK', url: fullUrl })
        return c.navigate(fullUrl).then(function () { return c.focus() }).catch(function () { return c.focus() })
      }

      // 4) Any same-origin window
      for (i = 0; i < clientList.length; i++) {
        c = clientList[i]
        if (!c.url || c.url.indexOf(self.location.origin) !== 0) continue
        if (!('navigate' in c)) continue
        dm = c.displayMode
        var isStandalone3 = dm === 'standalone' || dm === 'fullscreen' || dm === 'minimal-ui'
        if (pushClient === 'pwa' && !isStandalone3) continue
        if (pushClient === 'browser' && isStandalone3) continue

        c.postMessage({ type: 'PUSH_NOTIFICATION_CLICK', url: fullUrl })
        return c.navigate(fullUrl).then(function () { return c.focus() }).catch(function () { return c.focus() })
      }

      // 5) Fallback to open a new tab/window
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl)
    })
  )
})

// ─── Skip Waiting Message ──────────────────────────────────────────────────────
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

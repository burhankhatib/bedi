import { NextRequest } from 'next/server'

/**
 * Serves per-business CUSTOMER PWA service worker at /t/[slug]/customer-sw.js.
 * This enables independent customer app installs per business page.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const script = `// Bedi Per-Business Customer PWA Service Worker
'use strict'

var PWA_ROLE = 'customer-business';
var PWA_DEFAULT_URL = '/t/${slug}';
var PWA_DEFAULT_ICON = '/t/${slug}/icon/192';
var PWA_TAG = 'bedi-customer-${slug}';
var PWA_DEFAULT_TITLE = 'Bedi';
var PWA_DEFAULT_DIR = 'ltr';
var PWA_SKIP_WAITING = true;

self.addEventListener('install', function (event) {
  if (PWA_SKIP_WAITING) {
    event.waitUntil(self.skipWaiting())
  }
})

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', function (event) {
  try {
    var reqUrl = new URL(event.request.url)
    if (reqUrl.origin !== self.location.origin) return
    var p = reqUrl.pathname
    // Ensure we only control this specific business
    if (!p.startsWith('/t/${slug}')) return
    if (event.request.mode === 'navigate') {
      event.respondWith(fetch(event.request))
    }
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

  event.waitUntil(
    self.registration.showNotification(data.title || PWA_DEFAULT_TITLE, options)
  )
})

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

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i]
        if (client.url === fullUrl && 'focus' in client) {
          return client.focus()
        }
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
`

  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Service-Worker-Allowed': `/t/${slug}/`,
    },
  })
}

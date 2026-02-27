// SELF-DESTRUCT SERVICE WORKER
// This script will immediately unregister itself and clear all caches.
// This is used to fix "stuck" PWAs after removing offline caching features.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clear all caches
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      }),
      // Unregister this service worker
      self.registration.unregister(),
      // Claim clients to allow reload
      self.clients.claim()
    ]).then(() => {
      // Notify all clients to reload
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          if (client.url && 'navigate' in client) {
            client.navigate(client.url);
          }
        });
      });
    })
  );
});

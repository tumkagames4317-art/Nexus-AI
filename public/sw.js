// Basic Service Worker for PWA installability
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('nexus-v1').then((cache) => {
      // Offline fallback can be empty, but we need the cache open call often
      return cache.addAll(['/']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

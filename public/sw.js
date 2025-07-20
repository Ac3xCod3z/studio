// sw.js

const CACHE_NAME = 'fiscalflow-cache-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
  // Note: Next.js assets are dynamically hashed and cached by the service worker at runtime.
];

self.addEventListener('install', (event) => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Add core app shell files to cache.
        // This is a minimal set; Next.js assets are handled dynamically.
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force the waiting service worker to become the active service worker.
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // If the cache name is not in our whitelist, delete it.
          // This is the key step to clearing out old caches.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open clients.
  );
});

self.addEventListener('fetch', (event) => {
  // We will use a "network falling back to cache" strategy for navigation requests
  // to ensure users get the latest version if they are online.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // For other requests (CSS, JS, images), "cache first" is a good strategy.
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

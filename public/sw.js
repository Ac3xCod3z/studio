// A unique name for the cache, updated on each build
const CACHE_NAME = `fiscalflow-v${new Date().getTime()}`;

// This event listener is fired when the service worker is first installed.
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  // The service worker should take over the page immediately.
  event.waitUntil(self.skipWaiting());
});

// This event listener is fired when the service worker is activated.
// Activation is the perfect time to clean up old caches.
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    (async () => {
      // Get all the cache keys (cache names)
      const keys = await caches.keys();
      // Delete all caches that are not the current one
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log(`[SW] Deleting old cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
      // After activation, the service worker should take control of all open clients.
      return self.clients.claim();
    })()
  );
});

// This event listener is fired for every network request.
// It implements a "network first, falling back to cache" strategy.
self.addEventListener('fetch', (event) => {
  // We only want to handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Try to fetch the resource from the network.
        const networkResponse = await fetch(event.request);
        
        // If the fetch is successful, open the cache and store a copy of the response.
        const cache = await caches.open(CACHE_NAME);
        // We must clone the response because it's a stream and can only be consumed once.
        cache.put(event.request, networkResponse.clone());
        
        // Return the network response.
        return networkResponse;
      } catch (error) {
        // If the network request fails (e.g., user is offline),
        // try to get the resource from the cache.
        console.log(`[SW] Network fetch failed for ${event.request.url}. Trying cache.`);
        const cachedResponse = await caches.match(event.request);
        
        // If the resource is in the cache, return it.
        // Otherwise, the request will fail, which is the expected behavior for offline.
        return cachedResponse;
      }
    })()
  );
});

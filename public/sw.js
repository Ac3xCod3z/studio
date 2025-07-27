// A basic service worker for PWA functionality

self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
});

self.addEventListener('fetch', (event) => {
  // Basic fetch handler, you can add caching strategies here
  event.respondWith(fetch(event.request));
});

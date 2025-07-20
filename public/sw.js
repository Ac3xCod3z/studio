// public/sw.js

// This file is intentionally left blank initially. 
// It will be populated with PWA and notification logic.

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('Service Worker installing.');
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
  console.log('Service Worker activating.');
});

self.addEventListener('notificationclick', (event) => {
  console.log('On notification click: ', event.notification.tag);
  event.notification.close();

  // This looks at all open tabs and windows and focuses the first one that matches
  event.waitUntil(clients.matchAll({
    type: "window"
  }).then((clientList) => {
    for (const client of clientList) {
      if (client.url === '/' && 'focus' in client)
        return client.focus();
    }
    if (clients.openWindow)
      return clients.openWindow('/');
  }));
});

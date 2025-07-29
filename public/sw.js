// public/sw.js

// This file is intentionally kept simple to handle notification-related events.
// A more complex app might have caching strategies here for PWA offline support.

self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  // Skip waiting so the new service worker activates immediately.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  // Take control of all pages under its scope immediately.
  event.waitUntil(self.clients.claim());
});

// Listen for the notificationclick event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked.');
  
  // Close the notification
  event.notification.close();

  // Open the app or focus on an existing window
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});

// A placeholder fetch event listener. 
// This can be expanded for full PWA offline caching.
self.addEventListener('fetch', (event) => {
  // This service worker does not intercept fetch requests.
  // It's primarily for notifications.
});

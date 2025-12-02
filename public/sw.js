/// <reference lib="webworker" />

// Service Worker for Push Notifications
// This runs in the background and handles push events

const SW_VERSION = '1.0.0';

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker version:', SW_VERSION);
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(self.clients.claim());
});

// Push event - when we receive a push notification
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  if (!event.data) {
    console.log('[SW] No data in push event');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW] Push data:', data);

    const options = {
      body: data.body || 'You have a new notification',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/badge-72x72.png',
      tag: data.tag || 'default',
      data: {
        url: data.url || '/',
        ...data.data,
      },
      vibrate: [100, 50, 100],
      actions: data.actions || [],
      requireInteraction: data.requireInteraction || false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Waddy Diet Master', options)
    );
  } catch (error) {
    console.error('[SW] Error processing push:', error);
    
    // Fallback for plain text
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Waddy Diet Master', {
        body: text,
        icon: '/icons/icon-192x192.png',
      })
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (url !== '/') {
            client.navigate(url);
          }
          return;
        }
      }
      // Open a new window if none found
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );

  // Track click (send to API)
  if (event.notification.data?.notificationId) {
    fetch('/api/notifications/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: event.notification.data.notificationId }),
    }).catch(console.error);
  }
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});

// Background sync (for offline support)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
});

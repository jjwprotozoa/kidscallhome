// public/sw.js
// Service Worker for PWA push notifications and background tasks

const CACHE_NAME = 'kidscallhome-v1';
const RUNTIME_CACHE = 'kidscallhome-runtime';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim(); // Take control of all pages immediately
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  let notificationData = {
    title: 'Incoming Call',
    body: 'You have an incoming call',
    icon: '/icon-192x192.png',
    badge: '/icon-96x96.png',
    tag: 'incoming-call',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {}
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        data: data
      };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  const notificationData = event.notification.data || {};
  const callId = notificationData.callId;
  const urlToOpen = notificationData.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          // Focus existing window and send message to start ringing
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            callId: callId,
            url: urlToOpen
          });
          return;
        }
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen).then((client) => {
          if (client) {
            // Send message to start ringing after window opens
            setTimeout(() => {
              client.postMessage({
                type: 'NOTIFICATION_CLICKED',
                callId: callId,
                url: urlToOpen
              });
            }, 500);
          }
        });
      }
    })
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Skip service worker registration requests
  if (url.pathname.includes('/sw.js') || url.pathname.includes('service-worker')) {
    return;
  }

  // Skip Vite HMR and dev server requests during development
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    // For development, let browser handle requests normally to avoid caching issues
    // Only intercept if it's a static asset that should be cached
    if (!url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      return; // Don't intercept - let browser handle normally
    }
  }

  // For navigation requests in development, let browser handle them
  if (event.request.mode === 'navigate' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    return; // Don't intercept navigation requests in development
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version if available
      if (response) {
        return response;
      }

      // Fetch from network with error handling
      return fetch(event.request).catch((error) => {
        console.error('[SW] Fetch failed for:', event.request.url, error);
        
        // For navigation requests, return a basic HTML response
        if (event.request.mode === 'navigate') {
          return new Response('Network error. Please check your connection.', {
            status: 408,
            headers: { 'Content-Type': 'text/html' }
          });
        }
        
        // For other requests, return a basic error response
        return new Response('Network error', {
          status: 408,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    }).catch((error) => {
      console.error('[SW] Cache match failed:', error);
      // Try to fetch from network
      return fetch(event.request).catch((fetchError) => {
        console.error('[SW] Network fetch also failed:', fetchError);
        // Return a basic error response
        return new Response('Service unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});


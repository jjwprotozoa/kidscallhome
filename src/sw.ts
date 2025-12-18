/// <reference lib="webworker" />
// Custom Service Worker with notification action handlers
// This is used with vite-plugin-pwa's injectManifest mode

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

// Take control immediately
self.skipWaiting();
clientsClaim();

// Clean up old caches
cleanupOutdatedCaches();

// Precache assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);

// Cache Google Fonts stylesheets
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Cache Google Fonts webfont files
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Cache vendor chunks (rarely change)
registerRoute(
  /\/assets\/(react-vendor|supabase-vendor|radix-vendor|query-vendor|capacitor-vendor)-.*\.js/,
  new CacheFirst({
    cacheName: 'vendor-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// NetworkFirst for main app bundle
registerRoute(
  /\/assets\/index-.*\.js/,
  new NetworkFirst({
    cacheName: 'app-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// StaleWhileRevalidate for other JS chunks
registerRoute(
  /\/assets\/.*\.js/,
  new StaleWhileRevalidate({
    cacheName: 'chunks-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Cache static assets
registerRoute(
  /\/assets\/.*\.(css|woff2?|ttf|eot|png|jpg|jpeg|gif|svg|ico)/,
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Cache Supabase Storage images
registerRoute(
  /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/.*/i,
  new CacheFirst({
    cacheName: 'supabase-storage',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// =============================================================================
// CUSTOM NOTIFICATION HANDLERS FOR INCOMING CALLS
// =============================================================================

// Handle notification clicks (including action button clicks)
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] Notification clicked:', event);
  console.log('[SW] Action:', event.action);
  
  event.notification.close();

  const notificationData = event.notification.data || {};
  const callId = notificationData.callId;
  const urlToOpen = notificationData.url || '/';
  const action = event.action; // 'answer', 'decline', or '' (clicked notification body)

  // Determine the message type based on action
  let messageType = 'NOTIFICATION_CLICKED';
  if (action === 'answer') {
    messageType = 'NOTIFICATION_ACTION_ANSWER';
  } else if (action === 'decline') {
    messageType = 'NOTIFICATION_ACTION_DECLINE';
  }

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Find any existing window from our app
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // Check if this is a window from our app (same origin)
        if ('focus' in client) {
          // Focus existing window and send message
          (client as WindowClient).focus();
          client.postMessage({
            type: messageType,
            callId: callId,
            url: urlToOpen,
            action: action
          });
          
          // For answer action, also navigate to call URL
          if (action === 'answer' && urlToOpen !== '/') {
            (client as WindowClient).navigate(urlToOpen);
          }
          return;
        }
      }
      
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        // For decline action, open home page; for answer, open call URL
        const targetUrl = action === 'decline' ? '/' : urlToOpen;
        
        return self.clients.openWindow(targetUrl).then((client) => {
          if (client) {
            // Send message after window opens
            setTimeout(() => {
              client.postMessage({
                type: messageType,
                callId: callId,
                url: urlToOpen,
                action: action
              });
            }, 500);
          }
        });
      }
    })
  );
});

// Handle push notifications (for future server-sent push)
self.addEventListener('push', (event: PushEvent) => {
  console.log('[SW] Push notification received:', event);
  
  let notificationData = {
    title: 'Incoming Call',
    body: 'You have an incoming call',
    icon: '/icon-192x192.png',
    badge: '/icon-96x96.png',
    tag: 'incoming-call',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {},
    actions: [
      { action: 'answer', title: '✓ Answer' },
      { action: 'decline', title: '✕ Decline' }
    ]
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        data: data,
        actions: data.actions || notificationData.actions
      };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Handle messages from the app
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Custom service worker with notification handlers loaded');


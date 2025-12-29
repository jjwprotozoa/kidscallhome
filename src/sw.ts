/// <reference lib="webworker" />
// Custom Service Worker with notification action handlers
// This is used with vite-plugin-pwa's injectManifest mode

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim, setLogLevel } from 'workbox-core';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

// Suppress Workbox warnings for expected "not found" cases
// This prevents console spam from source files and API requests
if (typeof self !== 'undefined' && self.console) {
  const originalWarn = self.console.warn;
  self.console.warn = function(...args: any[]) {
    const message = args[0]?.toString() || '';
    const url = args[1]?.toString() || args[2]?.toString() || '';
    
    // Suppress "Precaching did not find a match" and "No route found" warnings
    // for source files and API requests (expected behavior)
    if (
      (message.includes('Precaching did not find a match') ||
       message.includes('No route found')) &&
      (url.includes('/src/') ||
       url.includes('/@vite/') ||
       url.includes('/@react-refresh/') ||
       url.includes('.supabase.co/rest/v1/') ||
       url.includes('.supabase.co/auth/v1/') ||
       url.includes('.supabase.co/realtime/') ||
       url.endsWith('.tsx') ||
       url.endsWith('.ts') ||
       url.includes('icon-192x192.png')) // Missing icon is also expected in dev
    ) {
      return; // Suppress this warning
    }
    // Log other warnings normally
    originalWarn.apply(self.console, args);
  };
}

// Reduce Workbox log level to suppress debug/info messages
// This prevents console spam from source files and API requests
try {
  setLogLevel('warn'); // Only show warnings and errors, not debug/info
} catch (e) {
  // setLogLevel might not be available in all Workbox versions
  // That's okay, we're using console.warn interception instead
}

// Take control immediately
self.skipWaiting();
clientsClaim();

// Clean up old caches
cleanupOutdatedCaches();

// =============================================================================
// REGISTER ROUTES BEFORE PRECACHING
// This ensures API calls and source files are handled before precaching tries to match them
// =============================================================================

// Supabase REST API calls - always go to network, never cache
// This prevents "No route found" errors for API requests
registerRoute(
  ({ url }) => {
    return url.hostname.includes('.supabase.co') && url.pathname.includes('/rest/v1/');
  },
  new NetworkOnly(),
  'GET'
);

// Supabase Auth API calls - always go to network
registerRoute(
  ({ url }) => {
    return url.hostname.includes('.supabase.co') && url.pathname.includes('/auth/v1/');
  },
  new NetworkOnly(),
  'GET'
);

// Supabase Realtime WebSocket - always go to network
registerRoute(
  ({ url }) => {
    return url.hostname.includes('.supabase.co') && url.pathname.includes('/realtime/');
  },
  new NetworkOnly(),
  'GET'
);

// Ignore source files - don't try to cache or handle them
// This prevents "No route found" errors for /src/** requests
registerRoute(
  ({ url }) => {
    return url.pathname.startsWith('/src/') || 
           url.pathname.includes('/@vite/') ||
           url.pathname.includes('/@react-refresh/') ||
           url.pathname.endsWith('.tsx') ||
           url.pathname.endsWith('.ts');
  },
  new NetworkOnly(),
  'GET'
);

// Precache assets injected by vite-plugin-pwa
// This runs after routes are registered, so source files won't trigger precaching errors
precacheAndRoute(self.__WB_MANIFEST || []);

// Catch-all handler for unmatched requests - silently handle
// This prevents "No route found" errors from appearing in console
setCatchHandler(({ event }) => {
  const url = new URL(event.request.url);
  
  // For source files and API requests, just pass through to network
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@react-refresh/') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.hostname.includes('.supabase.co')
  ) {
    return fetch(event.request).catch(() => {
      // Return empty response for failed requests to prevent errors
      return new Response('', { status: 0 });
    });
  }
  
  // For other unmatched requests, try network
  return fetch(event.request);
});

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
// Optimized to prevent message handler violations by breaking up work
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  // Close notification immediately (non-blocking)
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

  // Use waitUntil to keep service worker alive, but break up work to prevent blocking
  event.waitUntil(
    // Step 1: Find clients (async, non-blocking)
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Step 2: Process client operations asynchronously to prevent blocking
      return new Promise<void>((resolve) => {
        // Use setTimeout to yield to event loop and prevent blocking
        setTimeout(() => {
          // Find any existing window from our app
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            // Check if this is a window from our app (same origin)
            if ('focus' in client) {
              // Focus existing window (defer heavy operations)
              const windowClient = client as WindowClient;
              
              // Use requestIdleCallback if available, otherwise setTimeout
              const scheduleWork = (callback: () => void) => {
                if ('requestIdleCallback' in self) {
                  (self as any).requestIdleCallback(callback, { timeout: 100 });
                } else {
                  setTimeout(callback, 0);
                }
              };
              
              // Defer focus and navigation to prevent blocking
              scheduleWork(() => {
                try {
                  windowClient.focus();
                } catch (e) {
                  // Ignore focus errors
                }
              });
              
              // Send message immediately (lightweight operation)
              try {
                client.postMessage({
                  type: messageType,
                  callId: callId,
                  url: urlToOpen,
                  action: action
                });
              } catch (e) {
                // Ignore postMessage errors
              }
              
              // Defer navigation to prevent blocking
              if (action === 'answer' && urlToOpen !== '/') {
                scheduleWork(() => {
                  try {
                    windowClient.navigate(urlToOpen);
                  } catch (e) {
                    // Ignore navigation errors
                  }
                });
              }
              
              resolve();
              return;
            }
          }
          
          // If no window is open, open a new one (async operation)
          if (self.clients.openWindow) {
            const targetUrl = action === 'decline' ? '/' : urlToOpen;
            
            self.clients.openWindow(targetUrl).then((client) => {
              if (client) {
                // Send message after window opens (defer to prevent blocking)
                setTimeout(() => {
                  try {
                    client.postMessage({
                      type: messageType,
                      callId: callId,
                      url: urlToOpen,
                      action: action
                    });
                  } catch (e) {
                    // Ignore postMessage errors
                  }
                }, 100); // Reduced from 500ms to 100ms
              }
              resolve();
            }).catch(() => {
              resolve(); // Resolve even on error
            });
          } else {
            resolve();
          }
        }, 0); // Yield to event loop immediately
      });
    }).catch(() => {
      // Silently handle errors to prevent unhandled rejections
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




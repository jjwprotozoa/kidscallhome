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
    data: {},
    // Add action buttons for incoming calls
    actions: [
      { action: 'answer', title: '✓ Answer', icon: '/icons/answer-call.png' },
      { action: 'decline', title: '✕ Decline', icon: '/icons/decline-call.png' }
    ]
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        data: data,
        // Preserve actions if this is a call notification
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

// Handle notification clicks (including action button clicks)
self.addEventListener('notificationclick', (event) => {
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
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Find any existing window from our app
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // Check if this is a window from our app (same origin)
        if ('focus' in client) {
          // Focus existing window and send message
          client.focus();
          client.postMessage({
            type: messageType,
            callId: callId,
            url: urlToOpen,
            action: action
          });
          
          // For answer action, also navigate to call URL
          if (action === 'answer' && urlToOpen !== '/') {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        // For decline action, we don't need to open a window, just send message
        // But we need a window to handle the decline...
        const targetUrl = action === 'decline' ? '/' : urlToOpen;
        
        return clients.openWindow(targetUrl).then((client) => {
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

  // Skip external API requests that don't support CORS (let browser handle them)
  const knownExternalAPIs = [
    'haveibeenpwned.com',
    'ip-api.com',
    'ipapi.co'
  ];
  if (knownExternalAPIs.some(api => url.hostname.includes(api))) {
    return; // Don't intercept - let browser handle CORS errors normally
  }

  // In development, completely bypass service worker for most requests
  // This prevents interference with Vite HMR and dev server
  const isDevelopment = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.port === '5173';
  
  if (isDevelopment) {
    // Only intercept static assets that are explicitly cached
    // Skip all other requests including API calls, HMR, and navigation
    if (!url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      return; // Don't intercept - let browser handle normally
    }
    
    // For static assets in dev, try cache first but don't fail if network fails
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Fetch from network, but if it fails, return a basic response instead of throwing
        return fetch(event.request).catch(() => {
          // Return a basic response instead of throwing to prevent unhandled rejections
          return new Response('', { status: 408 });
        });
      }).catch(() => {
        // If cache match fails, try network
        return fetch(event.request).catch(() => {
          // Return a basic response instead of throwing
          return new Response('', { status: 408 });
        });
      })
    );
    return;
  }

  // Production: use cache-first strategy with network fallback
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version if available
      if (response) {
        return response;
      }

      // Fetch from network with error handling
      return fetch(event.request).catch((error) => {
        const url = new URL(event.request.url);
        
        // Skip logging for known external APIs that don't support CORS (expected to fail)
        const isKnownExternalAPI = knownExternalAPIs.some(api => url.hostname.includes(api));
        
        // Only log errors for internal requests or unexpected failures
        if (!isKnownExternalAPI) {
          console.error('[SW] Fetch failed for:', event.request.url, error);
        }
        
        // For navigation requests, return a basic HTML response
        if (event.request.mode === 'navigate') {
          return new Response('Network error. Please check your connection.', {
            status: 408,
            headers: { 'Content-Type': 'text/html' }
          });
        }
        
        // For external API requests that fail (CORS, etc.), return empty response
        // Don't throw to prevent unhandled promise rejections
        if (isKnownExternalAPI) {
          return new Response('', { status: 0 });
        }
        
        // For other requests, return a basic error response
        return new Response('Network error', {
          status: 408,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    }).catch((error) => {
      // Only log unexpected errors
      const url = new URL(event.request.url);
      const isKnownExternalAPI = knownExternalAPIs.some(api => 
        url.hostname.includes(api)
      );
      
      if (!isKnownExternalAPI) {
        console.error('[SW] Cache match failed:', error);
      }
      
      // Try to fetch from network
      return fetch(event.request).catch((fetchError) => {
        // Only log if it's not a known external API
        if (!isKnownExternalAPI) {
          console.error('[SW] Network fetch also failed:', fetchError);
        }
        
        // For external APIs, return empty response instead of throwing
        if (isKnownExternalAPI) {
          return new Response('', { status: 0 });
        }
        
        // Return a basic error response for internal requests
        return new Response('Service unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});

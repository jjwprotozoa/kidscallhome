// public/sw.js
// Service Worker for PWA push notifications and background tasks

// Increment version to force cache refresh when deploying breaking changes
// IMPORTANT: Increment this version number when making breaking changes
const CACHE_VERSION = 3;
const CACHE_NAME = `kidscallhome-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `kidscallhome-runtime-v${CACHE_VERSION}`;

// iOS Safari detection - iOS has unique caching issues that require special handling
const isIOS = /iPad|iPhone|iPod/.test(self.navigator?.userAgent || '') || 
  (self.navigator?.platform === 'MacIntel' && self.navigator?.maxTouchPoints > 1);

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing... version:', CACHE_VERSION);
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating... version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          // Delete ALL old caches that don't match current version
          .filter((name) => name.startsWith('kidscallhome') && name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately - critical for iOS
  return self.clients.claim();
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
// Optimized to prevent message handler violations by breaking up work
self.addEventListener('notificationclick', (event) => {
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
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Step 2: Process client operations asynchronously to prevent blocking
      return new Promise(function(resolve) {
        // Use setTimeout to yield to event loop and prevent blocking
        setTimeout(function() {
          // Find any existing window from our app
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            // Check if this is a window from our app (same origin)
            if ('focus' in client) {
              // Use requestIdleCallback if available, otherwise setTimeout
              var scheduleWork = function(callback) {
                if ('requestIdleCallback' in self) {
                  self.requestIdleCallback(callback, { timeout: 100 });
                } else {
                  setTimeout(callback, 0);
                }
              };
              
              // Defer focus and navigation to prevent blocking
              scheduleWork(function() {
                try {
                  client.focus();
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
                scheduleWork(function() {
                  try {
                    client.navigate(urlToOpen);
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
          if (clients.openWindow) {
            var targetUrl = action === 'decline' ? '/' : urlToOpen;
            
            clients.openWindow(targetUrl).then(function(client) {
              if (client) {
                // Send message after window opens (defer to prevent blocking)
                setTimeout(function() {
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
            }).catch(function() {
              resolve(); // Resolve even on error
            });
          } else {
            resolve();
          }
        }, 0); // Yield to event loop immediately
      });
    }).catch(function() {
      // Silently handle errors to prevent unhandled rejections
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
  // Also skip Google Fonts to avoid CSP violations - let browser handle them directly
  const knownExternalAPIs = [
    'haveibeenpwned.com',
    'ip-api.com',
    'ipapi.co'
  ];
  const googleFontsDomains = [
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ];
  // Analytics domains - NEVER intercept, let browser handle directly
  // Using strict matching to avoid accidental host matches (e.g., "fake-va.vercel-scripts.com.evil.com")
  const analyticsDomains = [
    'vitals.vercel-insights.com',
    'va.vercel-scripts.com'
  ];
  
  // Supabase domains - NEVER cache, always go to network
  const supabaseDomains = [
    '.supabase.co'
  ];
  
  // Strict hostname matching helper: exact match OR subdomain of the domain
  const isAnalyticsDomain = (hostname, domain) => {
    return hostname === domain || hostname.endsWith('.' + domain);
  };
  
  // CRITICAL: Skip Supabase requests entirely - let browser handle them
  // This prevents stale auth tokens and API responses from being cached
  if (supabaseDomains.some(domain => url.hostname.includes(domain))) {
    return; // Don't intercept - let browser handle Supabase directly
  }
  
  // CRITICAL: Skip analytics requests to ensure they fire reliably
  // Uses strict matching to prevent bypass via malicious subdomains
  // Must return a Response (not undefined) to avoid intermittent failures in some browsers
  if (analyticsDomains.some(domain => isAnalyticsDomain(url.hostname, domain))) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // CRITICAL: Skip Google Fonts FIRST to prevent CSP violations
  // The service worker must not intercept these requests at all
  if (googleFontsDomains.some(domain => url.hostname.includes(domain))) {
    return; // Don't intercept - let browser handle Google Fonts directly
  }
  
  if (knownExternalAPIs.some(api => url.hostname.includes(api))) {
    return; // Don't intercept - let browser handle CORS errors normally
  }

  // In development, completely bypass service worker for most requests
  // This prevents interference with Vite HMR and dev server
  const isDevelopment = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.port === '5173';
  
  if (isDevelopment) {
    // Only intercept static assets that are explicitly cached
    // Skip all other requests including API calls, HMR, navigation, and Google Fonts
    if (!url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      return; // Don't intercept - let browser handle normally
    }
    
    // Double-check: Never intercept Google Fonts even in development
    if (googleFontsDomains.some(domain => url.hostname.includes(domain))) {
      return;
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

  // =============================================================================
  // PRODUCTION CACHING STRATEGY
  // =============================================================================
  // iOS Safari has aggressive caching that can cause stale content issues.
  // We use NETWORK-FIRST for HTML/navigation and CACHE-FIRST for static assets.
  // This ensures iOS users always get fresh HTML while benefiting from cached assets.
  // =============================================================================

  // Double-check: Never intercept Google Fonts (should already be skipped above)
  if (googleFontsDomains.some(domain => url.hostname.includes(domain))) {
    return;
  }
  
  // For navigation requests (HTML pages), use NETWORK-FIRST strategy
  // This is critical for iOS to prevent serving stale HTML that references
  // old JavaScript bundles that no longer exist
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Network succeeded, return fresh response
          return networkResponse;
        })
        .catch((error) => {
          console.warn('[SW] Navigation fetch failed, trying cache:', error);
          // Network failed, try cache as fallback
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // No cache available, return offline page
            return new Response(`
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Kids Call Home - Offline</title>
                <style>
                  body { font-family: system-ui, sans-serif; padding: 2rem; text-align: center; }
                  h1 { color: #3b82f6; }
                  button { background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
                  button:hover { background: #2563eb; }
                  .retry { margin-top: 2rem; }
                </style>
              </head>
              <body>
                <h1>Kids Call Home</h1>
                <p>You appear to be offline. Please check your internet connection.</p>
                <div class="retry">
                  <button onclick="window.location.reload()">Try Again</button>
                </div>
              </body>
              </html>
            `, {
              status: 503,
              headers: { 'Content-Type': 'text/html' }
            });
          });
        })
    );
    return;
  }
  
  // For static assets (JS, CSS, images), use cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version if available
      if (response) {
        return response;
      }

      // Fetch from network with error handling
      return fetch(event.request).catch((error) => {
        const reqUrl = new URL(event.request.url);
        
        // Skip logging for known external APIs that don't support CORS (expected to fail)
        const isKnownExternalAPI = knownExternalAPIs.some(api => reqUrl.hostname.includes(api));
        
        // Only log errors for internal requests or unexpected failures
        if (!isKnownExternalAPI) {
          console.error('[SW] Fetch failed for:', event.request.url, error);
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
      const reqUrl = new URL(event.request.url);
      const isKnownExternalAPI = knownExternalAPIs.some(api => 
        reqUrl.hostname.includes(api)
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


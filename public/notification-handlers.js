// public/notification-handlers.js
// Custom notification handlers for incoming call notifications on Windows/Chrome/Edge
// This file is imported by the Workbox-generated service worker via importScripts

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

// Handle push notifications (for future server-sent push)
self.addEventListener('push', (event) => {
  console.log('[SW-HANDLERS] Push notification received:', event);
  
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
      console.error('[SW-HANDLERS] Error parsing push data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  console.log('[SW-HANDLERS] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW-HANDLERS] Custom notification handlers loaded');




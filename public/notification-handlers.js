// public/notification-handlers.js
// Custom notification handlers for incoming call notifications on Windows/Chrome/Edge
// This file is imported by the Workbox-generated service worker via importScripts

// Handle notification clicks (including action button clicks)
self.addEventListener('notificationclick', (event) => {
  console.log('[SW-HANDLERS] Notification clicked:', event);
  console.log('[SW-HANDLERS] Action:', event.action);
  
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
        // For decline action, open home page; for answer, open call URL
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


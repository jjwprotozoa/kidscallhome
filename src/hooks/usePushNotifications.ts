// src/hooks/usePushNotifications.ts
// Hook for managing push notifications and service worker communication
// Handles notification permissions, sending notifications, and responding to notification clicks

import { useEffect, useRef, useCallback } from "react";

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  vibrate?: number[];
  data?: Record<string, any>;
  actions?: NotificationAction[];
}

interface NotificationCallbackData {
  callId: string;
  url?: string;
  action?: 'answer' | 'decline' | '';
}

export const usePushNotifications = () => {
  const serviceWorkerRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const notificationClickHandlerRef = useRef<((data: NotificationCallbackData) => void) | null>(null);
  const notificationAnswerHandlerRef = useRef<((data: NotificationCallbackData) => void) | null>(null);
  const notificationDeclineHandlerRef = useRef<((data: NotificationCallbackData) => void) | null>(null);

  // Register or get service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Wait for vite-plugin-pwa's injectManifest service worker to be ready
      // This works for both development and production since we now use injectManifest mode
      navigator.serviceWorker.ready
        .then((registration) => {
          console.log("✅ [PUSH] Service Worker ready:", registration);
          serviceWorkerRegistrationRef.current = registration;
        })
        .catch((error) => {
          console.error("❌ [PUSH] Service Worker not ready:", error);
        });

      // Listen for messages from service worker (notification clicks)
      // Optimized to prevent message handler violations by deferring heavy work
      const handleServiceWorkerMessage = (event: MessageEvent) => {
        // Extract data immediately (lightweight)
        const { type, callId, url, action } = event.data || {};
        
        // Defer handler execution to prevent blocking the message handler
        // Use requestIdleCallback if available, otherwise setTimeout
        const scheduleHandler = (handler: () => void) => {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(handler, { timeout: 50 });
          } else {
            setTimeout(handler, 0);
          }
        };
        
        scheduleHandler(() => {
          if (type === "NOTIFICATION_ACTION_ANSWER") {
            // User clicked Answer button on notification
            if (import.meta.env.DEV) {
              console.log("📞 [PUSH] Answer action from notification");
            }
            if (notificationAnswerHandlerRef.current) {
              notificationAnswerHandlerRef.current({ callId, url, action: 'answer' });
            }
          } else if (type === "NOTIFICATION_ACTION_DECLINE") {
            // User clicked Decline button on notification
            if (import.meta.env.DEV) {
              console.log("📞 [PUSH] Decline action from notification");
            }
            if (notificationDeclineHandlerRef.current) {
              notificationDeclineHandlerRef.current({ callId, url, action: 'decline' });
            }
          } else if (type === "NOTIFICATION_CLICKED") {
            // User clicked notification body (not action buttons)
            if (import.meta.env.DEV) {
              console.log("📞 [PUSH] Notification body clicked");
            }
            if (notificationClickHandlerRef.current) {
              notificationClickHandlerRef.current({ callId, url, action: '' });
            }
          }
        });
      };

      navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);

      // Cleanup listener on unmount
      return () => {
        navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
      };
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!("Notification" in window)) {
      // Only log once, not repeatedly
      if (import.meta.env.DEV) {
        console.debug("⚠️ [PUSH] This browser does not support notifications");
      }
      return "denied";
    }

    if (Notification.permission === "granted") {
      return "granted";
    }

    if (Notification.permission === "denied") {
      // Only log once in dev mode, not repeatedly - permission denial is expected for some users
      if (import.meta.env.DEV) {
        console.debug("⚠️ [PUSH] Notification permission denied (expected if user declined)");
      }
      return "denied";
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (import.meta.env.DEV) {
      console.log("🔔 [PUSH] Notification permission:", permission);
    }
    return permission;
  }, []);

  // Send a local notification (when tab is not visible)
  const sendNotification = useCallback(
    async (options: NotificationOptions): Promise<void> => {
      if (!("Notification" in window)) {
        console.warn("⚠️ [PUSH] Notifications not supported");
        return;
      }

      const permission = await requestPermission();
      if (permission !== "granted") {
        // Only log in dev mode - permission denial is expected for some users
        // Don't spam console with warnings
        if (import.meta.env.DEV) {
          console.debug("⚠️ [PUSH] Notification permission not granted (expected if user declined)");
        }
        return;
      }

      // Use service worker notification if available, otherwise use regular Notification API
      if (serviceWorkerRegistrationRef.current) {
        try {
          const notificationOptions = {
            body: options.body,
            icon: options.icon || "/icon-192x192.png",
            badge: options.badge || "/icon-96x96.png",
            tag: options.tag || "notification",
            requireInteraction: options.requireInteraction ?? true,
            vibrate: options.vibrate || [200, 100, 200],
            data: options.data || {},
            actions: options.actions || [],
          };
          console.log("📤 [PUSH] Sending notification via service worker:", {
            title: options.title,
            hasActions: (options.actions?.length ?? 0) > 0,
            actions: options.actions,
          });
          await serviceWorkerRegistrationRef.current.showNotification(options.title, notificationOptions);
          console.log("✅ [PUSH] Notification sent via service worker with actions:", options.actions);
        } catch (error) {
          console.error("❌ [PUSH] Failed to send notification:", error);
        }
      } else {
        // Fallback to regular Notification API
        try {
          new Notification(options.title, {
            body: options.body,
            icon: options.icon || "/icon-192x192.png",
            tag: options.tag || "notification",
            requireInteraction: options.requireInteraction ?? true,
            data: options.data || {},
          });
          console.log("✅ [PUSH] Notification sent via Notification API");
        } catch (error) {
          console.error("❌ [PUSH] Failed to send notification:", error);
        }
      }
    },
    [requestPermission]
  );

  // Close all notifications with a specific tag
  const closeNotification = useCallback(async (tag: string): Promise<void> => {
    if (serviceWorkerRegistrationRef.current) {
      const notifications = await serviceWorkerRegistrationRef.current.getNotifications({
        tag: tag,
      });
      notifications.forEach((notification) => notification.close());
    }
  }, []);

  // Register handler for notification clicks (body click)
  const onNotificationClick = useCallback((handler: (data: NotificationCallbackData) => void) => {
    notificationClickHandlerRef.current = handler;
  }, []);

  // Register handler for Answer button click on notification
  const onNotificationAnswer = useCallback((handler: (data: NotificationCallbackData) => void) => {
    notificationAnswerHandlerRef.current = handler;
  }, []);

  // Register handler for Decline button click on notification
  const onNotificationDecline = useCallback((handler: (data: NotificationCallbackData) => void) => {
    notificationDeclineHandlerRef.current = handler;
  }, []);

  return {
    requestPermission,
    sendNotification,
    closeNotification,
    onNotificationClick,
    onNotificationAnswer,
    onNotificationDecline,
    hasPermission: "Notification" in window && Notification.permission === "granted",
    permission: "Notification" in window ? Notification.permission : "default" as NotificationPermission,
  };
};


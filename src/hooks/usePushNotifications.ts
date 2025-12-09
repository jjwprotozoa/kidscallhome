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

export const usePushNotifications = () => {
  const serviceWorkerRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const notificationClickHandlerRef = useRef<((data: any) => void) | null>(null);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("✅ [PUSH] Service Worker registered:", registration);
          serviceWorkerRegistrationRef.current = registration;

          // Listen for service worker updates
          registration.addEventListener("updatefound", () => {
            console.log("🔄 [PUSH] Service Worker update found");
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("🔄 [PUSH] New service worker installed, reload to activate");
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("❌ [PUSH] Service Worker registration failed:", error);
        });

      // Listen for messages from service worker (notification clicks)
      navigator.serviceWorker.addEventListener("message", (event) => {
        console.log("📨 [PUSH] Message from service worker:", event.data);
        
        if (event.data && event.data.type === "NOTIFICATION_CLICKED") {
          const { callId, url } = event.data;
          
          // Call the registered handler
          if (notificationClickHandlerRef.current) {
            notificationClickHandlerRef.current({ callId, url });
          }
        }
      });
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
          await serviceWorkerRegistrationRef.current.showNotification(options.title, {
            body: options.body,
            icon: options.icon || "/icon-192x192.png",
            badge: options.badge || "/icon-96x96.png",
            tag: options.tag || "notification",
            requireInteraction: options.requireInteraction ?? true,
            vibrate: options.vibrate || [200, 100, 200],
            data: options.data || {},
            actions: options.actions || [],
          });
          console.log("✅ [PUSH] Notification sent via service worker");
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

  // Register handler for notification clicks
  const onNotificationClick = useCallback((handler: (data: any) => void) => {
    notificationClickHandlerRef.current = handler;
  }, []);

  return {
    requestPermission,
    sendNotification,
    closeNotification,
    onNotificationClick,
    hasPermission: "Notification" in window && Notification.permission === "granted",
    permission: "Notification" in window ? Notification.permission : "default" as NotificationPermission,
  };
};


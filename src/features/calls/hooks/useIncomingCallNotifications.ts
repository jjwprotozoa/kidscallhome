// src/features/calls/hooks/useIncomingCallNotifications.ts
// Combined hook for handling incoming call notifications with WhatsApp Web-like behavior
// - Shows push notification when tab is not in focus
// - Plays ringtone/vibration when tab is active or after notification click
// - Handles browser autoplay restrictions properly

import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAudioNotifications } from "./useAudioNotifications";

interface IncomingCallData {
  callId: string;
  callerName?: string;
  callerId?: string;
  url?: string;
}

interface UseIncomingCallNotificationsOptions {
  enabled?: boolean;
  volume?: number;
}

export const useIncomingCallNotifications = (
  options: UseIncomingCallNotificationsOptions = {}
) => {
  const { enabled = true, volume = 0.7 } = options;
  const navigate = useNavigate();
  const { isVisible, hasBeenVisible } = useTabVisibility();
  const { sendNotification, closeNotification, onNotificationClick, hasPermission } =
    usePushNotifications();
  const { playRingtone, stopRingtone, startVibration } = useAudioNotifications({
    enabled,
    volume,
  });

  const activeCallRef = useRef<string | null>(null);
  const notificationShownRef = useRef(false);

  // Handle notification click - this is a user gesture, so we can play audio
  useEffect(() => {
    onNotificationClick((data: { callId: string; url?: string }) => {
      console.log("🔔 [CALL NOTIFICATIONS] Notification clicked, starting ringtone", data);
      
      // Close the notification
      closeNotification("incoming-call");

      // Navigate to call if URL provided
      if (data.url) {
        navigate(data.url);
      }

      // Start ringing immediately (notification click = user gesture)
      if (data.callId === activeCallRef.current) {
        playRingtone().catch((error) => {
          console.error("❌ [CALL NOTIFICATIONS] Failed to play ringtone after notification click:", error);
        });
      }
    });
  }, [onNotificationClick, closeNotification, navigate, playRingtone]);

  // Handle incoming call
  const handleIncomingCall = useCallback(
    async (callData: IncomingCallData) => {
      if (!enabled) return;

      activeCallRef.current = callData.callId;
      notificationShownRef.current = false;

      console.log("📞 [CALL NOTIFICATIONS] Handling incoming call:", {
        callId: callData.callId,
        isVisible,
        hasBeenVisible,
      });

      // If tab is visible and has been visible (user has interacted), play ringtone immediately
      if (isVisible && hasBeenVisible) {
        console.log("🔔 [CALL NOTIFICATIONS] Tab is active, playing ringtone immediately");
        playRingtone().catch((error) => {
          console.error("❌ [CALL NOTIFICATIONS] Failed to play ringtone:", error);
        });
      } else {
        // Tab is not visible or hasn't been interacted with - show push notification
        console.log("🔔 [CALL NOTIFICATIONS] Tab is not active, showing push notification");

        // Request notification permission if needed
        if (!hasPermission) {
          // Permission will be requested by sendNotification
        }

        // Show push notification
        await sendNotification({
          title: "Incoming Call",
          body: callData.callerName
            ? `${callData.callerName} is calling...`
            : "You have an incoming call",
          icon: "/icon-192x192.png",
          badge: "/icon-96x96.png",
          tag: "incoming-call",
          requireInteraction: true,
          data: {
            callId: callData.callId,
            callerName: callData.callerName,
            callerId: callData.callerId,
            url: callData.url,
          },
        });

        notificationShownRef.current = true;
      }
    },
    [enabled, isVisible, hasBeenVisible, hasPermission, sendNotification, playRingtone]
  );

  // When tab becomes visible and we have an active call, start ringing
  useEffect(() => {
    if (isVisible && activeCallRef.current && hasBeenVisible) {
      // Tab just became visible - check if we should start ringing
      // Only if notification was shown (meaning we didn't ring before)
      if (notificationShownRef.current) {
        console.log("🔔 [CALL NOTIFICATIONS] Tab became visible, starting ringtone");
        playRingtone().catch((error) => {
          console.error("❌ [CALL NOTIFICATIONS] Failed to play ringtone when tab became visible:", error);
        });
      }
    }
  }, [isVisible, hasBeenVisible, playRingtone]);

  // Stop ringing for a call
  const stopIncomingCall = useCallback(
    async (callId: string) => {
      if (activeCallRef.current === callId) {
        console.log("🔇 [CALL NOTIFICATIONS] Stopping incoming call notifications:", callId);
        stopRingtone();
        await closeNotification("incoming-call");
        activeCallRef.current = null;
        notificationShownRef.current = false;
      }
    },
    [stopRingtone, closeNotification]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeCallRef.current) {
        stopIncomingCall(activeCallRef.current);
      }
    };
  }, [stopIncomingCall]);

  return {
    handleIncomingCall,
    stopIncomingCall,
    hasActiveCall: activeCallRef.current !== null,
    activeCallId: activeCallRef.current,
  };
};


// src/features/calls/hooks/useIncomingCallNotifications.ts
// Combined hook for handling incoming call notifications with WhatsApp Web-like behavior
// - Shows push notification when tab is not in focus (with Answer/Decline buttons on Windows/Chrome/Edge)
// - Plays ringtone/vibration when tab is active or after notification click
// - Handles browser autoplay restrictions properly

import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAudioNotifications } from "./useAudioNotifications";
import { setUserStartedCall } from "@/utils/userInteraction";
import { endCall as endCallUtil } from "@/features/calls/utils/callEnding";

interface IncomingCallData {
  callId: string;
  callerName?: string;
  callerId?: string;
  url?: string;
}

interface UseIncomingCallNotificationsOptions {
  enabled?: boolean;
  volume?: number;
  onAnswerFromNotification?: (callId: string, url?: string) => void;
  onDeclineFromNotification?: (callId: string) => void;
}

export const useIncomingCallNotifications = (
  options: UseIncomingCallNotificationsOptions = {}
) => {
  const { enabled = true, volume = 0.7, onAnswerFromNotification, onDeclineFromNotification } = options;
  const navigate = useNavigate();
  const { isVisible, hasBeenVisible } = useTabVisibility();
  const { 
    sendNotification, 
    closeNotification, 
    onNotificationClick, 
    onNotificationAnswer,
    onNotificationDecline,
    hasPermission 
  } = usePushNotifications();
  const { playRingtone, stopRingtone } = useAudioNotifications({
    enabled,
    volume,
  });

  const activeCallRef = useRef<string | null>(null);
  const notificationShownRef = useRef(false);
  const activeCallDataRef = useRef<IncomingCallData | null>(null);

  // Handle notification body click - navigate to call and start ringing
  useEffect(() => {
    onNotificationClick((data) => {
      // Close the notification
      closeNotification("incoming-call");

      // Navigate to call if URL provided
      if (data.url) {
        navigate(data.url);
      }

      // Start ringing immediately (notification click = user gesture)
      if (data.callId === activeCallRef.current) {
        playRingtone().catch((error) => {
          if (import.meta.env.DEV) {
            console.error("[CALL NOTIFICATIONS] Failed to play ringtone after notification click:", error);
          }
        });
      }
    });
  }, [onNotificationClick, closeNotification, navigate, playRingtone]);

  // Handle Answer button click from notification
  useEffect(() => {
    onNotificationAnswer(async (data) => {
      // Close notification and stop ringtone
      closeNotification("incoming-call");
      stopRingtone();
      
      // Enable audio for the call (user gesture from notification)
      setUserStartedCall();
      
      // Call the external handler if provided
      if (onAnswerFromNotification) {
        onAnswerFromNotification(data.callId, data.url);
      } else if (data.url) {
        // Default: navigate to call URL
        navigate(data.url);
      }
      
      activeCallRef.current = null;
      notificationShownRef.current = false;
    });
  }, [onNotificationAnswer, closeNotification, stopRingtone, navigate, onAnswerFromNotification]);

  // Handle Decline button click from notification
  useEffect(() => {
    onNotificationDecline(async (data) => {
      // Close notification and stop ringtone
      closeNotification("incoming-call");
      stopRingtone();
      
      // End the call in the database - determine who is declining
      if (data.callId) {
        try {
          // Determine the correct 'by' value based on user session
          let by: "child" | "parent" | "family_member" = "parent";
          
          // Check for child session first
          const childSession = localStorage.getItem("childSession");
          if (childSession) {
            by = "child";
          } else {
            // Check for adult session and role
            const { supabase } = await import("@/integrations/supabase/client");
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
              const { getUserRole } = await import("@/utils/userRole");
              const userRole = await getUserRole(session.user.id);
              if (userRole === "family_member") {
                by = "family_member";
              }
            }
          }
          
          await endCallUtil({
            callId: data.callId,
            by,
            reason: "declined",
          });
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error("[CALL NOTIFICATIONS] Failed to decline call:", error);
          }
        }
      }
      
      // Call the external handler if provided
      if (onDeclineFromNotification) {
        onDeclineFromNotification(data.callId);
      }
      
      activeCallRef.current = null;
      activeCallDataRef.current = null;
      notificationShownRef.current = false;
    });
  }, [onNotificationDecline, closeNotification, stopRingtone, onDeclineFromNotification]);

  // Handle incoming call
  const handleIncomingCall = useCallback(
    async (callData: IncomingCallData) => {
      if (!enabled) return;

      activeCallRef.current = callData.callId;
      activeCallDataRef.current = callData;
      notificationShownRef.current = false;

      // If tab is visible and has been visible (user has interacted), play ringtone immediately
      if (isVisible && hasBeenVisible) {
        playRingtone().catch((error) => {
          if (import.meta.env.DEV) {
            console.error("[CALL NOTIFICATIONS] Failed to play ringtone:", error);
          }
        });
      } else {
        // Tab is not visible or hasn't been interacted with - show push notification

        // Request notification permission if needed
        if (!hasPermission) {
          // Permission will be requested by sendNotification
        }

        // Show push notification with Answer/Decline action buttons
        // Action buttons work on Windows (Chrome/Edge), Android Chrome, and desktop Chrome/Edge
        await sendNotification({
          title: "Incoming Call",
          body: callData.callerName
            ? `${callData.callerName} is calling...`
            : "You have an incoming call",
          icon: "/icon-192x192.png",
          badge: "/icon-96x96.png",
          tag: "incoming-call",
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200], // Vibrate pattern for notification
          data: {
            callId: callData.callId,
            callerName: callData.callerName,
            callerId: callData.callerId,
            url: callData.url,
          },
          // Action buttons (supported in Chrome/Edge on Windows, macOS, Linux, Android)
          actions: [
            { action: "answer", title: "✓ Answer" },
            { action: "decline", title: "✕ Decline" },
          ],
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
        playRingtone().catch((error) => {
          if (import.meta.env.DEV) {
            console.error("[CALL NOTIFICATIONS] Failed to play ringtone when tab became visible:", error);
          }
        });
      }
    }
  }, [isVisible, hasBeenVisible, playRingtone]);

  // Stop ringing for a call
  // CRITICAL: If callId matches OR if there's any active call, stop the ringtone
  // This ensures ringtone stops even if callId doesn't match exactly (e.g., when answering via call screen)
  const stopIncomingCall = useCallback(
    async (callId?: string) => {
      // Stop if callId matches, OR if there's any active call (callId not provided means stop any active call)
      if (!callId || activeCallRef.current === callId || activeCallRef.current !== null) {
        stopRingtone();
        await closeNotification("incoming-call");
        activeCallRef.current = null;
        activeCallDataRef.current = null;
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
    activeCallData: activeCallDataRef.current,
  };
};


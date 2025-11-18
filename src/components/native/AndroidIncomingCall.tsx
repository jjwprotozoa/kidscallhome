// src/components/native/AndroidIncomingCall.tsx
// Native Android incoming call UI wrapper
// Purpose: Provides fullscreen native call UI with vibration and ringtone for Android
// This wraps existing GlobalIncomingCall component with native Android enhancements

import { useEffect, useRef } from 'react';
import { isNativeAndroid, vibratePattern, showIncomingCallNotification, cancelIncomingCallNotification } from '@/utils/nativeAndroid';
import { useIncomingCallNotifications } from '@/features/calls/hooks/useIncomingCallNotifications';
import { useAudioNotifications } from '@/features/calls/hooks/useAudioNotifications';

interface AndroidIncomingCallProps {
  callId: string;
  callerName: string;
  callerId: string;
  onAccept: () => void;
  onDecline: () => void;
  isActive: boolean;
}

/**
 * Android-specific incoming call handler
 * Enhances existing call notification system with native Android features:
 * - Fullscreen call UI (via Android CallStyle notification)
 * - Vibration patterns
 * - High-priority notifications
 * - Native accept/decline actions
 */
export function AndroidIncomingCall({
  callId,
  callerName,
  callerId,
  onAccept,
  onDecline,
  isActive,
}: AndroidIncomingCallProps) {
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { playRingtone, stopRingtone } = useAudioNotifications({
    enabled: true,
    volume: 0.8,
  });

  useEffect(() => {
    if (!isNativeAndroid() || !isActive) {
      return;
    }

    // Show native Android call notification with accept/decline actions
    showIncomingCallNotification(callId, callerName, callerId, onAccept, onDecline).catch(
      (error) => {
        console.error('Failed to show native call notification:', error);
      }
    );

    // Start vibration pattern
    const startVibration = async () => {
      while (isActive) {
        await vibratePattern([200, 100, 200, 100, 200]);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    };
    startVibration();

    // Play ringtone (web-based, works in Capacitor WebView)
    playRingtone().catch((error) => {
      console.error('Failed to play ringtone:', error);
    });

    return () => {
      // Cleanup
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
      }
      stopRingtone();
      cancelIncomingCallNotification(callId).catch(() => {
        // Ignore errors during cleanup
      });
    };
  }, [callId, callerName, callerId, isActive, onAccept, onDecline, playRingtone, stopRingtone]);

  // This component doesn't render UI - it enhances native Android notifications
  // The actual UI is handled by GlobalIncomingCall component
  return null;
}


// src/components/native/AndroidNotificationWrapper.tsx
// Wrapper component that enhances existing notification system with native Android features
// Purpose: Adds native Android high-priority notifications without modifying core notification logic

import { useEffect } from 'react';
import { isNativeAndroid, showMessageNotification } from '@/utils/nativeAndroid';

interface AndroidNotificationWrapperProps {
  messageId?: string;
  senderName?: string;
  messageText?: string;
  onMessageOpen?: () => void;
}

/**
 * Wrapper that adds native Android notification support
 * This component enhances existing web notifications with native Android features
 */
export function AndroidNotificationWrapper({
  messageId,
  senderName,
  messageText,
  onMessageOpen,
}: AndroidNotificationWrapperProps) {
  useEffect(() => {
    if (!isNativeAndroid() || !messageId || !senderName || !messageText) {
      return;
    }

    // Show native Android notification for messages
    showMessageNotification(messageId, senderName, messageText, onMessageOpen || (() => {})).catch(
      (error) => {
        console.error('Failed to show native message notification:', error);
      }
    );
  }, [messageId, senderName, messageText, onMessageOpen]);

  // This component doesn't render UI - it enhances native notifications
  return null;
}


// src/utils/nativeAndroid.ts
// Native Android utilities and wrappers for Capacitor plugins
// Purpose: Provide native Android features (notifications, widgets, shortcuts) without modifying core call logic

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Check if running on native Android platform
 */
export function isNativeAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Check if running on any native platform (Android or iOS)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Vibrate device with impact feedback
 */
export async function vibrate(style: ImpactStyle = ImpactStyle.Medium): Promise<void> {
  if (isNativePlatform()) {
    try {
      await Haptics.impact({ style });
    } catch (error) {
      console.warn('Vibration not available:', error);
    }
  }
}

/**
 * Vibrate with custom pattern (for incoming calls)
 */
export async function vibratePattern(pattern: number[] = [200, 100, 200, 100, 200]): Promise<void> {
  if (isNativeAndroid()) {
    try {
      // Android supports vibration patterns
      for (let i = 0; i < pattern.length; i += 2) {
        await Haptics.impact({ style: ImpactStyle.Heavy });
        if (pattern[i + 1]) {
          await new Promise(resolve => setTimeout(resolve, pattern[i + 1]));
        }
      }
    } catch (error) {
      console.warn('Vibration pattern not available:', error);
    }
  }
}

/**
 * Request push notification permissions
 */
export async function requestPushNotificationPermission(): Promise<boolean> {
  if (!isNativePlatform()) {
    return false;
  }

  try {
    const result = await PushNotifications.requestPermissions();
    return result.receive === 'granted';
  } catch (error) {
    console.error('Failed to request push notification permission:', error);
    return false;
  }
}

/**
 * Show high-priority native notification for incoming call
 * Uses Android CallStyle notification template (Android 11+)
 */
export async function showIncomingCallNotification(
  callId: string,
  callerName: string,
  callerId: string,
  onAccept: () => void,
  onDecline: () => void
): Promise<void> {
  if (!isNativePlatform()) {
    return;
  }

  try {
    // Request permission first
    const hasPermission = await requestPushNotificationPermission();
    if (!hasPermission) {
      console.warn('Push notification permission not granted');
      return;
    }

    // Register push notification listeners (one-time setup)
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token: ' + token.value);
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error:', error);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      const data = notification.notification.data;
      if (data?.action === 'accept') {
        onAccept();
      } else if (data?.action === 'decline') {
        onDecline();
      }
    });

    // Show local notification with actions (Android will use CallStyle if available)
    await LocalNotifications.schedule({
      notifications: [
        {
          title: 'Incoming Call',
          body: `${callerName} is calling...`,
          id: parseInt(callId.slice(0, 8), 16) || Date.now(),
          sound: 'default',
          attachments: undefined,
          actionTypeId: 'INCOMING_CALL',
          extra: {
            callId,
            callerName,
            callerId,
            action: 'incoming_call',
          },
          // Android-specific: Use high priority for call notifications
          schedule: { at: new Date(Date.now() + 100) },
        },
      ],
    });

    // Vibrate device
    await vibratePattern([200, 100, 200, 100, 200]);
  } catch (error) {
    console.error('Failed to show incoming call notification:', error);
  }
}

/**
 * Cancel incoming call notification
 */
export async function cancelIncomingCallNotification(callId: string): Promise<void> {
  if (!isNativePlatform()) {
    return;
  }

  try {
    const notificationId = parseInt(callId.slice(0, 8), 16) || Date.now();
    await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
  } catch (error) {
    console.error('Failed to cancel notification:', error);
  }
}

/**
 * Show high-priority message notification
 */
export async function showMessageNotification(
  messageId: string,
  senderName: string,
  messageText: string,
  onOpen: () => void
): Promise<void> {
  if (!isNativePlatform()) {
    return;
  }

  try {
    const hasPermission = await requestPushNotificationPermission();
    if (!hasPermission) {
      return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          title: `New message from ${senderName}`,
          body: messageText,
          id: parseInt(messageId.slice(0, 8), 16) || Date.now(),
          sound: 'default',
          extra: {
            messageId,
            senderName,
            action: 'open_message',
          },
        },
      ],
    });

    // Light vibration for messages
    await vibrate(ImpactStyle.Light);
  } catch (error) {
    console.error('Failed to show message notification:', error);
  }
}

/**
 * Initialize native Android features
 * Call this once when app starts
 */
export async function initializeNativeAndroid(): Promise<void> {
  if (!isNativePlatform()) {
    return;
  }

  try {
    // Register push notification listeners
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('📱 Push registration success, token: ' + token.value);
      // Store token in your backend for sending push notifications
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('❌ Push registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('📬 Push notification received:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('📬 Push notification action performed:', notification);
      const data = notification.notification.data;
      
      // Handle deep links based on notification data
      if (data?.url) {
        // Navigate to URL (handled by App.addListener in App.tsx)
      }
    });

    // Register app state listeners
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('App state changed. Is active?', isActive);
    });

    // Request notification permissions
    await requestPushNotificationPermission();
  } catch (error) {
    console.error('Failed to initialize native Android features:', error);
  }
}


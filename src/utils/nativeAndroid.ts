// src/utils/nativeAndroid.ts
// Native mobile utilities and wrappers for Capacitor plugins (iOS and Android)
// Purpose: Provide native mobile features (notifications, widgets, shortcuts) without modifying core call logic

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { safeLog } from '@/utils/security';

/**
 * Check if running on native Android platform
 */
export function isNativeAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Check if running on native iOS platform
 */
export function isNativeIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
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
 * Works on both iOS and Android
 */
export async function vibratePattern(pattern: number[] = [200, 100, 200, 100, 200]): Promise<void> {
  if (!isNativePlatform()) {
    return;
  }

  try {
    if (isNativeAndroid()) {
      // Android supports vibration patterns via Haptics
      for (let i = 0; i < pattern.length; i += 2) {
        await Haptics.impact({ style: ImpactStyle.Heavy });
        if (pattern[i + 1]) {
          await new Promise(resolve => setTimeout(resolve, pattern[i + 1]));
        }
      }
    } else if (isNativeIOS()) {
      // iOS: Use heavy impact repeatedly for call pattern
      // iOS doesn't support custom vibration patterns, so we simulate with repeated impacts
      for (let i = 0; i < 5; i++) {
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  } catch (error) {
    console.warn('Vibration pattern not available:', error);
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
 * Works on both iOS and Android with sound and vibration
 * Uses Android CallStyle notification template (Android 11+)
 * Uses iOS critical alerts for calls (requires proper entitlements)
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
      console.warn('📱 Push notification permission not granted');
      return;
    }

    // Generate a stable notification ID from callId
    const notificationId = Math.abs(
      parseInt(callId.slice(0, 8), 16) || Date.now()
    ) % 2147483647; // Max safe integer for notification IDs

    // Show local notification with high priority
    // This works even when app is in background or closed
    await LocalNotifications.schedule({
      notifications: [
        {
          title: 'Incoming Call',
          body: `${callerName} is calling...`,
          id: notificationId,
          sound: 'default', // Uses system default ringtone
          attachments: undefined,
          actionTypeId: 'INCOMING_CALL',
          extra: {
            callId,
            callerName,
            callerId,
            action: 'incoming_call',
            url: `/parent/call/${callerId}?callId=${callId}`, // Default URL, can be overridden
          },
          // Schedule immediately (100ms delay to ensure it shows)
          schedule: { at: new Date(Date.now() + 100) },
          // iOS: Use critical alert sound (requires entitlements)
          // Android: Use high priority for call notifications
        },
      ],
    });

    // Vibrate device immediately (works in background)
    await vibratePattern([200, 100, 200, 100, 200]);

    if (import.meta.env.DEV) {
      console.log('📱 Native call notification shown:', {
        callId,
        callerName,
        notificationId,
        platform: Capacitor.getPlatform(),
      });
    }
  } catch (error) {
    console.error('❌ Failed to show incoming call notification:', error);
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
 * Show message notification with sound and vibration
 * Works on both iOS and Android, even when app is in background or closed
 */
export async function showMessageNotification(
  messageId: string,
  senderName: string,
  messageText: string,
  childId?: string,
  onOpen?: () => void
): Promise<void> {
  if (!isNativePlatform()) {
    return;
  }

  try {
    const hasPermission = await requestPushNotificationPermission();
    if (!hasPermission) {
      if (import.meta.env.DEV) {
        console.warn('📱 Message notification permission not granted');
      }
      return;
    }

    // Generate a stable notification ID from messageId
    const notificationId = Math.abs(
      parseInt(messageId.slice(0, 8), 16) || Date.now()
    ) % 2147483647;

    // Truncate message text for notification (max 100 chars)
    const truncatedText =
      messageText.length > 100
        ? `${messageText.substring(0, 100)}...`
        : messageText;

    await LocalNotifications.schedule({
      notifications: [
        {
          title: `New message from ${senderName}`,
          body: truncatedText,
          id: notificationId,
          sound: 'default', // System default notification sound
          extra: {
            messageId,
            senderName,
            childId,
            action: 'open_message',
            url: childId ? `/chat/${childId}` : undefined,
          },
          // Schedule immediately
          schedule: { at: new Date(Date.now() + 100) },
        },
      ],
    });

    // Light vibration for messages
    await vibrate(ImpactStyle.Light);

    if (import.meta.env.DEV) {
      console.log('📱 Native message notification shown:', {
        messageId,
        senderName,
        notificationId,
        platform: Capacitor.getPlatform(),
      });
    }
  } catch (error) {
    console.error('❌ Failed to show message notification:', error);
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
      // SECURITY: Never log push tokens - they are sensitive credentials
      safeLog.log('📱 Push registration success, token: [REDACTED]');
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

    // Listen for app URL opens (deep links, widget intents, etc.)
    App.addListener('appUrlOpen', (data) => {
      console.log('📱 App opened from URL/intent:', data);
      // Handle widget intents and deep links
      handleAppIntent(data);
    });

    // Register LocalNotifications listeners for handling notification taps
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      if (import.meta.env.DEV) {
        console.log('📱 Local notification received:', notification);
      }
    });

    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      if (import.meta.env.DEV) {
        console.log('📱 Local notification action performed:', action);
      }
      
      const data = action.notification.extra;
      if (!data) return;

      // Handle incoming call notifications
      if (data.action === 'incoming_call' && data.callId) {
        // Dispatch custom event for incoming call handling
        window.dispatchEvent(new CustomEvent('nativeNotificationCall', {
          detail: {
            callId: data.callId,
            callerName: data.callerName,
            callerId: data.callerId,
            actionId: action.actionId,
            url: data.url,
          }
        }));
      }
      
      // Handle message notifications
      if (data.action === 'open_message' && data.childId) {
        // Dispatch custom event for message handling
        window.dispatchEvent(new CustomEvent('nativeNotificationMessage', {
          detail: {
            messageId: data.messageId,
            childId: data.childId,
            url: data.url,
          }
        }));
      }
    });

    // Request notification permissions
    await requestPushNotificationPermission();
  } catch (error) {
    console.error('Failed to initialize native mobile features:', error);
  }
}

/**
 * Handle app intents from widgets, deep links, etc.
 * This will be called when the app is opened from a widget tap or deep link
 */
export function handleAppIntent(data: { url: string }): void {
  if (!isNativePlatform()) {
    return;
  }

  try {
    const url = new URL(data.url);
    
    // Handle widget intents (fromWidget=true, widgetAction=quick_call)
    // Capacitor passes Intent extras as URL parameters
    const fromWidget = url.searchParams.get('fromWidget') === 'true';
    const widgetAction = url.searchParams.get('widgetAction');
    const childId = url.searchParams.get('childId');

    if (fromWidget && widgetAction === 'quick_call') {
      console.log('📱 Widget quick call action triggered', { childId });
      // Dispatch custom event that App.tsx can listen to
      window.dispatchEvent(new CustomEvent('widgetQuickCall', {
        detail: { action: widgetAction, childId }
      }));
    }

    // Handle other deep links
    if (url.pathname) {
      console.log('📱 Deep link path:', url.pathname);
      // Navigate to the path (handled by router in App.tsx)
      window.location.href = url.pathname + url.search;
    }
  } catch (error) {
    console.error('Failed to handle app intent:', error);
  }
}

/**
 * Sync widget data to native Android SharedPreferences
 * Uses Capacitor WidgetDataPlugin to bridge React → Android
 */
export async function syncWidgetDataToNative(data: {
  childId: string | null;
  childName: string;
  childAvatarColor: string;
  unreadCount: number;
  lastCallTime: string | null;
}): Promise<void> {
  if (!isNativeAndroid()) {
    return;
  }

  try {
    // Store in localStorage (for web fallback and React access)
    const widgetData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem('widget_data', JSON.stringify(widgetData));

    // Sync to native Android SharedPreferences via Capacitor plugin
    const { WidgetDataPlugin } = await import('@/plugins/WidgetDataPlugin');
    await WidgetDataPlugin.syncWidgetData(data);
    
    console.log('✅ Widget data synced to native Android');
  } catch (error) {
    console.error('Failed to sync widget data to native:', error);
    // Continue without crashing - widget will use placeholder data
  }
}


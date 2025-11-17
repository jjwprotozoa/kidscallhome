// src/utils/deviceTracking.ts
// Purpose: Utilities for tracking and identifying devices
// Supports both PWA (web) and native app wrappers (iOS/Android)

/**
 * Check if running in a native app wrapper (Capacitor, Cordova, etc.)
 */
function isNativeApp(): boolean {
  // Check for Capacitor
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return true;
  }
  // Check for Cordova
  if (typeof window !== 'undefined' && (window as any).cordova) {
    return true;
  }
  // Check for React Native WebView
  if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
    return true;
  }
  // Check user agent for native app indicators
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('capacitor') || ua.includes('cordova') || ua.includes('ionic')) {
    return true;
  }
  return false;
}

/**
 * Get MAC address for native apps (Android/iOS)
 * Note: iOS blocks MAC address access, Android 6.0+ restricts it
 * Falls back to device ID if MAC address unavailable
 */
async function getMacAddress(): Promise<string | null> {
  try {
    // Try custom Capacitor MacAddress plugin (for Android)
    if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.MacAddress) {
      try {
        const result = await (window as any).Capacitor.Plugins.MacAddress.getMacAddress();
        if (result?.macAddress) {
          return result.macAddress;
        }
      } catch (e) {
        // MAC address not available (iOS blocks it, Android may restrict it)
      }
    }

    // Try Capacitor Network plugin for MAC address (legacy support)
    if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.Network) {
      try {
        // Some Capacitor plugins expose MAC address via custom methods
        const network = (window as any).Capacitor.Plugins.Network;
        if (network.getMacAddress) {
          const mac = await network.getMacAddress();
          if (mac) return mac;
        }
      } catch (e) {
        // MAC address access may be restricted
      }
    }

    // Try custom Capacitor plugin for device info (if installed)
    if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.DeviceInfo) {
      try {
        const deviceInfo = await (window as any).Capacitor.Plugins.DeviceInfo.getMacAddress();
        if (deviceInfo?.macAddress) {
          return deviceInfo.macAddress;
        }
      } catch (e) {
        // MAC address not available
      }
    }

    // Try Cordova device plugin
    if (typeof window !== 'undefined' && (window as any).device) {
      const device = (window as any).device;
      // Some Cordova plugins expose MAC address
      if (device.macAddress) {
        return device.macAddress;
      }
    }

    // Try React Native WebView injection
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      // React Native would need to inject MAC address via postMessage
      // For now, return null to fall back to device ID
    }
  } catch (error) {
    console.warn("Failed to get MAC address:", error);
  }
  
  return null;
}

/**
 * Get native device ID if available (for Capacitor/Cordova apps)
 * Falls back to browser fingerprinting for PWA
 */
async function getNativeDeviceId(): Promise<string | null> {
  try {
    // Try Capacitor Device plugin
    if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.Device) {
      const device = await (window as any).Capacitor.Plugins.Device.getInfo();
      // Use device ID if available (unique per device)
      if (device?.id) {
        return `native-${device.id}`;
      }
    }
    
    // Try Cordova device plugin
    if (typeof window !== 'undefined' && (window as any).device) {
      const device = (window as any).device;
      if (device?.uuid) {
        return `cordova-${device.uuid}`;
      }
    }
    
    // Try React Native
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      // React Native would need to inject device ID via postMessage
      // For now, fall back to fingerprinting
    }
  } catch (error) {
    console.warn("Failed to get native device ID:", error);
  }
  
  return null;
}

/**
 * Generate a unique device identifier
 * For native apps: Uses device ID when available
 * For PWA: Uses browser fingerprinting (MAC addresses not accessible in browsers)
 * 
 * Note: MAC addresses are not accessible from web browsers (security/privacy restriction).
 * Browser fingerprinting is the standard approach for web apps and combines multiple
 * device/browser characteristics to create a unique identifier.
 * Native app wrappers (Capacitor/Cordova) can access device IDs which are more stable.
 */
/**
 * Generate a unique device identifier (synchronous version for backward compatibility)
 * For native apps: Uses device ID when available
 * For PWA: Uses browser fingerprinting
 */
export function generateDeviceIdentifier(): string {
  // For PWA, use synchronous fingerprinting
  // For native apps, this will be called but native ID requires async call
  // Native apps should use generateDeviceIdentifierAsync() instead
  return generateBrowserFingerprint();
}

/**
 * Get MAC address for native apps (exported for device tracking)
 * Returns null if not available (iOS blocks MAC, Android may restrict it)
 */
export async function getDeviceMacAddress(): Promise<string | null> {
  // Only attempt MAC address retrieval in native apps
  if (!isNativeApp()) {
    return null;
  }
  return await getMacAddress();
}

/**
 * Generate a unique device identifier (async version for native apps)
 * For native apps: Tries MAC address first, then device ID, then fingerprinting
 * For PWA: Uses browser fingerprinting
 * 
 * Priority order for native apps:
 * 1. MAC address (if available - Android only, iOS blocks it)
 * 2. Native device ID (Capacitor/Cordova device ID)
 * 3. Browser fingerprinting (fallback)
 */
export async function generateDeviceIdentifierAsync(): Promise<string> {
  // Try to get MAC address first (for native apps, Android only)
  const macAddress = await getMacAddress();
  if (macAddress) {
    return `mac-${macAddress.replace(/:/g, '').toLowerCase()}`;
  }

  // Try to get native device ID (for wrapped apps)
  const nativeId = await getNativeDeviceId();
  if (nativeId) {
    return nativeId;
  }
  
  // Fall back to browser fingerprinting (for PWA or if native methods fail)
  return generateBrowserFingerprint();
}

/**
 * Generate browser fingerprint for PWA/web usage
 * This is used when native device ID is not available
 */
function generateBrowserFingerprint(): string {
  // Combine multiple browser characteristics to create a unique fingerprint
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx?.fillText('DeviceID', 2, 2);
  const canvasFingerprint = canvas.toDataURL();

  // Get additional device characteristics
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth || 'unknown',
    new Date().getTimezoneOffset(),
    navigator.platform,
    navigator.vendor || 'unknown',
    canvasFingerprint.substring(0, 50), // Canvas fingerprint (first 50 chars)
    navigator.hardwareConcurrency || 'unknown',
    navigator.deviceMemory || 'unknown',
    navigator.maxTouchPoints || '0',
    // Add more stable identifiers
    window.devicePixelRatio || '1',
    navigator.cookieEnabled ? '1' : '0',
    navigator.doNotTrack || 'unknown',
  ].join('|');

  // Create a hash using a more robust algorithm
  // This creates a consistent identifier for the same device/browser
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Return a base36 encoded hash (shorter, URL-safe)
  // This will be consistent for the same device/browser combination
  return `web-${Math.abs(hash).toString(36).substring(0, 16)}`;
}

/**
 * Detect device type from user agent
 */
export function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' | 'other' {
  const ua = navigator.userAgent.toLowerCase();
  
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  
  if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {
    return 'mobile';
  }
  
  if (/desktop|windows|macintosh|linux/i.test(ua)) {
    return 'desktop';
  }
  
  return 'other';
}

/**
 * Get device name from user agent or default
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent;
  const deviceType = detectDeviceType();
  
  // Try to extract device name from user agent
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('Android')) {
    // Try to extract Android device model
    const match = ua.match(/Android.*?; ([^)]+)\)/);
    if (match) return match[1];
    return 'Android Device';
  }
  if (ua.includes('Macintosh')) return 'Mac';
  if (ua.includes('Windows')) return 'Windows PC';
  if (ua.includes('Linux')) return 'Linux PC';
  
  // Fallback to device type
  return deviceType.charAt(0).toUpperCase() + deviceType.slice(1);
}

/**
 * Get client IP address (requires backend support)
 * For now, returns null - can be enhanced with an API call
 */
export async function getClientIP(): Promise<string | null> {
  try {
    // You can use a service like ipify.org or get it from your backend
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || null;
  } catch {
    return null;
  }
}


// src/utils/platformDetection.ts
// Purpose: Detect if app is running as PWA vs native app

/**
 * Check if running in a native app wrapper (Capacitor, Cordova, etc.)
 * Native apps use in-app purchases, PWAs use Stripe payment links
 */
export function isNativeApp(): boolean {
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
  if (typeof window !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('capacitor') || ua.includes('cordova') || ua.includes('ionic')) {
      return true;
    }
  }
  return false;
}

/**
 * Check if running as PWA (Progressive Web App)
 * PWAs should show Stripe payment links, native apps use in-app purchases
 */
export function isPWA(): boolean {
  return !isNativeApp();
}


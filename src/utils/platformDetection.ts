// src/utils/platformDetection.ts
// Purpose: Detect if app is running as PWA vs native app

/**
 * Check if running in a native app wrapper (Capacitor, Cordova, etc.)
 * Native apps use in-app purchases, PWAs use Stripe payment links
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    // Check for Capacitor - must be functional, not just present
    const Capacitor = (window as any).Capacitor;
    if (Capacitor && typeof Capacitor.getPlatform === 'function') {
      const platform = Capacitor.getPlatform();
      // Only consider it native if platform is actually android or ios
      if (platform === 'android' || platform === 'ios') {
        return true;
      }
    }
    
    // Check for Cordova
    if ((window as any).cordova && typeof (window as any).cordova.exec === 'function') {
      return true;
    }
    
    // Check for React Native WebView
    if ((window as any).ReactNativeWebView && typeof (window as any).ReactNativeWebView.postMessage === 'function') {
      return true;
    }
    
    // Check user agent for native app indicators (but be more strict)
    const ua = navigator.userAgent.toLowerCase();
    // Only match if it's clearly a native app user agent, not just mentions the word
    if (ua.includes('capacitor/') || ua.includes('cordova/') || ua.includes('ionic/')) {
      return true;
    }
  } catch (error) {
    // If any check fails, assume web/PWA
    console.debug('Platform detection error:', error);
    return false;
  }
  
  return false;
}

/**
 * Check if running as PWA (Progressive Web App)
 * PWAs should show Stripe payment links, native apps use in-app purchases
 */
export function isPWA(): boolean {
  // If we're on localhost, we're definitely in PWA mode (web development)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }
  }
  
  // Otherwise, check if we're NOT a native app
  return !isNativeApp();
}

/**
 * Get the current platform (android, ios, or web)
 */
export function getPlatform(): "android" | "ios" | "web" {
  if (typeof window === "undefined") return "web";
  
  // Check for Capacitor
  const windowWithCapacitor = window as any;
  if (windowWithCapacitor.Capacitor) {
    const platform = windowWithCapacitor.Capacitor.getPlatform();
    if (platform === "android") return "android";
    if (platform === "ios") return "ios";
  }
  
  // Check user agent
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
  
  return "web";
}


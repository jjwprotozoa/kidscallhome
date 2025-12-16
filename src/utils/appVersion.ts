// src/utils/appVersion.ts
// Purpose: Utility to get app version from Capacitor or package.json

let cachedVersion: string | null = null;

/**
 * Get the current app version
 * Tries Capacitor App plugin first (for native apps), falls back to package.json version
 */
export async function getAppVersion(): Promise<string> {
  // Return cached version if available
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    // Try to get version from Capacitor App plugin (works for native apps)
    // Dynamically import to avoid errors if @capacitor/app is not installed
    const { App } = await import("@capacitor/app");
    const appInfo = await App.getInfo();
    if (appInfo?.version) {
      cachedVersion = appInfo.version;
      return cachedVersion;
    }
  } catch (error) {
    // Capacitor App plugin not available (web/PWA) or error occurred
    // Fail silently and try fallbacks
  }

  // Fallback: Try to get from Vite environment variable (injected at build time)
  const envVersion = import.meta.env.VITE_APP_VERSION;
  if (envVersion) {
    cachedVersion = envVersion;
    return cachedVersion;
  }

  // Fallback: Try to get from window.__APP_VERSION__ (injected in HTML)
  if (typeof window !== "undefined" && (window as any).__APP_VERSION__) {
    cachedVersion = (window as any).__APP_VERSION__;
    return cachedVersion;
  }

  // Final fallback: Use a default
  cachedVersion = "1.0.0";
  return cachedVersion;
}

/**
 * Get app version synchronously (returns cached version or placeholder)
 * Use this when you need version immediately without async
 */
export function getAppVersionSync(): string {
  return cachedVersion || "1.0.0";
}

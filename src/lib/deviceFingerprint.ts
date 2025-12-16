// src/lib/deviceFingerprint.ts
// Purpose: Device fingerprinting for session security

/**
 * Generate a device fingerprint based on browser characteristics
 * This creates a consistent identifier for the same device/browser combination
 * Used to detect session hijacking attempts
 */
export function generateDeviceFingerprint(): string {
  const components: string[] = [
    navigator.userAgent,
    navigator.language,
    screen.width.toString(),
    screen.height.toString(),
    screen.colorDepth.toString(),
    new Date().getTimezoneOffset().toString(),
    navigator.platform || "unknown",
    navigator.vendor || "unknown",
    (navigator.hardwareConcurrency || 0).toString(),
    (navigator.deviceMemory || 0).toString(),
    (navigator.maxTouchPoints || 0).toString(),
    (window.devicePixelRatio || 1).toString(),
    navigator.cookieEnabled ? "1" : "0",
    navigator.doNotTrack || "unknown",
  ];

  // Add canvas fingerprint for additional uniqueness
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillText("DeviceID", 2, 2);
      const canvasFingerprint = canvas.toDataURL();
      components.push(canvasFingerprint.substring(0, 50));
    }
  } catch (error) {
    // Canvas fingerprinting may be blocked, continue without it
    components.push("canvas-blocked");
  }

  const fingerprint = components.join("|");

  // Create a hash
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Return base36 encoded hash (shorter, URL-safe)
  return Math.abs(hash).toString(36).substring(0, 32);
}

/**
 * Verify device fingerprint matches stored fingerprint
 * Returns true if fingerprints match (device hasn't changed)
 * Returns false if fingerprints don't match (possible session hijacking)
 */
export function verifyDeviceFingerprint(stored: string): boolean {
  const current = generateDeviceFingerprint();
  return stored === current;
}


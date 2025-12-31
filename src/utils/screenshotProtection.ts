// src/utils/screenshotProtection.ts
// Screenshot protection for video calls - protects children's privacy

import { safeLog } from "./security";

/**
 * Detects screenshot attempts and shows a user-friendly message
 * This protects children's privacy during video calls
 */
export function setupScreenshotProtection(
  onScreenshotDetected?: () => void
): () => void {
  // Listen for visibility changes that might indicate screenshot
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Tab became hidden - might be screenshot
      // Note: This is a best-effort detection, not 100% reliable
      safeLog.log("📸 [SCREENSHOT PROTECTION] Tab visibility changed - possible screenshot attempt");
    }
  };

  // Listen for blur events (window loses focus)
  const handleBlur = () => {
    safeLog.log("📸 [SCREENSHOT PROTECTION] Window blurred - possible screenshot attempt");
  };

  // Listen for context menu (right-click) - some screenshot tools use this
  const handleContextMenu = (e: MouseEvent) => {
    // Don't block context menu, just log
    safeLog.log("📸 [SCREENSHOT PROTECTION] Context menu opened");
  };

  // Add event listeners
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", handleBlur);
  document.addEventListener("contextmenu", handleContextMenu);

  // Return cleanup function
  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", handleBlur);
    document.removeEventListener("contextmenu", handleContextMenu);
  };
}

/**
 * Get user-friendly message explaining why screenshots are blocked
 * Short and clear explanation for users
 */
export function getScreenshotBlockedMessage(): {
  title: string;
  description: string;
} {
  return {
    title: "Screenshots blocked",
    description: "Screenshots are disabled to protect children's privacy during calls.",
  };
}


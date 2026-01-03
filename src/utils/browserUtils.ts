// src/utils/browserUtils.ts
// Purpose: Browser detection and popup permission instructions

/**
 * Detects the current browser and returns browser-specific information
 */
export function detectBrowser(): {
  name: string;
  isMobile: boolean;
  popupInstructions: string;
} {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  // Detect browser
  if (userAgent.includes("chrome") && !userAgent.includes("edg")) {
    return {
      name: "Chrome",
      isMobile,
      popupInstructions: isMobile
        ? "Tap the address bar → tap the lock icon → tap 'Site settings' → set 'Pop-ups and redirects' to 'Allow'"
        : "Click the lock icon in the address bar → Site settings → Pop-ups and redirects → Allow",
    };
  }

  if (userAgent.includes("edg")) {
    return {
      name: "Edge",
      isMobile,
      popupInstructions: isMobile
        ? "Tap the address bar → tap the lock icon → tap 'Site permissions' → set 'Pop-ups and redirects' to 'Allow'"
        : "Click the lock icon in the address bar → Site permissions → Pop-ups and redirects → Allow",
    };
  }

  if (userAgent.includes("firefox")) {
    return {
      name: "Firefox",
      isMobile,
      popupInstructions: isMobile
        ? "Tap the menu (☰) → tap the shield icon → tap 'Permissions' → set 'Block pop-up windows' to 'Allow'"
        : "Click the shield icon in the address bar → Permissions → Block pop-up windows → Allow",
    };
  }

  if (userAgent.includes("safari") && !userAgent.includes("chrome")) {
    return {
      name: "Safari",
      isMobile,
      popupInstructions: isMobile
        ? "Go to Settings → Safari → Block Pop-ups → turn OFF"
        : "Safari menu → Settings → Websites → Pop-up Windows → set this site to 'Allow'",
    };
  }

  // Default/unknown browser
  return {
    name: "Browser",
    isMobile,
    popupInstructions: "Check your browser settings for pop-up permissions. Look for site permissions or pop-up blocker settings in your browser menu.",
  };
}


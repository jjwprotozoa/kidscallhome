// src/hooks/useTabVisibility.ts
// Hook to detect if the browser tab is visible/active

import { useEffect, useState } from "react";

export const useTabVisibility = () => {
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const [hasBeenVisible, setHasBeenVisible] = useState(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      
      // Track if tab has ever been visible (for autoplay compliance)
      if (visible) {
        setHasBeenVisible(true);
      }
    };

    // Check initial state
    setIsVisible(!document.hidden);
    setHasBeenVisible(!document.hidden);

    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Also listen for focus/blur events as fallback
    const handleFocus = () => {
      setIsVisible(true);
      setHasBeenVisible(true);
    };
    const handleBlur = () => {
      setIsVisible(false);
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  return {
    isVisible,
    hasBeenVisible, // True if tab has been visible at least once (indicates user interaction)
    isHidden: !isVisible,
  };
};


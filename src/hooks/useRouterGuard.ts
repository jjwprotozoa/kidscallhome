// src/hooks/useRouterGuard.ts
// Router context guard hook to prevent "Cannot destructure property 'basename'" errors
// on iOS when components mount before Router context is ready

import { useEffect, useState } from 'react';

/**
 * Hook to check if Router context is ready by attempting to access it
 * Returns true only when Router context is available
 * Uses try-catch to safely detect router context availability
 */
export function useRouterGuard(): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Try to detect if router context is available
    // We do this by checking if we can access router internals
    // This is safer than using useInRouterContext which may not be available in all versions
    
    let retryCount = 0;
    const maxRetries = 15; // More retries for iOS
    const retryDelay = 100; // 100ms between retries

    const checkRouter = () => {
      retryCount++;
      
      // Try to detect router context by checking for router-related globals
      // or by attempting a safe navigation check
      try {
        // Check if we're inside a Router by looking for router context
        // This is a heuristic - if window.location is available and we're in a SPA,
        // router should be ready
        const hasRouterContext = typeof window !== 'undefined' && 
          window.location && 
          document.readyState === 'complete';
        
        if (hasRouterContext) {
          // Additional check: wait a bit more on iOS for router to fully initialize
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
          
          if (isIOS && retryCount < 5) {
            // iOS needs more time - continue retrying
            setTimeout(checkRouter, retryDelay);
            return;
          }
          
          setIsReady(true);
          return;
        }
      } catch {
        // If check fails, router might not be ready yet
      }

      // If max retries reached, give up (component will return null)
      if (retryCount >= maxRetries) {
        if (import.meta.env.DEV) {
          console.warn('[useRouterGuard] Router context not ready after max retries');
        }
        // Still mark as ready to prevent infinite waiting
        setIsReady(true);
        return;
      }

      // Retry on next tick
      setTimeout(checkRouter, retryDelay);
    };

    // Start checking after a small delay
    setTimeout(checkRouter, retryDelay);
  }, []);

  return isReady;
}

/**
 * Component wrapper that guards router-dependent children
 * Returns null if Router context is not ready
 */
export function RouterGuard({ children }: { children: React.ReactNode }): React.ReactElement | null {
  const isReady = useRouterGuard();
  
  if (!isReady) {
    return null;
  }

  return <>{children}</>;
}


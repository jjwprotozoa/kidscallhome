// src/boot/initApp.ts
// Boot-safe initialization layer that never throws and always recovers gracefully

import { safeLog } from "@/utils/security";
import { validateStorageSafe, clearAppStorage } from "@/utils/storage";

export interface BootResult {
  session: any | null;
  bootLog: string[];
  ok: boolean;
}

/**
 * Boot-safe initialization that never throws
 * Runs before routing and handles all initialization failures gracefully
 */
export async function initApp(): Promise<BootResult> {
  const bootLog: string[] = [];
  const log = (message: string) => {
    bootLog.push(message);
    if (import.meta.env.DEV) {
      safeLog.log(`[BOOT] ${message}`);
    }
  };

  try {
    log("boot:start");

    // AUTH (must never block boot)
    let session = null;
    try {
      log("auth:check");
      session = await getSessionSafe();
      if (session) {
        log("auth:ok");
      } else {
        log("auth:no-session");
      }
    } catch (e) {
      log(`auth:failed:${e instanceof Error ? e.message : String(e)}`);
      session = null;
    }

    // STORAGE (must never throw)
    try {
      log("storage:validate");
      const storageHealthy = await validateStorageSafe();
      if (storageHealthy) {
        log("storage:ok");
      } else {
        log("storage:cleaned");
      }
    } catch {
      log("storage:reset");
      try {
        clearAppStorage();
      } catch {
        // Ignore storage clearing errors
      }
    }

    log("boot:complete");
    return { session, bootLog, ok: true };
  } catch (e) {
    log(`boot:fatal:${e instanceof Error ? e.message : String(e)}`);
    return { session: null, bootLog, ok: false };
  }
}

/**
 * Safely get session without throwing
 * Returns null if session is invalid, expired, or unavailable
 */
async function getSessionSafe(): Promise<any | null> {
  try {
    // Lazy load Supabase only when needed
    const { supabase } = await import("@/integrations/supabase/client");
    
    // PERFORMANCE: Reduced timeout from 3s to 1.5s for faster boot
    // Add timeout to prevent hanging
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), 1500)
    );

    const result = await Promise.race([sessionPromise, timeoutPromise]);
    
    if (!result) {
      return null;
    }

    const { data: { session }, error } = result as { data: { session: any }, error: any };

    // Check for refresh token errors
    if (error) {
      const message = error.message?.toLowerCase() || '';
      const isRefreshError = 
        message.includes('refresh') ||
        message.includes('token') && message.includes('invalid') ||
        message.includes('expired');

      if (isRefreshError) {
        // Clear invalid session data
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const keysToRemove: string[] = [];
            for (let i = 0; i < window.localStorage.length; i++) {
              const key = window.localStorage.key(i);
              if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(key => {
              try {
                window.localStorage.removeItem(key);
              } catch {
                // Ignore removal errors
              }
            });
          }
          
          // Sign out locally
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {
            // Ignore signout errors
          });
        } catch {
          // Ignore cleanup errors
        }
        return null;
      }
    }

    return session;
  } catch (e) {
    // Any error means no session
    return null;
  }
}


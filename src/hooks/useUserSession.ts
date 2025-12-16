// src/hooks/useUserSession.ts
// Purpose: Cached hook for user session (avoids repeated getUser() calls)

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Check if error is a refresh token error
 */
const isRefreshTokenError = (error: unknown): boolean => {
  if (!error) return false;
  
  const message = (error as { message?: string })?.message || '';
  return message.includes('Invalid Refresh Token') || 
         message.includes('Refresh Token Not Found') ||
         message.includes('refresh_token_not_found') ||
         message.includes('JWTExpired') ||
         (message.includes('token') && message.includes('invalid'));
};

/**
 * Cached hook for user session
 * - Uses getSession() instead of getUser() (faster, cached by Supabase)
 * - Never stale (session doesn't change frequently)
 * - Shared across all components
 * - Handles refresh token errors gracefully by clearing session
 */
export const useUserSession = () => {
  return useQuery({
    queryKey: ["user-session"],
    queryFn: async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // If it's a refresh token error, clear the session and return null
        if (error && isRefreshTokenError(error)) {
          // Clear invalid session data
          if (typeof window !== 'undefined') {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
          }
          
          // Sign out locally to clear session
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {
            // Ignore errors during cleanup
          });
          
          return null;
        }
        
        if (error) throw error;
        return session;
      } catch (error) {
        // If it's a refresh token error, return null instead of throwing
        if (isRefreshTokenError(error)) {
          return null;
        }
        throw error;
      }
    },
    staleTime: Infinity, // Session doesn't change frequently
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Don't retry on refresh token errors
      if (isRefreshTokenError(error)) {
        return false;
      }
      // Retry other errors once
      return failureCount < 1;
    },
  });
};

/**
 * Get user ID from cached session (faster than getUser())
 */
export const useUserId = () => {
  const { data: session } = useUserSession();
  return session?.user?.id ?? null;
};


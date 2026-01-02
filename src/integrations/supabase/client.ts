// src/integrations/supabase/client.ts
// Purpose: Supabase client initialization with error handling for refresh token failures
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { safeLog } from '@/utils/security';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Debug logging (only in development)
safeLog.log('🔍 [SUPABASE CLIENT] Environment check:', {
  hasUrl: !!SUPABASE_URL,
  hasKey: !!SUPABASE_PUBLISHABLE_KEY,
  urlLength: SUPABASE_URL?.length || 0,
  keyLength: SUPABASE_PUBLISHABLE_KEY?.length || 0,
  mode: import.meta.env.MODE,
  dev: import.meta.env.DEV,
  prod: import.meta.env.PROD,
});

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  const missingVars = [];
  if (!SUPABASE_URL) missingVars.push('VITE_SUPABASE_URL');
  if (!SUPABASE_PUBLISHABLE_KEY) missingVars.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  
  // Always log this error, even in production - it's critical for debugging
  const errorMsg = `❌ [SUPABASE] Missing required environment variables: ${missingVars.join(', ')}\n` +
    `Please set these in your Vercel project settings or .env file.\n` +
    `The app will not function without these variables.`;
  
  console.error(errorMsg);
  safeLog.error(errorMsg);
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Create Supabase client with error handling
// Realtime is disabled on marketing routes to prevent WebSocket errors
let supabase: ReturnType<typeof createClient<Database>>;

// Check if we're on a marketing route (where realtime should be disabled)
// This check happens at module load time, but we make it defensive
// to prevent errors if window.location is not available
let isMarketingRoute = false;
try {
  if (typeof window !== 'undefined' && window.location) {
    const pathname = window.location.pathname;
    isMarketingRoute = pathname === '/' || pathname === '/info';
  }
} catch (error) {
  // If window.location access fails, default to not being a marketing route
  // This ensures the app doesn't break if there's an issue accessing location
  isMarketingRoute = false;
}

try {
  supabase = createClient<Database>(
    SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_PUBLISHABLE_KEY || 'placeholder-key',
    {
      auth: {
        storage: typeof window !== 'undefined' ? localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // Prevent auto-redirect on auth errors
      },
      // Disable realtime on marketing routes to prevent WebSocket connection attempts
      realtime: isMarketingRoute ? undefined : {
        params: {
          eventsPerSecond: 10,
        },
      },
      global: {
        headers: {
          'x-client-info': 'kidscallhome-web',
        },
      },
    }
  );
} catch (error) {
  // Always log this error, even in production - it's critical for debugging
  console.error('❌ [SUPABASE CLIENT] Failed to create client:', error);
  safeLog.error('❌ [SUPABASE CLIENT] Failed to create client:', error);
  // Create a minimal client to prevent app crash
  supabase = createClient<Database>(
    'https://placeholder.supabase.co',
    'placeholder-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export { supabase };

// Helper function to clear all Supabase auth data from storage
const clearSupabaseAuthData = () => {
  if (typeof window === 'undefined') return;
  
  try {
    // Clear all Supabase-related keys from localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    if (import.meta.env.DEV) {
      safeLog.debug('🔄 [AUTH] Cleared Supabase auth data from storage');
    }
  } catch (error) {
    safeLog.error('❌ [AUTH] Error clearing auth data:', error);
  }
};

// Helper function to check if error is a refresh token error
const isRefreshTokenError = (error: unknown): boolean => {
  if (!error) return false;
  
  // Check for AuthApiError with specific status codes
  if (typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    // 400 status with refresh token error
    if (status === 400) {
      const message = (error as { message?: string }).message || '';
      return message.includes('Invalid Refresh Token') || 
             message.includes('Refresh Token Not Found') ||
             message.includes('refresh_token_not_found');
    }
  }
  
  // Check error message
  const message = (error as { message?: string })?.message || '';
  return message.includes('Invalid Refresh Token') || 
         message.includes('Refresh Token Not Found') ||
         message.includes('refresh_token_not_found') ||
         message.includes('JWTExpired') ||
         (message.includes('token') && message.includes('invalid'));
};

// Handle auth errors gracefully - clear invalid tokens
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    // Token refreshed successfully
    if (import.meta.env.DEV) {
      safeLog.log('✅ [AUTH] Token refreshed successfully');
    }
  } else if (event === 'SIGNED_OUT') {
    // User signed out - clear any stale session data
    if (import.meta.env.DEV) {
      safeLog.log('🔓 [AUTH] User signed out');
    }
    // Clear auth data when signed out
    clearSupabaseAuthData();
  } else if (event === 'SIGNED_IN') {
    // User signed in - session is valid
    if (import.meta.env.DEV) {
      safeLog.log('🔐 [AUTH] User signed in');
    }
  }
});

// Proactively check for invalid tokens on initialization
// Skip on marketing routes to avoid unnecessary Supabase calls
if (typeof window !== 'undefined' && !isMarketingRoute) {
  // Check session on load and clear if invalid
  // Add timeout to prevent hanging if Supabase is unreachable
  const sessionCheckPromise = supabase.auth.getSession().then(({ error }) => {
    if (error && isRefreshTokenError(error)) {
      if (import.meta.env.DEV) {
        safeLog.debug('🔄 [AUTH] Found invalid token on initialization, clearing');
      }
      clearSupabaseAuthData();
      supabase.auth.signOut({ scope: 'local' }).catch(() => {
        // Ignore errors during cleanup
      });
    }
  }).catch(() => {
    // Ignore errors during initialization check
  });

  // PERFORMANCE: Reduced timeout from 3s to 1.5s for faster initialization
  // Timeout after 1.5 seconds - don't let this block app initialization
  Promise.race([
    sessionCheckPromise,
    new Promise((resolve) => setTimeout(resolve, 1500))
  ]).catch(() => {
    // Ignore timeout errors
  });
}

// Global error handler for auth refresh failures
// This catches errors that occur during automatic token refresh
if (typeof window !== 'undefined') {
  // Listen for unhandled promise rejections from Supabase auth
  window.addEventListener('unhandledrejection', async (event) => {
    const error = event.reason;
    
    // Check if it's a Supabase auth error with invalid refresh token
    if (isRefreshTokenError(error)) {
      // Prevent the error from showing in console
      event.preventDefault();
      event.stopPropagation();
      
      // Clear invalid session data
      if (import.meta.env.DEV) {
        safeLog.debug('🔄 [AUTH] Detected invalid refresh token, clearing session');
      }
      
      // Clear all Supabase auth data
      clearSupabaseAuthData();
      
      // Sign out to clear all session data (silently)
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (signOutError) {
        // Ignore errors during cleanup - we've already cleared storage
        if (import.meta.env.DEV) {
          safeLog.debug('⚠️ [AUTH] Error during signOut cleanup (ignored):', signOutError);
        }
      }
      
      // Optionally redirect to login if we're on a protected route
      // This is handled by the app's routing logic, so we don't need to do it here
    }
  });

  // Intercept console.error to suppress ONLY Supabase refresh token errors
  // CRITICAL: Don't suppress other errors - they're needed for debugging
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    // Check if this is a Supabase refresh token error
    const errorMessage = args.join(' ');
    const isSupabaseRefreshError = 
      isRefreshTokenError(args[0]) ||
      (typeof errorMessage === 'string' && 
       (errorMessage.includes('Invalid Refresh Token') ||
        errorMessage.includes('Refresh Token Not Found') ||
        errorMessage.includes('refresh_token_not_found')));
    
    // Only suppress Supabase refresh token errors, log everything else
    if (isSupabaseRefreshError) {
      // Suppress the error - we've already handled it
      return;
    }
    // Otherwise, log normally (including all other errors)
    originalConsoleError.apply(console, args);
  };
}
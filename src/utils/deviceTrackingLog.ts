// src/utils/deviceTrackingLog.ts
// Purpose: Send device tracking logs to API instead of console

import { supabase } from "@/integrations/supabase/client";
import { sanitizeObject } from "./security";

export type DeviceTrackingLogLevel = 'info' | 'warn' | 'error' | 'success';

export interface DeviceTrackingLogEntry {
  level: DeviceTrackingLogLevel;
  message: string;
  parent_id?: string;
  child_id?: string;
  device_id?: string;
  device_identifier?: string;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

/**
 * Send device tracking log to API
 * Fails silently to prevent breaking the app
 */
export async function logDeviceTracking(
  level: DeviceTrackingLogLevel,
  message: string,
  options: {
    parent_id?: string;
    child_id?: string;
    device_id?: string;
    device_identifier?: string;
    metadata?: Record<string, any>;
    error?: Error | { message: string; code?: string; details?: any };
  } = {}
): Promise<void> {
  try {
    // Sanitize metadata and error details before sending
    const sanitizedMetadata = options.metadata
      ? sanitizeObject(options.metadata, { maskValue: true, removeField: false })
      : undefined;

    const sanitizedError = options.error
      ? {
          message: options.error instanceof Error ? options.error.message : options.error.message,
          code: options.error instanceof Error ? (options.error as any).code : options.error.code,
          details: options.error instanceof Error
            ? sanitizeObject((options.error as any).details || {})
            : sanitizeObject(options.error.details || {}),
        }
      : undefined;

    const logEntry: DeviceTrackingLogEntry = {
      level,
      message,
      parent_id: options.parent_id,
      child_id: options.child_id,
      device_id: options.device_id,
      device_identifier: options.device_identifier,
      metadata: sanitizedMetadata,
      error: sanitizedError,
    };

    // Try to send via Supabase RPC function (if it exists)
    // Fallback: Store in localStorage for later sync (if RPC doesn't exist)
    // NOTE: The RPC function may not exist yet - 404 errors are expected and handled gracefully
    try {
      const { error } = await supabase.rpc('log_device_tracking', {
        p_log_entry: logEntry,
      }).catch((rpcError) => {
        // Catch network errors and 404s before Supabase logs them
        // Return a structured error that we can check
        const errorObj = rpcError as any;
        if (errorObj?.status === 404 || errorObj?.code === 'PGRST301') {
          return { error: { code: 'PGRST301', message: 'Function not found', status: 404 } };
        }
        throw rpcError;
      });

      // If RPC call succeeded, we're done
      if (!error) {
        return;
      }

      // Check if error is because RPC function doesn't exist (code 42883, P0001, 404, or message contains "does not exist")
      const isFunctionNotFound = 
        error.code === '42883' || 
        error.code === 'P0001' ||
        error.code === 'PGRST301' || // PostgREST function not found
        (error as any).status === 404 ||
        error.message?.includes('does not exist') ||
        error.message?.includes('function') && error.message?.includes('not found') ||
        error.message?.includes('404') ||
        error.message?.includes('Not Found');

      // If function doesn't exist, store locally (expected behavior)
      // This is normal - the RPC function is optional and may not be deployed yet
      if (isFunctionNotFound) {
        // Silently fall back to localStorage - this is expected if RPC doesn't exist yet
        try {
          const logs = getStoredDeviceLogs();
          logs.push({
            ...logEntry,
            timestamp: Date.now(),
          });
          
          // Keep only last 100 entries
          if (logs.length > 100) {
            logs.shift();
          }
          
          localStorage.setItem('kch_device_tracking_logs', JSON.stringify(logs));
        } catch {
          // Silently fail - logging shouldn't break the app
        }
        return;
      }

      // For other errors, log in dev mode only
      if (import.meta.env.DEV) {
        console.warn('[DEVICE TRACKING] RPC error (non-critical):', error.message);
      }
    } catch (rpcError) {
      // Network error or other exception - store locally
      // Check if it's a 404 (function not found) - this is expected
      const errorObj = rpcError as any;
      const is404 = errorObj?.status === 404 || 
                   errorObj?.code === 'PGRST301' ||
                   errorObj?.message?.includes('404') ||
                   errorObj?.message?.includes('Not Found');
      
      if (is404) {
        // Function doesn't exist - store locally (expected)
        try {
          const logs = getStoredDeviceLogs();
          logs.push({
            ...logEntry,
            timestamp: Date.now(),
          });
          
          if (logs.length > 100) {
            logs.shift();
          }
          
          localStorage.setItem('kch_device_tracking_logs', JSON.stringify(logs));
        } catch {
          // Silently fail
        }
        return;
      }
      
      // For other network errors, also store locally
      try {
        const logs = getStoredDeviceLogs();
        logs.push({
          ...logEntry,
          timestamp: Date.now(),
        });
        
        if (logs.length > 100) {
          logs.shift();
        }
        
        localStorage.setItem('kch_device_tracking_logs', JSON.stringify(logs));
      } catch {
        // Silently fail - logging shouldn't break the app
      }
    }

    // In development, also log to console for debugging (sanitized)
    if (import.meta.env.DEV) {
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](`[DEVICE TRACKING ${level.toUpperCase()}]`, message, sanitizedMetadata || sanitizedError || '');
    }
  } catch {
    // Silently fail - device tracking logs shouldn't break the app
  }
}

/**
 * Get stored device tracking logs from localStorage
 */
export function getStoredDeviceLogs(): Array<DeviceTrackingLogEntry & { timestamp: number }> {
  try {
    const stored = localStorage.getItem('kch_device_tracking_logs');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Clear stored device tracking logs
 */
export function clearStoredDeviceLogs(): void {
  try {
    localStorage.removeItem('kch_device_tracking_logs');
  } catch {
    // Ignore
  }
}


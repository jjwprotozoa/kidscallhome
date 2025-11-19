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
    const { error } = await supabase.rpc('log_device_tracking', {
      p_log_entry: logEntry,
    }).catch(async () => {
      // If RPC doesn't exist, store locally for later sync
      // This prevents breaking the app if the backend isn't ready
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
      return { error: null };
    });

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


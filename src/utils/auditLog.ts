// src/utils/auditLog.ts
// Purpose: Audit logging for security events and user actions

import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeObject } from "@/utils/security";

export type AuditEventType =
  | 'login_attempt'
  | 'login_success'
  | 'login_failed'
  | 'login_locked'
  | 'logout'
  | 'signup'
  | 'password_reset'
  | 'account_locked'
  | 'rate_limit_exceeded'
  | 'bot_detected'
  | 'suspicious_activity'
  | 'data_access'
  | 'permission_denied';

export interface AuditLogEntry {
  type: AuditEventType;
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
  metadata?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Sanitize audit log entry for console logging (masks sensitive data)
 */
function sanitizeAuditEntry(entry: AuditLogEntry): Partial<AuditLogEntry> {
  return {
    type: entry.type,
    userId: entry.userId ? `${entry.userId.substring(0, 8)}...` : undefined,
    email: entry.email ? `${entry.email.substring(0, 3)}***@***` : undefined,
    ip: entry.ip ? '[REDACTED]' : undefined,
    userAgent: entry.userAgent ? '[REDACTED]' : undefined,
    timestamp: entry.timestamp,
    metadata: entry.metadata ? sanitizeObject(entry.metadata) : undefined,
    severity: entry.severity,
  };
}

/**
 * Log audit event (client-side logging - should be sent to server in production)
 */
export function logAuditEvent(
  type: AuditEventType,
  options: {
    userId?: string;
    email?: string;
    metadata?: Record<string, any>;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  } = {}
): void {
  const entry: AuditLogEntry = {
    type,
    userId: options.userId,
    email: options.email,
    ip: undefined, // Will be set server-side
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
    metadata: options.metadata,
    severity: options.severity || getDefaultSeverity(type),
  };

  // SECURITY: Never log sensitive data to console - use safeLog with sanitization
  if (import.meta.env.DEV) {
    const sanitized = sanitizeAuditEntry(entry);
    safeLog.log('[AUDIT]', sanitized);
  }

  // Store in localStorage for client-side tracking (limited storage)
  // Note: Full entry is stored locally, but never logged to console
  try {
    const logs = getStoredAuditLogs();
    logs.push(entry);
    
    // Keep only last 100 entries
    if (logs.length > 100) {
      logs.shift();
    }
    
    localStorage.setItem('kch_audit_logs', JSON.stringify(logs));
  } catch {
    // Ignore storage errors
  }

  // Send to server via Supabase RPC (if available)
  // Falls back silently if RPC function doesn't exist
  sendAuditLogToServer(entry).catch(() => {
    // Silently fail - audit logging shouldn't break the app
  });
}

/**
 * Send audit log to server via Supabase RPC function
 * Similar to device tracking - gracefully handles missing RPC function
 */
async function sendAuditLogToServer(entry: AuditLogEntry): Promise<void> {
  try {
    // Try to send via Supabase RPC function (if it exists)
    // NOTE: The RPC function may not exist yet - 404 errors are expected and handled gracefully
    const result = await supabase.rpc('log_audit_event', {
      p_event_type: entry.type,
      p_user_id: entry.userId || null,
      p_email: entry.email || null,
      p_ip: entry.ip || null,
      p_user_agent: entry.userAgent || null,
      p_timestamp: new Date(entry.timestamp).toISOString(),
      p_metadata: entry.metadata || null,
      p_severity: entry.severity,
    });

    const { error } = result;

    // If RPC call succeeded, we're done
    if (!error) {
      return;
    }

    // Check if error is because RPC function doesn't exist
    const isFunctionNotFound = 
      error.code === '42883' || 
      error.code === 'P0001' ||
      error.code === 'PGRST301' ||
      error.code === 'PGRST202' || // PostgREST function not found in schema cache
      (error as any).status === 404 ||
      error.message?.includes('does not exist') ||
      error.message?.includes('Could not find the function') ||
      (error.message?.includes('function') && error.message?.includes('not found')) ||
      error.message?.includes('404') ||
      error.message?.includes('Not Found') ||
      error.message?.includes('no matches were found in the schema cache');

    // If function doesn't exist, that's expected - silently fail
    // The function may not be deployed yet
    if (isFunctionNotFound) {
      // Expected behavior - RPC function may not exist yet
      return;
    }

    // For other errors, log a warning (but don't break the app)
    if (import.meta.env.DEV) {
      safeLog.warn('[AUDIT] RPC error (non-critical):', sanitizeObject(error));
    }
  } catch (error) {
    // Network error or other exception - check if it's a 404 (function not found)
    const errorObj = error as any;
    const is404 = errorObj?.status === 404 || 
                 errorObj?.code === 'PGRST301' ||
                 errorObj?.code === 'PGRST202' ||
                 errorObj?.message?.includes('404') ||
                 errorObj?.message?.includes('Not Found') ||
                 errorObj?.message?.includes('Could not find the function') ||
                 errorObj?.message?.includes('no matches were found in the schema cache');
    
    if (is404) {
      // Function doesn't exist - this is expected, silently fail
      return;
    }

    // For other network errors, log in dev mode only
    if (import.meta.env.DEV) {
      safeLog.warn('[AUDIT] Failed to send to server:', sanitizeObject(errorObj));
    }
  }
}

/**
 * Get stored audit logs
 */
export function getStoredAuditLogs(): AuditLogEntry[] {
  try {
    const stored = localStorage.getItem('kch_audit_logs');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Clear audit logs
 */
export function clearAuditLogs(): void {
  try {
    localStorage.removeItem('kch_audit_logs');
  } catch {
    // Ignore
  }
}

/**
 * Get default severity for event type
 */
function getDefaultSeverity(type: AuditEventType): 'low' | 'medium' | 'high' | 'critical' {
  switch (type) {
    case 'login_attempt':
    case 'logout':
    case 'signup':
      return 'low';
    case 'login_failed':
    case 'rate_limit_exceeded':
    case 'data_access':
      return 'medium';
    case 'login_locked':
    case 'account_locked':
    case 'bot_detected':
    case 'permission_denied':
      return 'high';
    case 'suspicious_activity':
      return 'critical';
    default:
      return 'medium';
  }
}

/**
 * Check for suspicious patterns in audit logs
 */
export function detectSuspiciousActivity(): {
  suspicious: boolean;
  reasons: string[];
} {
  const logs = getStoredAuditLogs();
  const recentLogs = logs.filter((log) => Date.now() - log.timestamp < 60 * 60 * 1000); // Last hour
  const reasons: string[] = [];

  // Check for multiple failed logins
  const failedLogins = recentLogs.filter((log) => log.type === 'login_failed');
  if (failedLogins.length >= 5) {
    reasons.push(`Multiple failed login attempts: ${failedLogins.length}`);
  }

  // Check for rate limit violations
  const rateLimitViolations = recentLogs.filter(
    (log) => log.type === 'rate_limit_exceeded'
  );
  if (rateLimitViolations.length >= 3) {
    reasons.push(`Rate limit violations: ${rateLimitViolations.length}`);
  }

  // Check for bot detection
  const botDetections = recentLogs.filter((log) => log.type === 'bot_detected');
  if (botDetections.length > 0) {
    reasons.push(`Bot detected: ${botDetections.length} times`);
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}


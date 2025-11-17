// src/utils/auditLog.ts
// Purpose: Audit logging for security events and user actions

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

  // In production, send to server
  // For now, log to console in dev mode only
  if (import.meta.env.DEV) {
    console.log('[AUDIT]', entry);
  }

  // Store in localStorage for client-side tracking (limited storage)
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

  // In production, send to server endpoint
  if (import.meta.env.PROD) {
    sendAuditLogToServer(entry).catch(() => {
      // Silently fail - audit logging shouldn't break the app
    });
  }
}

/**
 * Send audit log to server (implement server endpoint)
 */
async function sendAuditLogToServer(entry: AuditLogEntry): Promise<void> {
  try {
    // TODO: Implement server endpoint for audit logs
    // await fetch('/api/audit', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(entry),
    // });
  } catch {
    // Silently fail
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


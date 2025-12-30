// src/utils/appEventLogging.ts
// Purpose: Log app events for analytics/support (minimal PII: domain + route only)

import { safeLog } from "./security";

/**
 * Log app event (currently uses safeLog, TODO: back with DB later)
 * Only stores non-PII data: domain, route, and event flags
 */
export function logAppEvent(
  event_type: string,
  meta: Record<string, unknown>
): void {
  // Ensure we only log non-PII data
  const sanitizedMeta: Record<string, unknown> = {};
  
  // Only allow specific safe fields
  const allowedFields = ['domain', 'route', 'oldDomain', 'newDomain', 'reason'];
  for (const key of allowedFields) {
    if (key in meta) {
      sanitizedMeta[key] = meta[key];
    }
  }

  const event = {
    event_type,
    timestamp: Date.now(),
    meta: sanitizedMeta,
  };

  // Log in dev mode
  if (import.meta.env.DEV) {
    safeLog.log('[APP_EVENT]', event);
  }

  // TODO: Back this with DB later (e.g., app_events table via Supabase RPC)
  // For now, we rely on safeLog for development visibility
  // In production, this could be sent to analytics service or Supabase
}




// src/lib/childSession.ts
// Purpose: Enhanced child session management with expiration and device fingerprinting

import { generateDeviceFingerprint, verifyDeviceFingerprint } from "./deviceFingerprint";

export interface ChildSession {
  childId: string;
  childName: string;
  avatarColor: string;
  parentId: string;
  createdAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
  deviceFingerprint: string;
}

const SESSION_DURATION_DAYS = 30;
const CHILD_SESSION_KEY = "childSession";

/**
 * Set child session with expiration and device fingerprint
 */
export function setChildSession(
  session: Omit<ChildSession, "createdAt" | "expiresAt" | "deviceFingerprint">
): void {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const deviceFingerprint = generateDeviceFingerprint();

  const fullSession: ChildSession = {
    ...session,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    deviceFingerprint,
  };

  try {
    localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify(fullSession));
  } catch (error) {
    console.error("Failed to save child session:", error);
    throw new Error("Failed to save session");
  }
}

/**
 * Legacy session format (for backward compatibility)
 */
interface LegacyChildSession {
  id: string;
  name: string;
  avatar_color: string;
  parent_id: string;
}

/**
 * Get child session if valid (not expired and device matches)
 * Supports both new format (with expiration) and legacy format (backward compatibility)
 */
export function getChildSession(): ChildSession | null {
  const sessionStr = localStorage.getItem(CHILD_SESSION_KEY);
  if (!sessionStr) return null;

  try {
    const parsed = JSON.parse(sessionStr);

    // Check if it's legacy format (no expiresAt field)
    if (!parsed.expiresAt) {
      // Migrate legacy session to new format
      const legacySession = parsed as LegacyChildSession;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
      const deviceFingerprint = generateDeviceFingerprint();

      const newSession: ChildSession = {
        childId: legacySession.id,
        childName: legacySession.name,
        avatarColor: legacySession.avatar_color,
        parentId: legacySession.parent_id,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        deviceFingerprint,
      };

      // Save migrated session
      localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify(newSession));
      return newSession;
    }

    // New format - check expiration and device fingerprint
    const session = parsed as ChildSession;

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      clearChildSession();
      return null;
    }

    // Verify device fingerprint hasn't changed (detect session hijacking)
    if (!verifyDeviceFingerprint(session.deviceFingerprint)) {
      clearChildSession();
      return null;
    }

    return session;
  } catch (error) {
    console.error("Failed to parse child session:", error);
    clearChildSession();
    return null;
  }
}

/**
 * Get child session in legacy format (for backward compatibility with existing code)
 * Returns null if session is expired or invalid
 */
export function getChildSessionLegacy(): LegacyChildSession | null {
  const session = getChildSession();
  if (!session) return null;

  return {
    id: session.childId,
    name: session.childName,
    avatar_color: session.avatarColor,
    parent_id: session.parentId,
  };
}

/**
 * Clear child session
 */
export function clearChildSession(): void {
  try {
    localStorage.removeItem(CHILD_SESSION_KEY);
  } catch (error) {
    console.error("Failed to clear child session:", error);
  }
}

/**
 * Check if session is expired
 */
export function isSessionExpired(): boolean {
  const session = getChildSession();
  return session === null;
}

/**
 * Get session expiration time remaining in milliseconds
 */
export function getSessionTimeRemaining(): number | null {
  const session = getChildSession();
  if (!session) return null;

  const expiresAt = new Date(session.expiresAt);
  const now = new Date();
  const remaining = expiresAt.getTime() - now.getTime();

  return remaining > 0 ? remaining : 0;
}

/**
 * Check if session will expire soon (within 7 days)
 */
export function isSessionExpiringSoon(): boolean {
  const remaining = getSessionTimeRemaining();
  if (!remaining) return true;

  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return remaining < sevenDays;
}


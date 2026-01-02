// src/utils/safeStorage.ts
// Safe storage utilities that never throw and gracefully handle corrupted data
// Used to protect against iOS storage corruption and quota errors

/**
 * Safely get an item from localStorage
 * Returns null if storage is unavailable, item doesn't exist, or read fails
 */
export function safeGet(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage.getItem(key);
  } catch (error) {
    // Log corruption but don't throw
    if (typeof window !== 'undefined' && window.console) {
      console.warn(`[safeStorage] Failed to read key "${key}":`, error);
    }
    return null;
  }
}

/**
 * Safely set an item in localStorage
 * Silently fails if storage is unavailable or quota exceeded
 */
export function safeSet(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(key, value);
  } catch (error) {
    // Log quota errors but don't throw
    if (typeof window !== 'undefined' && window.console) {
      console.warn(`[safeStorage] Failed to write key "${key}":`, error);
    }
  }
}

/**
 * Safely get and parse JSON from localStorage
 * Returns null if parsing fails, removes corrupt key, and logs to boot logger
 */
export function safeJSONGet<T>(key: string): T | null {
  try {
    const value = safeGet(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (parseError) {
      // Corrupt JSON - remove it and log
      try {
        window.localStorage.removeItem(key);
        // Log to boot logger if available (async to avoid circular deps)
        if (typeof window !== 'undefined') {
          // Use setTimeout to avoid blocking and allow dynamic import
          setTimeout(async () => {
            try {
              const { bootLogger } = await import('@/boot/bootGate');
              bootLogger.append('failed', `storage:corrupt:${key}`, {
                key,
                error: parseError instanceof Error ? parseError.message : String(parseError),
              });
            } catch {
              // Boot logger not available, use console
              console.warn(`[safeStorage] Corrupt JSON in key "${key}", removed`);
            }
          }, 0);
        } else {
          console.warn(`[safeStorage] Corrupt JSON in key "${key}", removed`);
        }
      } catch {
        // Ignore removal errors
      }
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Safely stringify and set JSON in localStorage
 * Silently fails if storage is unavailable or quota exceeded
 */
export function safeJSONSet(key: string, obj: unknown): void {
  try {
    const value = JSON.stringify(obj);
    safeSet(key, value);
  } catch (error) {
    // Log stringify errors but don't throw
    if (typeof window !== 'undefined' && window.console) {
      console.warn(`[safeStorage] Failed to stringify for key "${key}":`, error);
    }
  }
}

/**
 * Safely remove an item from localStorage
 * Silently fails if storage is unavailable
 */
export function remove(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.removeItem(key);
  } catch {
    // Ignore removal errors
  }
}

/**
 * Clear all app storage keys (keys with prefix "kch_" or known app prefixes)
 * Detects current prefix by scanning storage usage
 */
export function clearKchStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const prefixes = ['kch_', 'sb-', 'kidscallhome'];
    const knownKeys = [
      'childSession',
      'cookie-consent',
      'staySignedIn',
      'selectedConversationId',
      'selectedParticipantId',
      'selectedParentId',
      'selectedParticipantType',
      'widget_data',
      'clearSessionOnClose',
    ];

    const keysToRemove: string[] = [];
    
    // Scan all keys
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;

      // Check prefixes
      if (prefixes.some(prefix => key.startsWith(prefix))) {
        keysToRemove.push(key);
        continue;
      }

      // Check known keys
      if (knownKeys.includes(key)) {
        keysToRemove.push(key);
        continue;
      }

      // Check for supabase keys
      if (key.includes('supabase')) {
        keysToRemove.push(key);
      }
    }

    // Remove all matching keys
    keysToRemove.forEach(key => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore individual removal errors
      }
    });
  } catch {
    // Ignore storage errors
  }
}


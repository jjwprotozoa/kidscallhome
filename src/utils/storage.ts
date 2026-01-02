// src/utils/storage.ts
// Safe storage utilities that never throw and gracefully handle corrupted data

/**
 * Safely parse JSON from localStorage or sessionStorage
 * Returns null if parsing fails or value is null
 */
export function safeJSONParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Safely get an item from localStorage
 * Returns null if storage is unavailable or item doesn't exist
 */
export function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely set an item in localStorage
 * Silently fails if storage is unavailable or quota exceeded
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    // Storage might be full, disabled, or in private mode
    return false;
  }
}

/**
 * Safely remove an item from localStorage
 * Silently fails if storage is unavailable
 */
export function safeRemoveItem(key: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all app storage (localStorage)
 * Only clears keys that belong to this app
 */
export function clearAppStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        // Clear app-specific keys
        if (
          key.startsWith('sb-') ||
          key.includes('supabase') ||
          key === 'childSession' ||
          key.startsWith('kidscallhome') ||
          key.startsWith('kch_') ||
          key === 'cookie-consent' ||
          key === 'staySignedIn' ||
          key === 'selectedConversationId' ||
          key === 'selectedParticipantId' ||
          key === 'selectedParentId' ||
          key === 'selectedParticipantType' ||
          key === 'widget_data' ||
          key === 'clearSessionOnClose'
        ) {
          keysToRemove.push(key);
        }
      }
    }

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

/**
 * Clear only volatile cache (not auth or user data)
 * Preserves session but clears cached query data
 */
export function clearVolatileCache(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('kidscallhome-query-cache')) {
        keysToRemove.push(key);
      }
    }

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

/**
 * Validate storage and clear corrupt keys
 * Returns true if storage is healthy, false otherwise
 */
export async function validateStorageSafe(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    const knownKeys = [
      'childSession',
      'kidscallhome-query-cache',
      'cookie-consent',
      'staySignedIn',
      'selectedConversationId',
      'selectedParticipantId',
      'selectedParentId',
      'selectedParticipantType',
      'widget_data',
      'clearSessionOnClose',
    ];

    const corruptKeys: string[] = [];

    // Check known JSON keys
    for (const key of knownKeys) {
      try {
        const value = window.localStorage.getItem(key);
        if (value) {
          // Try to parse JSON values
          if (key === 'childSession' || key === 'widget_data' || key === 'kidscallhome-query-cache') {
            JSON.parse(value);
          }
        }
      } catch {
        // This key has corrupt data
        corruptKeys.push(key);
      }
    }

    // Check Supabase keys
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        try {
          const value = window.localStorage.getItem(key);
          if (value) {
            // Supabase stores JSON, try to parse
            JSON.parse(value);
          }
        } catch {
          corruptKeys.push(key);
        }
      }
    }

    // Clear corrupt keys
    corruptKeys.forEach(key => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore removal errors
      }
    });

    return corruptKeys.length === 0;
  } catch {
    return false;
  }
}


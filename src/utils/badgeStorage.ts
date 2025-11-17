// src/utils/badgeStorage.ts
// Local storage persistence for badge counts
// Provides instant UI feedback and prevents badges from reappearing after refresh

const BADGE_STORAGE_KEY = "kidscallhome_badge_state";
const BADGE_STORAGE_VERSION = 1;

interface BadgeStorageData {
  version: number;
  unreadMessagesByChild: Record<string, number>;
  missedCallsByChild: Record<string, number>;
  lastUpdated: string;
  // Track when badges were last cleared per child (to only show NEW messages)
  lastClearedTimestamps: {
    messages: Record<string, string>; // childId -> ISO timestamp
    calls: Record<string, string>; // childId -> ISO timestamp
  };
}

/**
 * Load badge state from local storage
 */
export function loadBadgeState(): {
  unreadMessagesByChild: Record<string, number>;
  missedCallsByChild: Record<string, number>;
  lastClearedTimestamps: {
    messages: Record<string, string>;
    calls: Record<string, string>;
  };
} {
  try {
    const stored = localStorage.getItem(BADGE_STORAGE_KEY);
    if (!stored) {
      return { 
        unreadMessagesByChild: {}, 
        missedCallsByChild: {},
        lastClearedTimestamps: { messages: {}, calls: {} }
      };
    }

    const data: BadgeStorageData = JSON.parse(stored);
    
    // Check version compatibility
    if (data.version !== BADGE_STORAGE_VERSION) {
      console.log("⚠️ [BADGE STORAGE] Version mismatch, clearing old data");
      localStorage.removeItem(BADGE_STORAGE_KEY);
      return { 
        unreadMessagesByChild: {}, 
        missedCallsByChild: {},
        lastClearedTimestamps: { messages: {}, calls: {} }
      };
    }

    return {
      unreadMessagesByChild: data.unreadMessagesByChild || {},
      missedCallsByChild: data.missedCallsByChild || {},
      lastClearedTimestamps: data.lastClearedTimestamps || { messages: {}, calls: {} },
    };
  } catch (error) {
    console.error("❌ [BADGE STORAGE] Error loading badge state:", error);
    return { 
      unreadMessagesByChild: {}, 
      missedCallsByChild: {},
      lastClearedTimestamps: { messages: {}, calls: {} }
    };
  }
}

/**
 * Save badge state to local storage
 */
export function saveBadgeState(
  unreadMessagesByChild: Record<string, number>,
  missedCallsByChild: Record<string, number>,
  lastClearedTimestamps?: {
    messages: Record<string, string>;
    calls: Record<string, string>;
  }
): void {
  try {
    // Load existing timestamps if not provided
    const existing = loadBadgeState();
    const timestamps = lastClearedTimestamps || existing.lastClearedTimestamps;

    const data: BadgeStorageData = {
      version: BADGE_STORAGE_VERSION,
      unreadMessagesByChild,
      missedCallsByChild,
      lastUpdated: new Date().toISOString(),
      lastClearedTimestamps: timestamps,
    };

    localStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("❌ [BADGE STORAGE] Error saving badge state:", error);
    // Storage might be full or disabled - continue without crashing
  }
}

/**
 * Mark badges as cleared for a child (saves timestamp)
 */
export function markBadgesCleared(childId: string, type: "messages" | "calls" | "both"): void {
  try {
    const existing = loadBadgeState();
    const now = new Date().toISOString();
    
    const timestamps = { ...existing.lastClearedTimestamps };
    
    if (type === "messages" || type === "both") {
      timestamps.messages[childId] = now;
    }
    if (type === "calls" || type === "both") {
      timestamps.calls[childId] = now;
    }

    saveBadgeState(
      existing.unreadMessagesByChild,
      existing.missedCallsByChild,
      timestamps
    );

    console.log(`✅ [BADGE STORAGE] Marked ${type} badges as cleared for child ${childId} at ${now}`);
  } catch (error) {
    console.error("❌ [BADGE STORAGE] Error marking badges as cleared:", error);
  }
}

/**
 * Get last cleared timestamp for a child
 */
export function getLastClearedTimestamp(childId: string, type: "messages" | "calls"): string | null {
  try {
    const state = loadBadgeState();
    return state.lastClearedTimestamps[type][childId] || null;
  } catch (error) {
    console.error("❌ [BADGE STORAGE] Error getting last cleared timestamp:", error);
    return null;
  }
}

/**
 * Clear badge state from local storage (on logout)
 */
export function clearBadgeState(): void {
  try {
    localStorage.removeItem(BADGE_STORAGE_KEY);
  } catch (error) {
    console.error("❌ [BADGE STORAGE] Error clearing badge state:", error);
  }
}


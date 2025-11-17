// src/stores/badgeStore.ts
// Badge store driven by events, not queries - zero ongoing DB reads
// Persists to local storage for instant UI feedback after page refresh

import { create } from "zustand";
import { loadBadgeState, saveBadgeState, clearBadgeState, markBadgesCleared } from "@/utils/badgeStorage";

type BadgeState = {
  unreadMessagesByChild: Record<string, number>;
  missedCallsByChild: Record<string, number>;
  
  // Initial snapshot setters (called once on app mount/login)
  setInitialUnread: (map: Record<string, number>) => void;
  setInitialMissed: (map: Record<string, number>) => void;
  
  // Event-driven updates (no DB reads)
  incrementUnread: (childId: string) => void;
  decrementUnread: (childId: string, count?: number) => void;
  clearUnreadForChild: (childId: string) => void;
  
  incrementMissed: (childId: string) => void;
  decrementMissed: (childId: string, count?: number) => void;
  clearMissedForChild: (childId: string) => void;
  
  // Reset store (on logout)
  reset: () => void;
};

// Load initial state from local storage
const initialState = loadBadgeState();

export const useBadgeStore = create<BadgeState>((set, get) => ({
  unreadMessagesByChild: initialState.unreadMessagesByChild,
  missedCallsByChild: initialState.missedCallsByChild,

  setInitialUnread: (map) => {
    set({ unreadMessagesByChild: map });
    // Persist to local storage
    saveBadgeState(get().unreadMessagesByChild, get().missedCallsByChild);
  },
  
  setInitialMissed: (map) => {
    set({ missedCallsByChild: map });
    // Persist to local storage
    saveBadgeState(get().unreadMessagesByChild, get().missedCallsByChild);
  },

  incrementUnread: (childId) =>
    set((state) => {
      const newState = {
        unreadMessagesByChild: {
          ...state.unreadMessagesByChild,
          [childId]: (state.unreadMessagesByChild[childId] ?? 0) + 1,
        },
      };
      // Persist to local storage
      saveBadgeState(newState.unreadMessagesByChild, state.missedCallsByChild);
      return newState;
    }),

  decrementUnread: (childId, count = 1) =>
    set((state) => {
      const newState = {
        unreadMessagesByChild: {
          ...state.unreadMessagesByChild,
          [childId]: Math.max(0, (state.unreadMessagesByChild[childId] ?? 0) - count),
        },
      };
      // Persist to local storage
      saveBadgeState(newState.unreadMessagesByChild, state.missedCallsByChild);
      return newState;
    }),

  clearUnreadForChild: (childId) =>
    set((state) => {
      const newState = {
        unreadMessagesByChild: {
          ...state.unreadMessagesByChild,
          [childId]: 0,
        },
      };
      // Persist to local storage immediately and mark as cleared
      saveBadgeState(newState.unreadMessagesByChild, state.missedCallsByChild);
      markBadgesCleared(childId, "messages");
      return newState;
    }),

  incrementMissed: (childId) =>
    set((state) => {
      const newState = {
        missedCallsByChild: {
          ...state.missedCallsByChild,
          [childId]: (state.missedCallsByChild[childId] ?? 0) + 1,
        },
      };
      // Persist to local storage
      saveBadgeState(state.unreadMessagesByChild, newState.missedCallsByChild);
      return newState;
    }),

  decrementMissed: (childId, count = 1) =>
    set((state) => {
      const newState = {
        missedCallsByChild: {
          ...state.missedCallsByChild,
          [childId]: Math.max(0, (state.missedCallsByChild[childId] ?? 0) - count),
        },
      };
      // Persist to local storage
      saveBadgeState(state.unreadMessagesByChild, newState.missedCallsByChild);
      return newState;
    }),

  clearMissedForChild: (childId) =>
    set((state) => {
      const newState = {
        missedCallsByChild: {
          ...state.missedCallsByChild,
          [childId]: 0,
        },
      };
      // Persist to local storage immediately and mark as cleared
      saveBadgeState(state.unreadMessagesByChild, newState.missedCallsByChild);
      markBadgesCleared(childId, "calls");
      return newState;
    }),

  reset: () => {
    set({ unreadMessagesByChild: {}, missedCallsByChild: {} });
    // Clear local storage on logout
    clearBadgeState();
  },
}));

// Selectors for total counts (derived from store, no DB reads)
export function useTotalUnreadBadge() {
  const unreadByChild = useBadgeStore((s) => s.unreadMessagesByChild);
  return Object.values(unreadByChild).reduce((sum, v) => sum + v, 0);
}

export function useTotalMissedBadge() {
  const missedByChild = useBadgeStore((s) => s.missedCallsByChild);
  return Object.values(missedByChild).reduce((sum, v) => sum + v, 0);
}

// Selector for specific child's unread count
export function useUnreadBadgeForChild(childId: string | null) {
  return useBadgeStore((s) => (childId ? s.unreadMessagesByChild[childId] ?? 0 : 0));
}

// Selector for specific child's missed call count
export function useMissedBadgeForChild(childId: string | null) {
  return useBadgeStore((s) => (childId ? s.missedCallsByChild[childId] ?? 0 : 0));
}


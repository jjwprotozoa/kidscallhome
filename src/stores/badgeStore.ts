// src/stores/badgeStore.ts
// Badge store driven by events, not queries - zero ongoing DB reads

import { create } from "zustand";

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

export const useBadgeStore = create<BadgeState>((set) => ({
  unreadMessagesByChild: {},
  missedCallsByChild: {},

  setInitialUnread: (map) => set({ unreadMessagesByChild: map }),
  setInitialMissed: (map) => set({ missedCallsByChild: map }),

  incrementUnread: (childId) =>
    set((state) => ({
      unreadMessagesByChild: {
        ...state.unreadMessagesByChild,
        [childId]: (state.unreadMessagesByChild[childId] ?? 0) + 1,
      },
    })),

  decrementUnread: (childId, count = 1) =>
    set((state) => ({
      unreadMessagesByChild: {
        ...state.unreadMessagesByChild,
        [childId]: Math.max(0, (state.unreadMessagesByChild[childId] ?? 0) - count),
      },
    })),

  clearUnreadForChild: (childId) =>
    set((state) => ({
      unreadMessagesByChild: {
        ...state.unreadMessagesByChild,
        [childId]: 0,
      },
    })),

  incrementMissed: (childId) =>
    set((state) => ({
      missedCallsByChild: {
        ...state.missedCallsByChild,
        [childId]: (state.missedCallsByChild[childId] ?? 0) + 1,
      },
    })),

  decrementMissed: (childId, count = 1) =>
    set((state) => ({
      missedCallsByChild: {
        ...state.missedCallsByChild,
        [childId]: Math.max(0, (state.missedCallsByChild[childId] ?? 0) - count),
      },
    })),

  clearMissedForChild: (childId) =>
    set((state) => ({
      missedCallsByChild: {
        ...state.missedCallsByChild,
        [childId]: 0,
      },
    })),

  reset: () => set({ unreadMessagesByChild: {}, missedCallsByChild: {} }),
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


// src/features/presence/useChildrenPresence.ts
// Hook for parents to subscribe to their children's online presence

import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/utils/security";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface PresenceMetadata {
  userId: string;
  userType: "parent" | "child";
  name?: string;
  lastSeen: string;
}

interface PresenceState {
  [childId: string]: {
    isOnline: boolean;
    lastSeen: string | null;
  };
}

interface UseChildrenPresenceOptions {
  childIds: string[];
  enabled?: boolean;
  onStatusChange?: (childId: string, isOnline: boolean) => void;
}

/**
 * Hook for parents to track their children's online status
 * Returns a map of childId -> { isOnline, lastSeen }
 */
export function useChildrenPresence({
  childIds,
  enabled = true,
  onStatusChange,
}: UseChildrenPresenceOptions) {
  const [presence, setPresence] = useState<PresenceState>({});
  const channelRefsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const onStatusChangeRef = useRef(onStatusChange);

  // Keep callback ref up to date
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  // Create stable string key for dependency comparison
  const childIdsKey = useMemo(() => [...childIds].sort().join(","), [childIds]);

  // Initialize presence state for all children as offline
  // Use childIdsKey for stable dependency (prevents infinite loops)
  useEffect(() => {
    if (!enabled || !childIdsKey) return;

    const initialPresence: PresenceState = {};
    const ids = childIdsKey.split(",").filter(Boolean);
    ids.forEach((childId) => {
      initialPresence[childId] = {
        isOnline: false,
        lastSeen: null,
      };
    });
    setPresence(initialPresence);
  }, [childIdsKey, enabled]);

  useEffect(() => {
    // Parse childIds from stable key
    const parsedChildIds = childIdsKey ? childIdsKey.split(",").filter(Boolean) : [];
    
    if (!enabled || parsedChildIds.length === 0) return;

    // Capture ref at start of effect for cleanup
    const currentChannelRef = channelRefsRef.current;

    // Clean up existing channels first to prevent duplicates
    if (currentChannelRef.size > 0) {
      currentChannelRef.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      currentChannelRef.clear();
    }

    // Track channels created in this effect for cleanup
    const channelsInThisEffect = new Map<string, RealtimeChannel>();

    // Subscribe to each child's presence channel
    // Use setTimeout to yield to event loop and prevent blocking message handlers
    parsedChildIds.forEach((childId, index) => {
      // Stagger subscriptions slightly to prevent blocking (yield to event loop)
      setTimeout(() => {
        // Skip if channel already exists (prevent duplicate subscriptions)
        if (currentChannelRef.has(childId)) {
          return;
        }

        const channelName = `presence:child:${childId}`;

        // Only log subscription start for small numbers of children (reduced verbosity)
        if (import.meta.env.DEV && parsedChildIds.length <= 3) {
          safeLog.debug("👀 [CHILDREN PRESENCE] Subscribing", { childId });
        }

        // Create channel for subscribing to presence
        // Note: Subscribers need to enable presence config to receive presence events
        const channel = supabase.channel(channelName, {
          config: {
            presence: {
              key: childId, // Use childId as key for presence state lookup
            },
          },
        });

        channel
          .on("presence", { event: "sync" }, () => {
            const state = channel.presenceState<PresenceMetadata>();
            const isOnline =
              childId in state &&
              Array.isArray(state[childId]) &&
              state[childId].length > 0;

            // Get the most recent presence metadata
            const childPresences = state[childId] as
              | PresenceMetadata[]
              | undefined;
            const latestPresence =
              childPresences && childPresences.length > 0
                ? childPresences[0]
                : undefined;
            const newLastSeen = isOnline
              ? latestPresence?.lastSeen || new Date().toISOString()
              : null;

            setPresence((prev) => {
              const wasOnline = prev[childId]?.isOnline || false;
              const prevLastSeen = prev[childId]?.lastSeen || null;

              // Only update state if something actually changed
              // This prevents unnecessary re-renders and reduces message spam
              if (wasOnline === isOnline && prevLastSeen === newLastSeen) {
                return prev; // No change, return previous state
              }

              // Log in development only when status changes
              if (import.meta.env.DEV && wasOnline !== isOnline) {
                safeLog.debug("🔄 [CHILDREN PRESENCE] Status changed", {
                  childId,
                  isOnline,
                  wasOnline,
                });
              }

              const newState = {
                ...prev,
                [childId]: {
                  isOnline,
                  lastSeen: newLastSeen || prevLastSeen,
                },
              };

              // Notify callback only on actual status change
              if (
                wasOnline !== isOnline &&
                onStatusChangeRef.current &&
                prev[childId] !== undefined
              ) {
                onStatusChangeRef.current(childId, isOnline);
              }

              return newState;
            });
          })
          .on("presence", { event: "join" }, ({ key, newPresences }) => {
            // Only update if this is the child we're tracking
            if (key !== childId) {
              return;
            }

            const metadata = newPresences[0] as unknown as
              | PresenceMetadata
              | undefined;
            setPresence((prev) => {
              const wasOnline = prev[childId]?.isOnline || false;
              const newState = {
                ...prev,
                [childId]: {
                  isOnline: true,
                  lastSeen: metadata?.lastSeen || new Date().toISOString(),
                },
              };

              if (!wasOnline && onStatusChangeRef.current) {
                onStatusChangeRef.current(childId, true);
              }

              // Log in development
              if (import.meta.env.DEV) {
                safeLog.debug(
                  "🟢 [CHILDREN PRESENCE] Child marked as online via join",
                  {
                    childId,
                    wasOnline,
                    lastSeen: metadata?.lastSeen,
                  }
                );
              }

              return newState;
            });
          })
          .on("presence", { event: "leave" }, ({ key }) => {
            // Only update if this is the child we're tracking
            if (key !== childId) {
              return;
            }

            // Silent leave - status change logging happens in sync handler

            setPresence((prev) => {
              const wasOnline = prev[childId]?.isOnline || false;
              const newState = {
                ...prev,
                [childId]: {
                  isOnline: false,
                  lastSeen: prev[childId]?.lastSeen || new Date().toISOString(),
                },
              };

              if (wasOnline && onStatusChangeRef.current) {
                onStatusChangeRef.current(childId, false);
              }

              return newState;
            });
          })
          .subscribe((status, err) => {
            if (status === "SUBSCRIBED") {
              // Reduced logging: Only log subscription success for small numbers of children
              if (import.meta.env.DEV && parsedChildIds.length <= 3) {
                safeLog.debug("✅ [CHILDREN PRESENCE] Subscribed", { childId });
              }

              // Check initial presence state after subscription
              // This handles the case where child was already online before parent subscribed
              // Stagger checks to prevent blocking (500ms + index * 50ms)
              setTimeout(() => {
                const state = channel.presenceState<PresenceMetadata>();
                const isOnline =
                  childId in state &&
                  Array.isArray(state[childId]) &&
                  state[childId].length > 0;

                if (isOnline) {
                  const childPresences = state[childId] as
                    | PresenceMetadata[]
                    | undefined;
                  const latestPresence =
                    childPresences && childPresences.length > 0
                      ? childPresences[0]
                      : undefined;

                  setPresence((prev) => ({
                    ...prev,
                    [childId]: {
                      isOnline: true,
                      lastSeen:
                        latestPresence?.lastSeen || new Date().toISOString(),
                    },
                  }));

                  // Only log when child is actually online (more interesting than offline)
                  if (import.meta.env.DEV && parsedChildIds.length <= 3) {
                    safeLog.debug("🟢 [CHILDREN PRESENCE] Online", {
                      childId,
                    });
                  }
                }
                // Removed offline logging - too verbose, not actionable
              }, 500 + index * 50); // Stagger checks: 500ms, 550ms, 600ms, etc.
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              safeLog.error("❌ [CHILDREN PRESENCE] Subscription error", {
                childId,
                status,
                error: err,
              });
            }
          });

        // Track channel in both ref and local map for cleanup
        currentChannelRef.set(childId, channel);
        channelsInThisEffect.set(childId, channel);
      }, index * 10); // Stagger subscriptions: 0ms, 10ms, 20ms, etc. to yield to event loop
    });

    return () => {
      // Silent cleanup - remove channels created in this effect
      channelsInThisEffect.forEach((channel, childId) => {
        supabase.removeChannel(channel);
        // Also remove from ref (using captured ref from effect start)
        currentChannelRef.delete(childId);
      });
      channelsInThisEffect.clear();
    };
  }, [childIdsKey, enabled]);

  const getChildStatus = useCallback(
    (childId: string) => {
      return presence[childId] || { isOnline: false, lastSeen: null };
    },
    [presence]
  );

  return {
    presence,
    getChildStatus,
    isChildOnline: (childId: string) => presence[childId]?.isOnline || false,
  };
}

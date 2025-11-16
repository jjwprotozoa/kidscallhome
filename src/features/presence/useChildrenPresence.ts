// src/features/presence/useChildrenPresence.ts
// Hook for parents to subscribe to their children's online presence

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  const childIdsKey = useMemo(
    () => [...childIds].sort().join(","),
    [childIds]
  );

  // Initialize presence state for all children as offline
  useEffect(() => {
    if (!enabled) return;

    const initialPresence: PresenceState = {};
    childIds.forEach((childId) => {
      initialPresence[childId] = {
        isOnline: false,
        lastSeen: null,
      };
    });
    setPresence(initialPresence);
  }, [childIds, enabled]);

  useEffect(() => {
    if (!enabled || childIds.length === 0) return;

    // Clean up existing channels first to prevent duplicates
    const existingChannels = channelRefsRef.current;
    if (existingChannels.size > 0) {
      existingChannels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      existingChannels.clear();
    }

    const channels = new Map<string, RealtimeChannel>();

    // Subscribe to each child's presence channel
    childIds.forEach((childId) => {
      const channelName = `presence:child:${childId}`;
      
      // Log in development
      if (import.meta.env.DEV) {
        console.log("👀 [CHILDREN PRESENCE] Subscribing to child presence", {
          childId,
          channelName,
        });
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
          
          // Log in development
          if (import.meta.env.DEV) {
            console.log("🔄 [CHILDREN PRESENCE] Presence sync", {
              childId,
              channelName,
              state,
              stateKeys: Object.keys(state),
            });
          }
          
          // Presence state structure: { [userId]: PresenceMetadata[] }
          // Check if this specific child is present (their userId should be a key in the state)
          const isOnline = childId in state && Array.isArray(state[childId]) && state[childId].length > 0;

          setPresence((prev) => {
            const wasOnline = prev[childId]?.isOnline || false;
            
            // Get the most recent presence metadata for this child
            const childPresences = state[childId] as PresenceMetadata[] | undefined;
            const latestPresence = childPresences && childPresences.length > 0 
              ? childPresences[0] 
              : undefined;
            
            const newState = {
              ...prev,
              [childId]: {
                isOnline,
                lastSeen: isOnline
                  ? latestPresence?.lastSeen || new Date().toISOString()
                  : prev[childId]?.lastSeen || null,
              },
            };

            // Notify if status changed (only on actual change, not initial sync)
            if (wasOnline !== isOnline && onStatusChangeRef.current && prev[childId] !== undefined) {
              onStatusChangeRef.current(childId, isOnline);
              
              // Only log in development
              if (import.meta.env.DEV) {
                console.log("🔄 [CHILDREN PRESENCE] Presence status changed", {
                  childId,
                  isOnline,
                  wasOnline,
                });
              }
            }

            return newState;
          });
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          // Log in development
          if (import.meta.env.DEV) {
            console.log("👋 [CHILDREN PRESENCE] Child joined presence", {
              childId,
              key,
              matches: key === childId,
              newPresences,
            });
          }

          // Only update if this is the child we're tracking
          if (key !== childId) {
            if (import.meta.env.DEV) {
              console.log("⏭️ [CHILDREN PRESENCE] Skipping join - different child", {
                expected: childId,
                received: key,
              });
            }
            return;
          }

          const metadata = newPresences[0] as PresenceMetadata | undefined;
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
              console.log("🟢 [CHILDREN PRESENCE] Child marked as online via join", {
                childId,
                wasOnline,
                lastSeen: metadata?.lastSeen,
              });
            }

            return newState;
          });
        })
        .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
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
            // Log in development
            if (import.meta.env.DEV) {
              console.log("✅ [CHILDREN PRESENCE] Subscribed to child presence", {
                childId,
                channelName,
              });
            }
            
            // Check initial presence state after subscription
            // This handles the case where child was already online before parent subscribed
            setTimeout(() => {
              const state = channel.presenceState<PresenceMetadata>();
              const isOnline = childId in state && Array.isArray(state[childId]) && state[childId].length > 0;
              
              // Log in development
              if (import.meta.env.DEV) {
                console.log("🔍 [CHILDREN PRESENCE] Initial presence check", {
                  childId,
                  channelName,
                  state,
                  stateKeys: Object.keys(state),
                  isOnline,
                });
              }
              
              if (isOnline) {
                const childPresences = state[childId] as PresenceMetadata[] | undefined;
                const latestPresence = childPresences && childPresences.length > 0 
                  ? childPresences[0] 
                  : undefined;
                
                setPresence((prev) => ({
                  ...prev,
                  [childId]: {
                    isOnline: true,
                    lastSeen: latestPresence?.lastSeen || new Date().toISOString(),
                  },
                }));
                
                // Log in development
                if (import.meta.env.DEV) {
                  console.log("🟢 [CHILDREN PRESENCE] Child is online", {
                    childId,
                    lastSeen: latestPresence?.lastSeen,
                  });
                }
              } else {
                // Log in development
                if (import.meta.env.DEV) {
                  console.log("⚪ [CHILDREN PRESENCE] Child is offline", {
                    childId,
                  });
                }
              }
            }, 500); // Small delay to ensure presence state is synced
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("❌ [CHILDREN PRESENCE] Subscription error", {
              childId,
              status,
              error: err,
            });
          }
        });

      channels.set(childId, channel);
    });

    channelRefsRef.current = channels;

    return () => {
      // Silent cleanup
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channels.clear();
      channelRefsRef.current.clear();
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


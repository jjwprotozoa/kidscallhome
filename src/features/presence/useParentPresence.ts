// src/features/presence/useParentPresence.ts
// Hook for children to subscribe to their parent's online presence

import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/utils/security";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

interface PresenceMetadata {
  userId: string;
  userType: "parent" | "child";
  name?: string;
  lastSeen: string;
}

interface UseParentPresenceOptions {
  parentId: string;
  enabled?: boolean;
  onStatusChange?: (isOnline: boolean) => void;
}

/**
 * Hook for children to track their parent's online status
 * Returns { isOnline, lastSeen }
 */
export function useParentPresence({
  parentId,
  enabled = true,
  onStatusChange,
}: UseParentPresenceOptions) {
  const [presence, setPresence] = useState<{
    isOnline: boolean;
    lastSeen: string | null;
  }>({
    isOnline: false,
    lastSeen: null,
  });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);

  // Keep callback ref up to date
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    // Skip if disabled or parentId is empty/invalid
    if (!enabled || !parentId || parentId.trim() === "") {
      return;
    }

    const channelName = `presence:parent:${parentId}`;

    // Log in development
    if (import.meta.env.DEV) {
      safeLog.debug("👀 [PARENT PRESENCE] Subscribing to parent presence", {
        parentId,
        channelName,
      });
    }

    // Clean up existing channel first to prevent duplicates
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create channel for subscribing to presence
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: parentId, // Use parentId as key for presence state lookup
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMetadata>();

        // Log sync event in dev mode for debugging
        if (import.meta.env.DEV) {
          safeLog.debug("🔄 [PARENT PRESENCE] Presence sync event", {
            parentId,
            stateKeys: Object.keys(state),
            hasParent: parentId in state,
          });
        }

        // Check if parent is present
        const isOnline =
          parentId in state &&
          Array.isArray(state[parentId]) &&
          state[parentId].length > 0;

        const parentPresences = state[parentId] as
          | PresenceMetadata[]
          | undefined;
        const latestPresence =
          parentPresences && parentPresences.length > 0
            ? parentPresences[0]
            : undefined;
        const newLastSeen = isOnline
          ? latestPresence?.lastSeen || new Date().toISOString()
          : null;

        setPresence((prev) => {
          const wasOnline = prev.isOnline;
          const prevLastSeen = prev.lastSeen || null;

          // Only update state if something actually changed
          // This prevents unnecessary re-renders and reduces message spam
          if (wasOnline === isOnline && prevLastSeen === newLastSeen) {
            return prev; // No change, return previous state
          }

          // Log in development only when there's an actual change
          if (import.meta.env.DEV && wasOnline !== isOnline) {
            safeLog.debug("🔄 [PARENT PRESENCE] Presence status changed", {
              parentId,
              isOnline,
              wasOnline,
            });
          }

          const newState = {
            isOnline,
            lastSeen: newLastSeen || prevLastSeen,
          };

          // Notify if status changed (remove the prev.lastSeen check to allow initial online detection)
          if (wasOnline !== isOnline && onStatusChangeRef.current) {
            onStatusChangeRef.current(isOnline);
          }

          return newState;
        });
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        // Only update if this is the parent we're tracking
        if (key !== parentId) {
          return;
        }

        // Log in development
        if (import.meta.env.DEV) {
          safeLog.debug("👋 [PARENT PRESENCE] Parent joined presence", {
            parentId,
            key,
            matches: key === parentId,
            newPresences,
          });
        }

        const metadata = newPresences[0] as unknown as
          | PresenceMetadata
          | undefined;
        setPresence((prev) => {
          const wasOnline = prev.isOnline;
          const newState = {
            isOnline: true,
            lastSeen: metadata?.lastSeen || new Date().toISOString(),
          };

          if (!wasOnline && onStatusChangeRef.current) {
            onStatusChangeRef.current(true);
          }

          // Log in development
          if (import.meta.env.DEV) {
            safeLog.debug(
              "🟢 [PARENT PRESENCE] Parent marked as online via join",
              {
                parentId,
                wasOnline,
                lastSeen: metadata?.lastSeen,
              }
            );
          }

          return newState;
        });
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        // Only update if this is the parent we're tracking
        if (key !== parentId) {
          return;
        }

        setPresence((prev) => {
          const wasOnline = prev.isOnline;
          const newState = {
            isOnline: false,
            lastSeen: prev.lastSeen || new Date().toISOString(),
          };

          if (wasOnline && onStatusChangeRef.current) {
            onStatusChangeRef.current(false);
          }

          return newState;
        });
      })
      .subscribe((status, err) => {
        // Only log non-transient statuses in dev mode for debugging
        // Skip logging TIMED_OUT and CHANNEL_ERROR here - they're handled below
        if (
          import.meta.env.DEV &&
          status !== "TIMED_OUT" &&
          status !== "CHANNEL_ERROR"
        ) {
          safeLog.debug(`[PARENT PRESENCE] Subscription status: ${status}`, {
            parentId,
            channelName,
            error: err,
          });
        }

        if (status === "SUBSCRIBED") {
          // Log in development
          if (import.meta.env.DEV) {
            safeLog.debug(
              "✅ [PARENT PRESENCE] Subscribed to parent presence",
              {
                parentId,
                channelName,
              }
            );
          }

          // Check initial presence state after subscription
          // Use longer delay to ensure presence state is fully synced
          setTimeout(() => {
            const state = channel.presenceState<PresenceMetadata>();
            const isOnline =
              parentId in state &&
              Array.isArray(state[parentId]) &&
              state[parentId].length > 0;

            // Log in development
            if (import.meta.env.DEV) {
              safeLog.debug("🔍 [PARENT PRESENCE] Initial presence check", {
                parentId,
                channelName,
                state,
                stateKeys: Object.keys(state),
                isOnline,
              });
            }

            if (isOnline) {
              const parentPresences = state[parentId] as
                | PresenceMetadata[]
                | undefined;
              const latestPresence =
                parentPresences && parentPresences.length > 0
                  ? parentPresences[0]
                  : undefined;

              setPresence({
                isOnline: true,
                lastSeen: latestPresence?.lastSeen || new Date().toISOString(),
              });

              // Log in development
              if (import.meta.env.DEV) {
                safeLog.debug("🟢 [PARENT PRESENCE] Parent is online", {
                  parentId,
                  lastSeen: latestPresence?.lastSeen,
                });
              }
            } else {
              // Log in development
              if (import.meta.env.DEV) {
                safeLog.debug("⚪ [PARENT PRESENCE] Parent is offline", {
                  parentId,
                });
              }
            }
          }, 1000); // Increased delay to ensure presence state is synced
        } else if (status === "TIMED_OUT") {
          // TIMED_OUT is often transient - don't treat as fatal error
          // The subscription will retry automatically on next effect run
          // Check if error contains "mismatch" message - this is a known Supabase issue
          const errorMessage =
            err instanceof Error ? err.message : String(err || "");
          if (
            errorMessage.includes("mismatch between server and client bindings")
          ) {
            // This is a known Supabase Realtime issue - often resolves on retry
            if (import.meta.env.DEV) {
              safeLog.debug(
                "⏱️ [PARENT PRESENCE] Subscription timed out with binding mismatch (will retry)",
                {
                  parentId,
                  channelName,
                }
              );
            }
          } else {
            if (import.meta.env.DEV) {
              safeLog.debug(
                "⏱️ [PARENT PRESENCE] Subscription timed out (will retry)",
                {
                  parentId,
                  channelName,
                }
              );
            }
          }

          // Don't reset presence state on timeout - keep last known state
          // This prevents flickering between online/offline during transient network issues
        } else if (status === "CHANNEL_ERROR") {
          // Check if it's the "mismatch" error - this is often transient
          const errorMessage =
            err instanceof Error ? err.message : String(err || "");
          if (
            errorMessage.includes("mismatch between server and client bindings")
          ) {
            // This is a known Supabase Realtime issue - often resolves on retry
            if (import.meta.env.DEV) {
              safeLog.debug(
                "⚠️ [PARENT PRESENCE] Subscription binding mismatch (will retry)",
                {
                  parentId,
                  channelName,
                }
              );
            }
            // Don't reset state on binding mismatch - it's often transient
          } else {
            safeLog.error("❌ [PARENT PRESENCE] Subscription error", {
              parentId,
              status,
              error: err,
              channelName,
            });

            // Reset presence state on actual error (not timeout or binding mismatch)
            setPresence({
              isOnline: false,
              lastSeen: null,
            });
          }
        }
        // Other statuses (SUBSCRIBING, CLOSED, etc.) are logged above
      });

    channelRef.current = channel;

    return () => {
      // Cleanup
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [parentId, enabled]);

  return {
    isOnline: presence.isOnline,
    lastSeen: presence.lastSeen,
  };
}

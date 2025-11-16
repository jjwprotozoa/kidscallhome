// src/features/presence/useParentPresence.ts
// Hook for children to subscribe to their parent's online presence

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
    if (!enabled || !parentId) return;

    const channelName = `presence:parent:${parentId}`;
    
    // Log in development
    if (import.meta.env.DEV) {
      console.log("👀 [PARENT PRESENCE] Subscribing to parent presence", {
        parentId,
        channelName,
      });
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
        
        // Log in development
        if (import.meta.env.DEV) {
          console.log("🔄 [PARENT PRESENCE] Presence sync", {
            parentId,
            channelName,
            state,
            stateKeys: Object.keys(state),
          });
        }
        
        // Check if parent is present
        const isOnline = parentId in state && Array.isArray(state[parentId]) && state[parentId].length > 0;
        
        const parentPresences = state[parentId] as PresenceMetadata[] | undefined;
        const latestPresence = parentPresences && parentPresences.length > 0 
          ? parentPresences[0] 
          : undefined;

        setPresence((prev) => {
          const wasOnline = prev.isOnline;
          const newState = {
            isOnline,
            lastSeen: isOnline
              ? latestPresence?.lastSeen || new Date().toISOString()
              : prev.lastSeen || null,
          };

          // Notify if status changed
          if (wasOnline !== isOnline && onStatusChangeRef.current && prev.lastSeen !== null) {
            onStatusChangeRef.current(isOnline);
            
            // Only log in development
            if (import.meta.env.DEV) {
              console.log("🔄 [PARENT PRESENCE] Presence status changed", {
                parentId,
                isOnline,
                wasOnline,
              });
            }
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
          console.log("👋 [PARENT PRESENCE] Parent joined presence", {
            parentId,
            key,
            matches: key === parentId,
            newPresences,
          });
        }

        const metadata = newPresences[0] as PresenceMetadata | undefined;
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
            console.log("🟢 [PARENT PRESENCE] Parent marked as online via join", {
              parentId,
              wasOnline,
              lastSeen: metadata?.lastSeen,
            });
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
        if (status === "SUBSCRIBED") {
          // Log in development
          if (import.meta.env.DEV) {
            console.log("✅ [PARENT PRESENCE] Subscribed to parent presence", {
              parentId,
              channelName,
            });
          }
          
          // Check initial presence state after subscription
          setTimeout(() => {
            const state = channel.presenceState<PresenceMetadata>();
            const isOnline = parentId in state && Array.isArray(state[parentId]) && state[parentId].length > 0;
            
            // Log in development
            if (import.meta.env.DEV) {
              console.log("🔍 [PARENT PRESENCE] Initial presence check", {
                parentId,
                channelName,
                state,
                stateKeys: Object.keys(state),
                isOnline,
              });
            }
            
            if (isOnline) {
              const parentPresences = state[parentId] as PresenceMetadata[] | undefined;
              const latestPresence = parentPresences && parentPresences.length > 0 
                ? parentPresences[0] 
                : undefined;
              
              setPresence({
                isOnline: true,
                lastSeen: latestPresence?.lastSeen || new Date().toISOString(),
              });
              
              // Log in development
              if (import.meta.env.DEV) {
                console.log("🟢 [PARENT PRESENCE] Parent is online", {
                  parentId,
                  lastSeen: latestPresence?.lastSeen,
                });
              }
            } else {
              // Log in development
              if (import.meta.env.DEV) {
                console.log("⚪ [PARENT PRESENCE] Parent is offline", {
                  parentId,
                });
              }
            }
          }, 500); // Small delay to ensure presence state is synced
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("❌ [PARENT PRESENCE] Subscription error", {
            parentId,
            status,
            error: err,
          });
        }
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


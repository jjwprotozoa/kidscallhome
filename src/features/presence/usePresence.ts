// src/features/presence/usePresence.ts
// Hook for tracking user online presence using Supabase Realtime Presence API

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceMetadata {
  userId: string;
  userType: "parent" | "child";
  name?: string;
  lastSeen: string;
}

interface UsePresenceOptions {
  userId: string;
  userType: "parent" | "child";
  name?: string;
  enabled?: boolean;
}

/**
 * Hook to track user's online presence
 * Automatically tracks presence when enabled and cleans up on unmount
 */
export function usePresence({
  userId,
  userType,
  name,
  enabled = true,
}: UsePresenceOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Log in development even if disabled or no userId
    if (import.meta.env.DEV) {
      console.log("🔍 [PRESENCE] usePresence hook called", {
        enabled,
        userId,
        userType,
        name,
        willTrack: enabled && !!userId,
      });
    }

    if (!enabled || !userId) {
      if (import.meta.env.DEV) {
        console.log("⏸️ [PRESENCE] Skipping presence tracking", {
          reason: !enabled ? "disabled" : "no userId",
          enabled,
          userId,
        });
      }
      return;
    }

    const channelName = `presence:${userType}:${userId}`;
    // Only log in development
    if (import.meta.env.DEV) {
      console.log("🟢 [PRESENCE] Starting presence tracking", {
        channelName,
        userId,
        userType,
      });
    }

    // Create presence channel
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    // Track presence
    channel
      .on("presence", { event: "sync" }, () => {
        // Silent sync - only log errors
      })
      .on("presence", { event: "join" }, () => {
        // Silent join - presence system handles this
      })
      .on("presence", { event: "leave" }, () => {
        // Silent leave - presence system handles this
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Log in development
          if (import.meta.env.DEV) {
            console.log("✅ [PRESENCE] Subscribed to presence channel", {
              channelName,
              userId,
              userType,
            });
          }

          // Set initial presence
          const presence: PresenceMetadata = {
            userId,
            userType,
            name,
            lastSeen: new Date().toISOString(),
          };

          await channel.track(presence);

          // Log in development
          if (import.meta.env.DEV) {
            console.log("📡 [PRESENCE] Tracking presence", {
              channelName,
              userId,
              presence,
            });
          }

          // Update presence periodically (every 30 seconds) to keep it fresh
          const interval = setInterval(() => {
            channel.track({
              ...presence,
              lastSeen: new Date().toISOString(),
            });
          }, 30000);

          // Store interval ID for cleanup
          (channel as any)._presenceInterval = interval;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("❌ [PRESENCE] Presence channel error", {
            status,
            channelName,
            userId,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      // Silent cleanup

      // Clear interval if it exists
      if ((channel as any)._presenceInterval) {
        clearInterval((channel as any)._presenceInterval);
      }

      // Untrack and unsubscribe
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, userType, name, enabled]);
}


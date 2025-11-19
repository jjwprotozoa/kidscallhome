// src/features/presence/usePresence.ts
// Optimized presence tracking with 60-second heartbeat and minimal updates
// Only updates UI on status changes, reduces server/database load

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
 * Optimized presence tracking hook
 * - Sends heartbeat every 60 seconds (not every few seconds)
 * - Only updates on connection/disconnection events
 * - Minimal server and database usage
 * - Sends "online" event on connect, "offline" event on disconnect
 */
export function usePresence({
  userId,
  userType,
  name,
  enabled = true,
}: UsePresenceOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    const channelName = `presence:${userType}:${userId}`;
    
    // Log in development only
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

    // Set initial presence metadata
    const presence: PresenceMetadata = {
      userId,
      userType,
      name,
      lastSeen: new Date().toISOString(),
    };

    // Subscribe to channel
    channel
      .on("presence", { event: "sync" }, () => {
        // Silent sync - no logging to reduce console noise
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          isConnectedRef.current = true;
          
          // Send initial "online" event on WebSocket connection
          await channel.track(presence);
          
          if (import.meta.env.DEV) {
            console.log("✅ [PRESENCE] Connected and tracking presence", {
              channelName,
              userId,
            });
          }

          // Start heartbeat timer - send heartbeat every 60 seconds
          heartbeatIntervalRef.current = setInterval(() => {
            if (isConnectedRef.current && channelRef.current) {
              channelRef.current.track({
                ...presence,
                lastSeen: new Date().toISOString(),
              });
              
              // Only log in development, and only occasionally to reduce noise
              if (import.meta.env.DEV && Math.random() < 0.1) {
                console.log("💓 [PRESENCE] Heartbeat sent", { userId });
              }
            }
          }, 60000); // 60 seconds
          
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          isConnectedRef.current = false;
          // Only log errors in development, and only if it's not a common timeout
          if (import.meta.env.DEV && status !== "TIMED_OUT") {
            console.error("❌ [PRESENCE] Presence channel error", {
              status,
              channelName,
              userId,
            });
          }
        } else if (status === "CLOSED") {
          isConnectedRef.current = false;
          // Silent close - normal cleanup
        }
      });

    channelRef.current = channel;

    // Handle page visibility changes - pause heartbeat when tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - heartbeat will resume when visible again
        // The WebSocket connection stays alive, but we reduce activity
      } else {
        // Tab is visible again - ensure we're still tracking
        if (channelRef.current && isConnectedRef.current) {
          channelRef.current.track({
            ...presence,
            lastSeen: new Date().toISOString(),
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Handle page unload - send offline event
    const handleBeforeUnload = () => {
      if (channelRef.current) {
        channelRef.current.untrack(); // Send "offline" event
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // Cleanup: send offline event and remove tracking
      if (channelRef.current) {
        channelRef.current.untrack(); // Send "offline" event on disconnect/app exit
        supabase.removeChannel(channelRef.current);
      }
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      
      isConnectedRef.current = false;
      channelRef.current = null;
    };
  }, [userId, userType, name, enabled]);
}


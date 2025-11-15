// src/features/calls/dev/callsRealtimeDebug.ts
// Dev-only realtime debug listener for the calls table
// Used to verify Supabase Realtime events are received correctly during development

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

let debugChannel: RealtimeChannel | null = null;
let isInitialized = false;

/**
 * Initializes a Supabase Realtime listener for all postgres changes on the `calls` table.
 * This is a dev-only debugging tool to verify that realtime events are being received.
 *
 * @returns A cleanup function that unsubscribes the channel, or null if already initialized
 */
export function initCallsRealtimeDebug(): (() => void) | null {
  // Prevent multiple initializations
  if (isInitialized) {
    console.warn("[CALLS REALTIME] Debug listener already initialized");
    return null;
  }

  isInitialized = true;

  debugChannel = supabase
    .channel("calls-realtime-debug")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "calls",
      },
      (payload) => {
        console.log("[CALLS REALTIME]", {
          eventType: payload.eventType,
          schema: payload.schema,
          table: payload.table,
          new: payload.new,
          old: payload.old,
        });
      }
    )
    .subscribe((status) => {
      console.log("[CALLS REALTIME] subscription status:", status);
    });

  // Return cleanup function
  return () => {
    if (debugChannel) {
      supabase.removeChannel(debugChannel);
      debugChannel = null;
      isInitialized = false;
    }
  };
}

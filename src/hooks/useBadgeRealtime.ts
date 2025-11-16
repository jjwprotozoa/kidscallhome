// src/hooks/useBadgeRealtime.ts
// Realtime subscriptions that update badge store (zero DB reads)

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBadgeStore } from "@/stores/badgeStore";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useBadgeRealtime() {
  const messagesChannelRef = useRef<RealtimeChannel | null>(null);
  const callsChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const childSession = localStorage.getItem("childSession");
    const isChild = !!childSession;

    // Messages subscription
    messagesChannelRef.current = supabase
      .channel("badge-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const message = payload.new as {
            child_id: string;
            sender_type: string;
            read_at: string | null;
          };

          if (isChild) {
            // Child: count messages FROM parent (unread for child)
            if (message.sender_type === "parent" && !message.read_at) {
              useBadgeStore.getState().incrementUnread(message.child_id);
            }
          } else {
            // Parent: count messages FROM children (unread for parent)
            if (message.sender_type === "child" && !message.read_at) {
              useBadgeStore.getState().incrementUnread(message.child_id);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const oldMessage = payload.old as {
            child_id: string;
            sender_type: string;
            read_at: string | null;
          };
          const newMessage = payload.new as {
            child_id: string;
            sender_type: string;
            read_at: string | null;
          };

          // If read_at changed from null to a value, decrement count
          const wasUnread = !oldMessage.read_at;
          const isNowRead = !!newMessage.read_at;

          if (wasUnread && isNowRead) {
            if (isChild) {
              if (oldMessage.sender_type === "parent") {
                useBadgeStore.getState().decrementUnread(oldMessage.child_id);
              }
            } else {
              if (oldMessage.sender_type === "child") {
                useBadgeStore.getState().decrementUnread(oldMessage.child_id);
              }
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log("📡 [BADGE REALTIME] Messages subscription status:", status);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.error("❌ [BADGE REALTIME] Messages subscription failed:", err);
          // Supabase will auto-reconnect, but we can trigger a reconciliation if needed
          // For now, rely on Supabase's built-in reconnection
        }
      });

    // Calls subscription
    callsChannelRef.current = supabase
      .channel("badge-calls")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
        },
        (payload) => {
          const call = payload.new as {
            child_id: string;
            caller_type: string;
            missed_call: boolean;
            missed_call_read_at: string | null;
          };

          if (call.missed_call && !call.missed_call_read_at) {
            if (isChild) {
              // Child: count missed calls FROM parent
              if (call.caller_type === "parent") {
                useBadgeStore.getState().incrementMissed(call.child_id);
              }
            } else {
              // Parent: count missed calls FROM children
              if (call.caller_type === "child") {
                useBadgeStore.getState().incrementMissed(call.child_id);
              }
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
        },
        (payload) => {
          const oldCall = payload.old as {
            child_id: string;
            caller_type: string;
            missed_call: boolean;
            missed_call_read_at: string | null;
          };
          const newCall = payload.new as {
            child_id: string;
            caller_type: string;
            missed_call: boolean;
            missed_call_read_at: string | null;
          };

          // If missed_call_read_at changed from null to a value, decrement count
          const wasUnread = !oldCall.missed_call_read_at;
          const isNowRead = !!newCall.missed_call_read_at;

          if (wasUnread && isNowRead && oldCall.missed_call) {
            if (isChild) {
              if (oldCall.caller_type === "parent") {
                useBadgeStore.getState().decrementMissed(oldCall.child_id);
              }
            } else {
              if (oldCall.caller_type === "child") {
                useBadgeStore.getState().decrementMissed(oldCall.child_id);
              }
            }
          }

          // If call becomes missed (status changed to ended without being answered)
          if (!oldCall.missed_call && newCall.missed_call && !newCall.missed_call_read_at) {
            if (isChild) {
              if (newCall.caller_type === "parent") {
                useBadgeStore.getState().incrementMissed(newCall.child_id);
              }
            } else {
              if (newCall.caller_type === "child") {
                useBadgeStore.getState().incrementMissed(newCall.child_id);
              }
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log("📡 [BADGE REALTIME] Calls subscription status:", status);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.error("❌ [BADGE REALTIME] Calls subscription failed:", err);
          // Supabase will auto-reconnect, but we can trigger a reconciliation if needed
          // For now, rely on Supabase's built-in reconnection
        }
      });

    return () => {
      if (messagesChannelRef.current) {
        supabase.removeChannel(messagesChannelRef.current);
      }
      if (callsChannelRef.current) {
        supabase.removeChannel(callsChannelRef.current);
      }
    };
  }, []);

  return null;
}


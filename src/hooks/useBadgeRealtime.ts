// src/hooks/useBadgeRealtime.ts
// Realtime subscriptions that update badge store (zero DB reads)
// Only increments badges for NEW messages/calls (created after last cleared timestamp)

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBadgeStore } from "@/stores/badgeStore";
import { getLastClearedTimestamp } from "@/utils/badgeStorage";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useBadgeRealtime() {
  const messagesChannelRef = useRef<RealtimeChannel | null>(null);
  const callsChannelRef = useRef<RealtimeChannel | null>(null);
  // Track recently processed status changes to prevent duplicate processing
  const recentlyProcessedRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Check if localStorage is available
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
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
          // Defer heavy operations to prevent blocking the message handler
          // Use requestIdleCallback if available, otherwise setTimeout
          const scheduleWork = (callback: () => void) => {
            if ('requestIdleCallback' in window) {
              requestIdleCallback(callback, { timeout: 50 });
            } else {
              setTimeout(callback, 0);
            }
          };

          scheduleWork(() => {
            const message = payload.new as {
              child_id: string;
              sender_type: string;
              read_at: string | null;
              created_at: string;
            };

            // Only count NEW messages (created after last cleared timestamp)
            const lastCleared = getLastClearedTimestamp(message.child_id, "messages");
            if (lastCleared && message.created_at <= lastCleared) {
              // This is an old message, ignore it
              return;
            }

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
          });
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
          // Defer heavy operations to prevent blocking the message handler
          const scheduleWork = (callback: () => void) => {
            if ('requestIdleCallback' in window) {
              requestIdleCallback(callback, { timeout: 50 });
            } else {
              setTimeout(callback, 0);
            }
          };

          scheduleWork(() => {
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
          });
        }
      )
      .subscribe((status, err) => {
        // Only log errors, not normal status changes
        if (err) {
          // Check if it's the "mismatch" error - this is often transient and can be ignored
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (errorMessage.includes("mismatch between server and client bindings")) {
            // This is a known Supabase Realtime issue - often resolves on retry
            if (import.meta.env.DEV) {
              console.warn("⚠️ [BADGE REALTIME] Messages subscription binding mismatch (will retry):", errorMessage);
            }
          } else {
            console.error("❌ [BADGE REALTIME] Messages subscription error:", err);
          }
        } else if (status === "TIMED_OUT") {
          // TIMED_OUT is often transient - don't log as error
          if (import.meta.env.DEV) {
            console.debug("⏱️ [BADGE REALTIME] Messages subscription timed out (will retry)");
          }
        } else if (status === "CHANNEL_ERROR") {
          // CHANNEL_ERROR is often transient - check if it's a binding mismatch
          const errorMessage = err instanceof Error ? err.message : String(err || "");
          if (errorMessage.includes("mismatch between server and client bindings")) {
            // This is a known Supabase Realtime issue - often resolves on retry
            if (import.meta.env.DEV) {
              console.warn("⚠️ [BADGE REALTIME] Messages subscription binding mismatch (will retry):", errorMessage);
            }
          } else {
            // Only log non-binding-mismatch CHANNEL_ERRORs
            // CHANNEL_ERROR often happens when connection closes - Supabase will auto-retry
            if (import.meta.env.DEV) {
              console.debug("⚠️ [BADGE REALTIME] Messages subscription channel error (will auto-retry):", status);
            }
          }
        } else if (status === "SUBSCRIBED") {
          // Successfully subscribed - clear any previous errors
          if (import.meta.env.DEV) {
            console.debug("✅ [BADGE REALTIME] Messages subscription active");
          }
        }
        // CLOSED is normal cleanup, don't log as error
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
          // Defer heavy operations to prevent blocking the message handler
          const scheduleWork = (callback: () => void) => {
            if ('requestIdleCallback' in window) {
              requestIdleCallback(callback, { timeout: 50 });
            } else {
              setTimeout(callback, 0);
            }
          };

          scheduleWork(() => {
            const call = payload.new as {
              child_id: string;
              caller_type: string;
              missed_call: boolean;
              missed_call_read_at: string | null;
              created_at: string;
            };

            // Only count NEW missed calls (created after last cleared timestamp)
            const lastCleared = getLastClearedTimestamp(call.child_id, "calls");
            if (lastCleared && call.created_at <= lastCleared) {
              // This is an old call, ignore it
              return;
            }

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
          });
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
          // Defer heavy operations to prevent blocking the message handler
          const scheduleWork = (callback: () => void) => {
            if ('requestIdleCallback' in window) {
              requestIdleCallback(callback, { timeout: 50 });
            } else {
              setTimeout(callback, 0);
            }
          };

          scheduleWork(() => {
            const oldCall = payload.old as {
              id?: string;
              child_id: string;
              caller_type: string;
              missed_call: boolean;
              missed_call_read_at: string | null;
              status?: string;
            };
            const newCall = payload.new as {
              id?: string;
              child_id: string;
              caller_type: string;
              missed_call: boolean;
              missed_call_read_at: string | null;
              status?: string;
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

            // CRITICAL: If call becomes "active" (connected), clear missed call badge
            // This ensures that when a call is successfully connected, missed call notifications are cleared
            // because the user has "seen" the missed calls by connecting with them
            const statusChangedToActive = 
              newCall.status === "active" && 
              oldCall.status !== "active";

            if (statusChangedToActive) {
              // Deduplicate: prevent processing the same status change multiple times
              // Use call ID as the key (if available), otherwise use child_id + caller_type as fallback
              const callId = newCall.id || 
                `${newCall.child_id}-${newCall.caller_type}-active`;
              const now = Date.now();
              const lastProcessed = recentlyProcessedRef.current.get(callId);
              
              // Only process if we haven't seen this status change in the last 2 seconds
              if (!lastProcessed || now - lastProcessed > 2000) {
                recentlyProcessedRef.current.set(callId, now);
                
                // Optimize cleanup: only clean up if map is getting large (>50 entries)
                // This prevents unnecessary loops on every update
                if (recentlyProcessedRef.current.size > 50) {
                  // Clean up old entries (older than 10 seconds) to prevent memory leak
                  for (const [key, timestamp] of recentlyProcessedRef.current.entries()) {
                    if (now - timestamp > 10000) {
                      recentlyProcessedRef.current.delete(key);
                    }
                  }
                }
                
                if (import.meta.env.DEV) {
                  console.log("✅ [BADGE REALTIME] Call became active - clearing missed call badge", {
                    childId: newCall.child_id,
                    callerType: newCall.caller_type,
                  });
                }
                
                // Clear missed call badge for this child when ANY call connects
                // This makes sense because if you're calling them now, you've "seen" previous missed calls
                if (isChild) {
                  // Child: clear badge for missed calls from parent
                  if (newCall.caller_type === "parent") {
                    useBadgeStore.getState().clearMissedForChild(newCall.child_id);
                  }
                } else {
                  // Parent: clear badge for missed calls from child
                  if (newCall.caller_type === "child") {
                    useBadgeStore.getState().clearMissedForChild(newCall.child_id);
                  }
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
          });
        }
      )
      .subscribe((status, err) => {
        // Only log errors, not normal status changes
        if (err) {
          // Check if it's the "mismatch" error - this is often transient and can be ignored
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (errorMessage.includes("mismatch between server and client bindings")) {
            // This is a known Supabase Realtime issue - often resolves on retry
            if (import.meta.env.DEV) {
              console.warn("⚠️ [BADGE REALTIME] Calls subscription binding mismatch (will retry):", errorMessage);
            }
          } else {
            console.error("❌ [BADGE REALTIME] Calls subscription error:", err);
          }
        } else if (status === "TIMED_OUT") {
          // TIMED_OUT is often transient - don't log as error
          if (import.meta.env.DEV) {
            console.debug("⏱️ [BADGE REALTIME] Calls subscription timed out (will retry)");
          }
        } else if (status === "CHANNEL_ERROR") {
          // CHANNEL_ERROR is often transient - check if it's a binding mismatch
          const errorMessage = err instanceof Error ? err.message : String(err || "");
          if (errorMessage.includes("mismatch between server and client bindings")) {
            // This is a known Supabase Realtime issue - often resolves on retry
            if (import.meta.env.DEV) {
              console.warn("⚠️ [BADGE REALTIME] Calls subscription binding mismatch (will retry):", errorMessage);
            }
          } else {
            // Only log non-binding-mismatch CHANNEL_ERRORs
            // CHANNEL_ERROR often happens when connection closes - Supabase will auto-retry
            if (import.meta.env.DEV) {
              console.debug("⚠️ [BADGE REALTIME] Calls subscription channel error (will auto-retry):", status);
            }
          }
        } else if (status === "SUBSCRIBED") {
          // Successfully subscribed - clear any previous errors
          if (import.meta.env.DEV) {
            console.debug("✅ [BADGE REALTIME] Calls subscription active");
          }
        }
        // CLOSED is normal cleanup, don't log as error
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


// src/hooks/useParentIncomingCallSubscription.ts
// Purpose: Hook to handle incoming call subscriptions for parent dashboard
// Extracted from ParentDashboard.tsx to reduce complexity

import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

interface IncomingCall {
  id: string;
  child_id: string;
  child_name: string;
  child_avatar_color: string;
}

interface CallRecord {
  id: string;
  child_id: string;
  parent_id: string;
  caller_type: string;
  status: string;
  created_at: string;
  ended_at?: string | null;
}

interface UseParentIncomingCallSubscriptionProps {
  onIncomingCall: (call: IncomingCall) => void;
  onCallCleared: (callId: string) => void;
  currentIncomingCall: IncomingCall | null;
  enabled?: boolean;
}

export const useParentIncomingCallSubscription = ({
  onIncomingCall,
  onCallCleared,
  currentIncomingCall,
  enabled = true,
}: UseParentIncomingCallSubscriptionProps) => {
  const location = useLocation();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { handleIncomingCall } = useIncomingCallNotifications({
    enabled: true,
    volume: 0.7,
  });
  const handleIncomingCallRef = useRef(handleIncomingCall);
  const lastCheckedCallIdRef = useRef<string | null>(null);
  const currentIncomingCallRef = useRef<IncomingCall | null>(null);
  const onIncomingCallRef = useRef(onIncomingCall);
  const onCallClearedRef = useRef(onCallCleared);

  // Keep refs in sync with latest values
  useEffect(() => {
    handleIncomingCallRef.current = handleIncomingCall;
  }, [handleIncomingCall]);

  useEffect(() => {
    currentIncomingCallRef.current = currentIncomingCall;
  }, [currentIncomingCall]);

  useEffect(() => {
    onIncomingCallRef.current = onIncomingCall;
  }, [onIncomingCall]);

  useEffect(() => {
    onCallClearedRef.current = onCallCleared;
  }, [onCallCleared]);

  useEffect(() => {
    if (!enabled) return;

    let pollInterval: NodeJS.Timeout | null = null;

    const setupSubscription = async () => {
      // Use getSession() instead of getUser() - lighter weight, no auth endpoint call
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const userId = session.user.id; // Cache user ID to avoid repeated calls

      // Function to handle incoming call notification
      const handleIncomingCallNotification = async (call: CallRecord) => {
        // Skip if we already showed this call
        if (call.id === lastCheckedCallIdRef.current) return;

        // IMPORTANT: Don't show incoming call notification if user is already on the call page
        // This prevents showing notifications for calls the parent initiated
        if (location.pathname.startsWith("/call/")) {
          return;
        }

        lastCheckedCallIdRef.current = call.id;

        const { data: childData } = await supabase
          .from("children")
          .select("name, avatar_color")
          .eq("id", call.child_id)
          .single();

        if (childData) {
          if (import.meta.env.DEV) {
            console.log("📞 [PARENT DASHBOARD] Incoming call:", childData.name);
          }
          const incomingCall: IncomingCall = {
            id: call.id,
            child_id: call.child_id,
            child_name: childData.name,
            child_avatar_color: childData.avatar_color,
          };
          onIncomingCallRef.current(incomingCall);
          // Handle incoming call with notifications (push notification if tab inactive, ringtone if active)
          handleIncomingCallRef.current({
            callId: call.id,
            callerName: childData.name,
            callerId: call.child_id,
            url: `/call/${call.child_id}?callId=${call.id}`,
          });
        } else {
          console.error("Failed to fetch child data for call");
        }
      };

      // Check for existing ringing calls from children (in case subscription missed them)
      // Check calls created in the last 2 minutes to catch calls that might have been created
      // while the dashboard was loading or subscription was setting up
      const checkExistingCalls = async () => {
        const twoMinutesAgo = new Date(
          Date.now() - 2 * 60 * 1000
        ).toISOString();
        const { data: existingCalls } = await supabase
          .from("calls")
          .select("*")
          .eq("parent_id", userId)
          .eq("caller_type", "child")
          .eq("status", "ringing")
          .gte("created_at", twoMinutesAgo)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existingCalls && existingCalls.length > 0) {
          const call = existingCalls[0];
          if (call.id !== lastCheckedCallIdRef.current) {
            await handleIncomingCallNotification(call);
          }
        }
      };

      // Polling function to check for new calls (fallback for realtime)
      // IMPORTANT: Only check for child-initiated calls, not parent-initiated ones
      // Use a 1-minute window since we poll every 60 seconds
      const pollForCalls = async () => {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
        const { data: newCalls, error: pollError } = await supabase
          .from("calls")
          .select("*")
          .eq("parent_id", userId)
          .eq("caller_type", "child") // Only child-initiated calls
          .eq("status", "ringing")
          .gte("created_at", oneMinuteAgo)
          .order("created_at", { ascending: false })
          .limit(1);

        if (pollError) {
          console.error("❌ [PARENT DASHBOARD] Polling error:", pollError);
          return;
        }

        if (newCalls && newCalls.length > 0) {
          const call = newCalls[0];
          if (call.id !== lastCheckedCallIdRef.current) {
            await handleIncomingCallNotification(call);
          }
        }
      };

      // Check immediately
      await checkExistingCalls();

      // Set up polling as a fallback (every 60 seconds - reduced frequency to minimize console noise)
      // Realtime subscriptions should handle most cases, this is just a safety net
      pollInterval = setInterval(pollForCalls, 60000);

      // Subscribe to new calls from children
      // Listen to both INSERT and UPDATE events to catch calls that are reset to ringing
      channelRef.current = supabase
        .channel("parent-incoming-calls")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "calls",
            filter: `parent_id=eq.${userId}`,
          },
          async (payload) => {
            const call = payload.new as CallRecord;

            // Verify this call is from a child, for this parent, and is ringing
            // IMPORTANT: Only show incoming call dialog for child-initiated calls, not parent-initiated ones
            if (
              call.caller_type === "child" &&
              call.parent_id === userId &&
              call.status === "ringing"
            ) {
              await handleIncomingCallNotification(call);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "calls",
            filter: `parent_id=eq.${userId}`,
          },
          async (payload) => {
            const call = payload.new as CallRecord;
            const oldCall = payload.old as CallRecord;

            // CRITICAL: Always ignore parent-initiated calls - they should never show notifications
            // Parent-initiated calls are handled by the call page, not the dashboard
            if (call.caller_type === "parent") {
              return; // Early return - don't process parent-initiated calls at all
            }

            // Don't process updates if user is on the call page
            if (location.pathname.startsWith("/call/")) {
              return;
            }

            // Clear incoming call if it was answered or ended
            // Use ref to check if this is the call we're tracking (avoids dependency issues)
            if (
              currentIncomingCallRef.current &&
              currentIncomingCallRef.current.id === call.id &&
              (call.status === "active" || call.status === "ended")
            ) {
              onCallClearedRef.current(call.id);
            }

            // Check if status changed to "ringing" for a child-initiated call
            // IMPORTANT: Only show incoming call dialog for child-initiated calls
            if (
              call.caller_type === "child" &&
              call.parent_id === userId &&
              call.status === "ringing" &&
              oldCall.status !== "ringing"
            ) {
              await handleIncomingCallNotification(call);
            }
          }
        )
        .subscribe((status, err) => {
          if (err) {
            console.error(
              "❌ [PARENT DASHBOARD] Realtime subscription error:",
              err
            );
          }
          // Silent subscription success - only log errors
        });
    };

    setupSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
    // Only re-run subscription when location changes (e.g., navigating between pages)
    // We use refs for callbacks and currentIncomingCall to avoid recreating subscription
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, location.pathname]);
};


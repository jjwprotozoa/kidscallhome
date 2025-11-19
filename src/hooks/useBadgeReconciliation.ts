// src/hooks/useBadgeReconciliation.ts
// Optional: Periodic reconciliation to sync badges with database
// Use this if you need multi-device sync or want to verify badge accuracy

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBadgeStore } from "@/stores/badgeStore";

interface UseBadgeReconciliationOptions {
  enabled?: boolean;
  intervalMinutes?: number; // How often to reconcile (default: 5 minutes)
}

export function useBadgeReconciliation(options: UseBadgeReconciliationOptions = {}) {
  const { enabled = false, intervalMinutes = 5 } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const reconcileBadges = async () => {
      try {
        // Check if localStorage is available
        if (typeof window === 'undefined' || !window.localStorage) {
          return;
        }
        
        const childSession = localStorage.getItem("childSession");
        const isChild = !!childSession;

        if (isChild) {
          const childData = JSON.parse(childSession);
          const childId = childData.id;

          // Fetch current unread count
          const { data: unreadMessages, error: msgError } = await supabase
            .from("messages")
            .select("child_id", { count: "exact", head: true })
            .eq("child_id", childId)
            .eq("sender_type", "parent")
            .is("read_at", null);

          if (msgError) throw msgError;

          // Fetch current missed call count
          const { data: missedCalls, error: callError } = await supabase
            .from("calls")
            .select("child_id", { count: "exact", head: true })
            .eq("child_id", childId)
            .eq("caller_type", "parent")
            .eq("missed_call", true)
            .is("missed_call_read_at", null);

          if (callError) throw callError;

          // Update store with actual counts (reconciles any drift)
          const actualUnread = unreadMessages?.length ?? 0;
          const actualMissed = missedCalls?.length ?? 0;

          useBadgeStore.getState().setInitialUnread({ [childId]: actualUnread });
          useBadgeStore.getState().setInitialMissed({ [childId]: actualMissed });
        } else {
          // Parent: reconcile all children
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: children } = await supabase
            .from("children")
            .select("id")
            .eq("parent_id", user.id);

          if (!children || children.length === 0) return;

          const childIds = children.map((c) => c.id);

          // Fetch actual counts
          const { data: unreadMessages } = await supabase
            .from("messages")
            .select("child_id")
            .in("child_id", childIds)
            .eq("sender_type", "child")
            .is("read_at", null);

          const { data: missedCalls } = await supabase
            .from("calls")
            .select("child_id")
            .in("child_id", childIds)
            .eq("caller_type", "child")
            .eq("missed_call", true)
            .is("missed_call_read_at", null);

          // Aggregate and update store
          const unreadByChild: Record<string, number> = {};
          const missedByChild: Record<string, number> = {};

          unreadMessages?.forEach((msg) => {
            unreadByChild[msg.child_id] = (unreadByChild[msg.child_id] ?? 0) + 1;
          });

          missedCalls?.forEach((call) => {
            missedByChild[call.child_id] = (missedByChild[call.child_id] ?? 0) + 1;
          });

          useBadgeStore.getState().setInitialUnread(unreadByChild);
          useBadgeStore.getState().setInitialMissed(missedByChild);
        }
      } catch (error) {
        console.error("Error reconciling badge counts:", error);
      }
    };

    // Initial reconciliation
    reconcileBadges();

    // Set up periodic reconciliation
    intervalRef.current = setInterval(
      reconcileBadges,
      intervalMinutes * 60 * 1000
    );

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, intervalMinutes]);
}


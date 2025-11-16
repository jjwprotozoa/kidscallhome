// src/hooks/useBadgeInitialization.ts
// One-time initial snapshot fetch for badge counts (called once per session)

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBadgeStore } from "@/stores/badgeStore";

export function useBadgeInitialization() {
  useEffect(() => {
    let mounted = true;

    const fetchInitialBadges = async () => {
      try {
        const childSession = localStorage.getItem("childSession");
        const isChild = !!childSession;

        if (isChild) {
          // Child: fetch their own unread messages and missed calls
          const childData = JSON.parse(childSession);
          const childId = childData.id;

          // Fetch unread messages from parent
          const { data: unreadMessages, error: msgError } = await supabase
            .from("messages")
            .select("child_id")
            .eq("child_id", childId)
            .eq("sender_type", "parent")
            .is("read_at", null);

          if (msgError) throw msgError;

          // Fetch missed calls from parent
          const { data: missedCalls, error: callError } = await supabase
            .from("calls")
            .select("child_id")
            .eq("child_id", childId)
            .eq("caller_type", "parent")
            .eq("missed_call", true)
            .is("missed_call_read_at", null);

          if (callError) throw callError;

          if (mounted) {
            // For child, we only have one "conversation" (with their parent)
            // Store it with childId as key for consistency
            const unreadCount = unreadMessages?.length ?? 0;
            const missedCount = missedCalls?.length ?? 0;

            useBadgeStore.getState().setInitialUnread({ [childId]: unreadCount });
            useBadgeStore.getState().setInitialMissed({ [childId]: missedCount });
          }
        } else {
          // Parent: fetch counts per child
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Get all children for this parent
          const { data: children, error: childrenError } = await supabase
            .from("children")
            .select("id")
            .eq("parent_id", user.id);

          if (childrenError) throw childrenError;
          if (!children || children.length === 0) return;

          const childIds = children.map((c) => c.id);

          // Fetch unread messages per child (from children to parent)
          const { data: unreadMessages, error: msgError } = await supabase
            .from("messages")
            .select("child_id")
            .in("child_id", childIds)
            .eq("sender_type", "child")
            .is("read_at", null);

          if (msgError) throw msgError;

          // Fetch missed calls per child (from children to parent)
          const { data: missedCalls, error: callError } = await supabase
            .from("calls")
            .select("child_id")
            .in("child_id", childIds)
            .eq("caller_type", "child")
            .eq("missed_call", true)
            .is("missed_call_read_at", null);

          if (callError) throw callError;

          if (mounted) {
            // Aggregate counts per child
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
        }
      } catch (error) {
        console.error("Error fetching initial badge counts:", error);
        // In production, you might want to retry or show a toast
        // For now, badges will start at 0 and populate via realtime events
      }
    };

    fetchInitialBadges();

    return () => {
      mounted = false;
    };
  }, []);
}


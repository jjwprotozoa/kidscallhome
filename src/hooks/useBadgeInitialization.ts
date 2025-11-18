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

          // Fetch unread messages from parent (read_at field doesn't exist)
          // TODO: Implement read tracking when schema is updated
          const unreadMessageCount = 0;

          // Fetch missed calls from parent (missed_call fields don't exist)
          // TODO: Implement missed call tracking when schema is updated
          const missedCallCount = 0;

          if (mounted) {
            // For child, we only have one "conversation" (with their parent)
            // Store it with childId as key for consistency
            const unreadCount = unreadMessageCount;
            const missedCount = missedCallCount;

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
          // Note: read_at field doesn't exist yet, so count will be 0
          const unreadMessages: any[] = [];

          // Fetch missed calls per child (from children to parent)
          // Note: missed_call fields don't exist yet, so count will be 0
          const missedCalls: any[] = [];

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


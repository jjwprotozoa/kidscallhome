// src/hooks/useBadgeInitialization.ts
// One-time initial snapshot fetch for badge counts (called once per session)

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBadgeStore } from "@/stores/badgeStore";
import { loadBadgeState, getLastClearedTimestamp } from "@/utils/badgeStorage";

export function useBadgeInitialization() {
  useEffect(() => {
    let mounted = true;

    const fetchInitialBadges = async () => {
      try {
        // Load cached badge state from local storage first for instant UI
        // This prevents badges from reappearing after refresh
        const cachedState = loadBadgeState();
        if (mounted && (Object.keys(cachedState.unreadMessagesByChild).length > 0 || 
                        Object.keys(cachedState.missedCallsByChild).length > 0)) {
          console.log("📦 [BADGE INIT] Loading cached badge state from local storage");
          useBadgeStore.getState().setInitialUnread(cachedState.unreadMessagesByChild);
          useBadgeStore.getState().setInitialMissed(cachedState.missedCallsByChild);
        }

        // Check if localStorage is available
        if (typeof window === 'undefined' || !window.localStorage) {
          return;
        }
        
        const { getChildSessionLegacy } = await import("@/lib/childSession");
        const childData = getChildSessionLegacy();
        const isChild = !!childData;

        if (isChild) {
          // Child: fetch their own unread messages and missed calls
          if (!childData?.id) {
            console.error("❌ [BADGE INIT] Child session missing id");
            return;
          }
          
          const childId = childData.id;

          // Get last cleared timestamps - only count NEW messages/calls
          const lastClearedMessages = getLastClearedTimestamp(childId, "messages");
          const lastClearedCalls = getLastClearedTimestamp(childId, "calls");

          // Fetch unread messages - must use conversation_id, not child_id alone
          // Get all conversation_ids for this child first
          const { data: conversations, error: convError } = await supabase
            .from("conversations")
            .select("id")
            .eq("child_id", childId);
          
          if (convError || !conversations || conversations.length === 0) {
            // No conversations, no unread messages
            return;
          }
          
          const conversationIds = conversations.map(c => c.id);
          
          // Fetch unread messages from conversations
          let messagesQuery = supabase
            .from("messages")
            .select("conversation_id, created_at")
            .in("conversation_id", conversationIds)
            .eq("sender_type", "parent")
            .is("read_at", null);

          // Only count messages created AFTER last clear timestamp
          if (lastClearedMessages) {
            messagesQuery = messagesQuery.gt("created_at", lastClearedMessages);
          }

          const { data: unreadMessages, error: msgError } = await messagesQuery;

          if (msgError) throw msgError;

          // Fetch missed calls from parent that arrived AFTER last clear
          let callsQuery = supabase
            .from("calls")
            .select("child_id, created_at")
            .eq("child_id", childId)
            .eq("caller_type", "parent")
            .eq("missed_call", true)
            .is("missed_call_read_at", null);

          // Only count calls created AFTER last clear timestamp
          if (lastClearedCalls) {
            callsQuery = callsQuery.gt("created_at", lastClearedCalls);
          }

          const { data: missedCalls, error: callError } = await callsQuery;

          if (callError) throw callError;

          if (mounted) {
            // For child, we only have one "conversation" (with their parent)
            // Store it with childId as key for consistency
            // Only count NEW messages/calls (arrived after last clear)
            const unreadCount = unreadMessages?.length ?? 0;
            const missedCount = missedCalls?.length ?? 0;

            console.log(`📦 [BADGE INIT] Child ${childId}: ${unreadCount} new unread messages, ${missedCount} new missed calls`, {
              lastClearedMessages,
              lastClearedCalls,
            });

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

          // Aggregate counts per child - only count NEW messages/calls
          const unreadByChild: Record<string, number> = {};
          const missedByChild: Record<string, number> = {};

          // Fetch unread messages per child (from children to parent)
          // Only count messages that arrived AFTER last clear timestamp
          for (const childId of childIds) {
            const lastClearedMessages = getLastClearedTimestamp(childId, "messages");
            const lastClearedCalls = getLastClearedTimestamp(childId, "calls");

            let messagesQuery = supabase
              .from("messages")
              .select("child_id, created_at")
              .eq("child_id", childId)
              .eq("sender_type", "child")
              .is("read_at", null);

            if (lastClearedMessages) {
              messagesQuery = messagesQuery.gt("created_at", lastClearedMessages);
            }

            const { data: unreadMessages } = await messagesQuery;
            unreadByChild[childId] = unreadMessages?.length ?? 0;

            let callsQuery = supabase
              .from("calls")
              .select("child_id, created_at")
              .eq("child_id", childId)
              .eq("caller_type", "child")
              .eq("missed_call", true)
              .is("missed_call_read_at", null);

            if (lastClearedCalls) {
              callsQuery = callsQuery.gt("created_at", lastClearedCalls);
            }

            const { data: missedCalls } = await callsQuery;
            missedByChild[childId] = missedCalls?.length ?? 0;
          }

          if (mounted) {
            console.log(`📦 [BADGE INIT] Parent: loaded badge counts for ${childIds.length} children`, {
              unreadByChild,
              missedByChild,
            });

            // Only show badges for NEW messages/calls (arrived after last clear)
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


// src/features/messaging/hooks/useMarkMessagesRead.ts
// Hook for marking messages as read

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBadgeStore } from "@/stores/badgeStore";
import { safeLog, sanitizeError } from "@/utils/security";

interface UseMarkMessagesReadProps {
  targetChildId: string | null;
  conversationId: string | null;
  isChild: boolean;
  isFamilyMember: boolean;
  familyMemberId: string | null;
  enabled: boolean;
}

export const useMarkMessagesRead = ({
  targetChildId,
  conversationId,
  isChild,
  isFamilyMember,
  familyMemberId,
  enabled,
}: UseMarkMessagesReadProps) => {
  useEffect(() => {
    if (!enabled || !targetChildId) return;

    const markMessagesAsRead = async () => {
      try {
        safeLog.log("📖 [CHAT READ] Starting mark as read process", {
          targetChildId,
          isChild,
          timestamp: new Date().toISOString(),
        });

        let query = supabase
          .from("messages")
          .select("id, sender_type, read_at")
          .is("read_at", null);

        if (conversationId) {
          query = query.eq("conversation_id", conversationId);
        } else {
          query = query.eq("child_id", targetChildId);
        }

        if (isChild) {
          query = query.in("sender_type", ["parent", "family_member"]);
        } else if (isFamilyMember && familyMemberId) {
          query = query.eq("sender_type", "child");
        } else {
          query = query.eq("sender_type", "child");
        }

        const { data: unreadMessages, error: fetchError } = await query;

        if (fetchError) {
          safeLog.error(
            "❌ [CHAT READ] Error fetching unread messages:",
            sanitizeError(fetchError)
          );
          return;
        }

        if (!unreadMessages || unreadMessages.length === 0) {
          safeLog.log("✅ [CHAT READ] No unread messages found");
          useBadgeStore.getState().clearUnreadForChild(targetChildId);
          return;
        }

        const unreadMessageIds = unreadMessages.map((msg) => msg.id);
        safeLog.log(
          `📖 [CHAT READ] Found ${unreadMessageIds.length} unread messages to mark as read`,
          {
            messageIds: unreadMessageIds.slice(0, 5),
            totalCount: unreadMessageIds.length,
          }
        );

        const readAt = new Date().toISOString();
        const { error } = await supabase
          .from("messages")
          .update({ read_at: readAt })
          .in("id", unreadMessageIds);

        if (error) {
          safeLog.error(
            "❌ [CHAT READ] Error marking messages as read:",
            sanitizeError(error)
          );
          return;
        }

        safeLog.log(
          `✅ [CHAT READ] Successfully marked ${unreadMessageIds.length} messages as read`,
          { readAt }
        );

        useBadgeStore.getState().clearUnreadForChild(targetChildId);
      } catch (error) {
        safeLog.error(
          "❌ [CHAT READ] Error in markMessagesAsRead:",
          sanitizeError(error)
        );
      }
    };

    markMessagesAsRead();
  }, [
    targetChildId,
    conversationId,
    isChild,
    isFamilyMember,
    familyMemberId,
    enabled,
  ]);
};












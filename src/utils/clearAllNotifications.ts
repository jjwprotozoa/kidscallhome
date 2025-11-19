// src/utils/clearAllNotifications.ts
// Purpose: Utility function to clear all notifications for parent dashboard
// Extracted from ParentDashboard.tsx to reduce complexity

import { supabase } from "@/integrations/supabase/client";
import { useBadgeStore } from "@/stores/badgeStore";

interface ClearAllNotificationsResult {
  clearedMessageCount: number;
  clearedCallCount: number;
}

/**
 * Clears all notifications (messages and missed calls) for all children
 * @param childIds Array of child IDs to clear notifications for
 * @returns Object with counts of cleared messages and calls
 */
export const clearAllNotifications = async (
  childIds: string[]
): Promise<ClearAllNotificationsResult> => {
  const { acknowledgeMissedCalls } = await import(
    "@/utils/acknowledgeMissedCalls"
  );

  // Clear all badges for all children
  const badgeStore = useBadgeStore.getState();
  let clearedMessageCount = 0;
  let clearedCallCount = 0;

  for (const childId of childIds) {
    // Mark unread messages as read in database (parent receives messages from children)
    const unreadCount = badgeStore.unreadMessagesByChild[childId] ?? 0;
    if (unreadCount > 0) {
      try {
        // Get all unread messages from this child
        const { data: unreadMessages, error: fetchError } = await supabase
          .from("messages")
          .select("id")
          .eq("child_id", childId)
          .eq("sender_type", "child")
          .is("read_at", null);

        if (!fetchError && unreadMessages && unreadMessages.length > 0) {
          const unreadMessageIds = unreadMessages.map((msg) => msg.id);
          const readAt = new Date().toISOString();

          // Mark messages as read in database
          const { error: updateError } = await supabase
            .from("messages")
            .update({ read_at: readAt } as Record<string, unknown>)
            .in("id", unreadMessageIds);

          if (!updateError) {
            clearedMessageCount += unreadMessageIds.length;
            console.log(
              `✅ Marked ${unreadMessageIds.length} messages as read for child ${childId}`
            );
          } else {
            console.error(
              `Error marking messages as read for child ${childId}:`,
              updateError
            );
          }
        }

        // Clear badge regardless of DB update success
        badgeStore.clearUnreadForChild(childId);
      } catch (error) {
        console.error(
          `Error processing messages for child ${childId}:`,
          error
        );
        // Still clear the badge locally even if DB update fails
        badgeStore.clearUnreadForChild(childId);
      }
    }

    // Acknowledge missed calls (updates database and clears badge)
    const missedCount = badgeStore.missedCallsByChild[childId] ?? 0;
    if (missedCount > 0) {
      // Clear badge immediately for instant UI feedback (before DB update)
      // This ensures the UI updates right away, even if DB is slow or out of sync
      badgeStore.clearMissedForChild(childId);
      clearedCallCount += missedCount;

      // Then update database (realtime will sync across devices)
      try {
        await acknowledgeMissedCalls(childId, "child");
      } catch (error) {
        console.error(
          `Error acknowledging missed calls for child ${childId}:`,
          error
        );
        // Badge already cleared above, so no need to clear again
      }
    }
  }

  return {
    clearedMessageCount,
    clearedCallCount,
  };
};


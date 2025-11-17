// src/utils/acknowledgeMissedCalls.ts
// Utility function to acknowledge missed calls for a child
// Updates database and clears badge immediately, broadcasts to all devices via realtime

import { supabase } from "@/integrations/supabase/client";
import { useBadgeStore } from "@/stores/badgeStore";

/**
 * Acknowledges all unread missed calls for a specific child
 * @param childId - The child ID to acknowledge missed calls for
 * @param callerType - The type of caller whose missed calls should be acknowledged ('parent' or 'child')
 * @returns Promise that resolves when acknowledgment is complete
 */
export async function acknowledgeMissedCalls(
  childId: string,
  callerType: "parent" | "child"
): Promise<void> {
  try {
    // Get all unread missed calls for this child from the specified caller type
    const { data: missedCalls, error: fetchError } = await supabase
      .from("calls")
      .select("id")
      .eq("child_id", childId)
      .eq("caller_type", callerType)
      .eq("missed_call", true)
      .is("missed_call_read_at", null);

    if (fetchError) {
      console.error("Error fetching missed calls:", fetchError);
      throw fetchError;
    }

    if (!missedCalls || missedCalls.length === 0) {
      // No missed calls to acknowledge
      return;
    }

    const missedCallIds = missedCalls.map((call) => call.id);
    const readAt = new Date().toISOString();

    // Update all missed calls as acknowledged in the database
    // This will trigger realtime UPDATE events that sync to all devices
    const { error: updateError } = await supabase
      .from("calls")
      .update({ missed_call_read_at: readAt })
      .in("id", missedCallIds);

    if (updateError) {
      console.error("Error acknowledging missed calls:", updateError);
      throw updateError;
    }

    console.log(`✅ Acknowledged ${missedCallIds.length} missed calls for child ${childId}`);

    // Note: Badge count will be updated via realtime subscription (useBadgeRealtime)
    // This ensures all devices receive the update and badge counts stay in sync
    // The realtime handler will decrement for each missed call acknowledged
  } catch (error) {
    console.error("Error in acknowledgeMissedCalls:", error);
    throw error;
  }
}


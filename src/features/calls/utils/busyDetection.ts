// src/features/calls/utils/busyDetection.ts
// Busy detection and double-dial prevention
// Prevents multiple active calls per user and detects busy state

import { supabase } from "@/integrations/supabase/client";

export interface BusyCheckResult {
  isBusy: boolean;
  activeCallId: string | null;
  reason?: string;
}

/**
 * Check if a user is already in an active call
 * Returns true if user has a call_session in connecting|connected state
 * Only considers calls that are truly active (not ended, recent)
 */
export async function checkIfBusy(
  userId: string,
  role: "parent" | "child" | "family_member"
): Promise<BusyCheckResult> {
  try {
    // Only check for calls created in the last 5 minutes (avoid stale calls)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Build query based on role
    // CRITICAL: Only check for calls in connecting|connected states (per spec)
    // A user who is ringing (waiting for answer) can still receive another call
    // Only block if they're actively in a call (connecting or connected)
    let query = supabase
      .from("calls")
      .select("id, status, caller_type, ended_at, created_at")
      .in("status", ["connecting", "active", "in_call"]) // Only truly active calls
      .is("ended_at", null) // CRITICAL: Exclude calls that are already ended
      .gte("created_at", fiveMinutesAgo); // Only check recent calls (last 5 minutes)

    if (role === "child") {
      query = query.eq("child_id", userId);
    } else if (role === "parent") {
      query = query.eq("parent_id", userId).is("family_member_id", null);
    } else {
      // family_member
      query = query.eq("family_member_id", userId);
    }

    const { data: activeCalls, error } = await query;

    if (error) {
      console.warn("⚠️ [BUSY DETECTION] Error checking for active calls:", error);
      // Don't block on error - allow call to proceed
      return { isBusy: false, activeCallId: null };
    }

    if (activeCalls && activeCalls.length > 0) {
      // Filter out any calls that might have ended_at set (defensive check)
      // Also exclude calls that are very old (likely stale) - more than 2 minutes old
      // This helps avoid false positives from calls that ended but status hasn't updated yet
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      const trulyActiveCalls = activeCalls.filter((call) => {
        // Must not be ended
        if (call.ended_at || call.status === "ended") {
          return false;
        }
        
        // For "active" status calls, only consider them busy if they were created recently
        // (within last 2 minutes). This helps avoid false positives from:
        // 1. Calls that ended but status update is delayed
        // 2. Stale calls that should have been cleaned up
        // 3. Race conditions where call just ended but status hasn't updated
        if (call.status === "active" || call.status === "in_call") {
          const callCreatedAt = new Date(call.created_at);
          const twoMinutesAgoDate = new Date(twoMinutesAgo);
          // Only consider busy if call was created within last 2 minutes
          // This is a grace period to avoid blocking on stale/ending calls
          return callCreatedAt >= twoMinutesAgoDate;
        }
        
        // For "connecting" status, always consider busy (these are actively connecting)
        return true;
      });

      if (trulyActiveCalls.length > 0) {
        const activeCall = trulyActiveCalls[0];
        console.warn("📞 [BUSY DETECTION] User is busy:", {
          userId,
          role,
          activeCallId: activeCall.id,
          status: activeCall.status,
          created_at: activeCall.created_at,
          ageSeconds: Math.round((Date.now() - new Date(activeCall.created_at).getTime()) / 1000),
        });
        return {
          isBusy: true,
          activeCallId: activeCall.id,
          reason: `User has active call in ${activeCall.status} state`,
        };
      } else {
        // Log when we filter out calls to help debug
        console.log("🔍 [BUSY DETECTION] Found calls but filtered out (likely stale/ending):", {
          userId,
          role,
          totalCalls: activeCalls.length,
          filteredCalls: activeCalls.map(c => ({
            id: c.id,
            status: c.status,
            created_at: c.created_at,
            ageSeconds: Math.round((Date.now() - new Date(c.created_at).getTime()) / 1000),
            ended_at: c.ended_at,
          })),
        });
      }
    }

    return { isBusy: false, activeCallId: null };
  } catch (error) {
    console.error("❌ [BUSY DETECTION] Exception checking busy state:", error);
    // Don't block on exception - allow call to proceed
    return { isBusy: false, activeCallId: null };
  }
}

/**
 * Check if callee is busy before initiating call
 * If busy, auto-decline with reason="busy"
 * 
 * NOTE: This is a lenient check - only blocks if callee has a truly active call
 * (not ended, recent, in active state). This prevents false positives from stale calls.
 */
export async function checkCalleeBusy(
  calleeId: string,
  calleeRole: "parent" | "child" | "family_member"
): Promise<BusyCheckResult> {
  const result = await checkIfBusy(calleeId, calleeRole);
  
  if (result.isBusy) {
    console.warn("📞 [BUSY DETECTION] Callee is busy, blocking new call:", {
      calleeId,
      calleeRole,
      activeCallId: result.activeCallId,
      reason: result.reason,
    });
  }
  
  return result;
}


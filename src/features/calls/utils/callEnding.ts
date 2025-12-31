// src/utils/callEnding.ts
// Shared idempotent call ending utility - single source of truth for ending calls

import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/utils/security";

export type EndCallBy = "parent" | "child" | "family_member";
export type EndCallReason =
  | "hangup" // User explicitly ended the call
  | "declined" // Callee rejected the call
  | "busy" // Callee is already in another call
  | "no_answer" // Ring timeout - no answer within 30s
  | "failed" // Connection failed to establish
  | "network_lost" // Connection lost during call
  | "disconnected" // Legacy: connection disconnected
  | "closed" // Legacy: connection closed
  | "disconnected_timeout" // Legacy: timeout waiting for connection
  | string; // Allow custom reasons for edge cases

/**
 * Idempotent end call mutation - both sides use the same function
 * Only flips to ended if not already ended (idempotent)
 */
export async function endCall({
  callId,
  by,
  reason = "hangup",
}: {
  callId: string;
  by: EndCallBy;
  reason?: EndCallReason;
}): Promise<{ id: string; status: string; ended_at: string | null } | null> {
  safeLog.log("🛑 [CALL LIFECYCLE] End requested", {
    callId,
    by,
    reason,
    timestamp: new Date().toISOString(),
  });

  // First, check if call is already ended (idempotent check)
  // This avoids 406 errors from .neq() filter and ensures we don't update unnecessarily
  // Use a simple query to avoid any potential issues with column selection
  let existingCall: {
    id: string;
    status: string;
    ended_at: string | null;
  } | null = null;
  try {
    const { data, error: checkError } = await supabase
      .from("calls")
      .select("id, status, ended_at")
      .eq("id", callId)
      .maybeSingle();

    if (checkError) {
      safeLog.warn(
        "⚠️ [CALL LIFECYCLE] Error checking call status (will continue):",
        checkError
      );
      // Continue anyway - might be a transient error or column doesn't exist yet
    } else {
      existingCall = data;
    }
  } catch (err) {
    // If query fails completely, continue with update attempt
    safeLog.warn(
      "⚠️ [CALL LIFECYCLE] Exception checking call status (will continue):",
      err
    );
  }

  // If call is already ended, return existing data (idempotent)
  if (
    existingCall &&
    (existingCall.status === "ended" || existingCall.ended_at)
  ) {
    safeLog.log("✅ [CALL LIFECYCLE] Call already ended (idempotent)", {
      callId,
      status: existingCall.status,
      ended_at: existingCall.ended_at,
    });
    return existingCall;
  }

  // Try with new columns first (if migration has run)
  let data: {
    id: string;
    status: string;
    ended_at: string | null;
    ended_by?: string;
    end_reason?: string;
  } | null = null;
  let error: { code?: string; message?: string } | null = null;

  const updateWithNewColumns = {
    status: "ended",
    ended_at: new Date().toISOString(),
    ended_by: by,
    end_reason: reason,
  };

  // Update without .neq() filter to avoid 406 errors
  // We've already checked that the call isn't ended above
  const { data: newData, error: newError } = await supabase
    .from("calls")
    .update(updateWithNewColumns)
    .eq("id", callId)
    .select("id, status, ended_at, ended_by, end_reason")
    .single();

  data = newData as unknown as {
    id: string;
    status: string;
    ended_at: string | null;
    ended_by?: string;
    end_reason?: string;
  } | null;
  error = newError as { code?: string; message?: string } | null;

  // If schema cache error or 406 (columns don't exist yet or format issue), try fallback
  if (
    error &&
    (error.code === "PGRST204" ||
      error.code === "406" ||
      error.message?.includes("end_reason") ||
      error.message?.includes("ended_by") ||
      error.message?.includes("ended_at") ||
      error.message?.includes("Not Acceptable"))
  ) {
    safeLog.warn(
      "⚠️ [CALL LIFECYCLE] Update failed (possibly schema issue), trying fallback",
      {
        callId,
        errorCode: error.code,
        errorMessage: error.message,
      }
    );

    // Try to ensure columns exist via RPC function
    let ensureError: { message?: string } | null = null;
    try {
      // RPC function may not exist in type definitions yet - using type assertion
      const { error: rpcError } = await (
        supabase.rpc as unknown as (
          name: string
        ) => Promise<{ error: { message?: string } | null }>
      )("ensure_call_ending_columns");
      ensureError = rpcError;
    } catch (rpcErr) {
      // RPC might not exist yet - that's OK, we'll fall back
      ensureError = { message: "RPC function not available" };
    }

    if (!ensureError) {
      safeLog.log("✅ [CALL LIFECYCLE] Columns created, retrying update", {
        callId,
      });
      // Retry the original update now that columns exist (without .neq() filter)
      const { data: retryData, error: retryError } = await supabase
        .from("calls")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          ended_by: by,
          end_reason: reason,
        })
        .eq("id", callId)
        .select("id, status, ended_at, ended_by, end_reason")
        .single();

      if (!retryError) {
        data = retryData as unknown as {
          id: string;
          status: string;
          ended_at: string | null;
          ended_by?: string;
          end_reason?: string;
        } | null;
        error = null;
        safeLog.log(
          "✅ [CALL LIFECYCLE] Call ended successfully after creating columns",
          { callId }
        );
      } else {
        // If retry still fails, fall through to basic update
        error = retryError;
      }
    }

    // If column creation failed or retry failed, fall back to basic update
    if (error) {
      safeLog.warn(
        "⚠️ [CALL LIFECYCLE] Column creation failed or retry failed, falling back to basic update",
        { callId }
      );

      // Fallback: just update status (without .neq() filter to avoid 406)
      // We've already checked that the call isn't ended above
      const { data: simpleData, error: simpleError } = await supabase
        .from("calls")
        .update({ status: "ended" })
        .eq("id", callId)
        .select("id, status")
        .single();

      if (!simpleError) {
        data = {
          ...simpleData,
          ended_at: null,
        };
        error = null;
        safeLog.log(
          "✅ [CALL LIFECYCLE] Call ended with simple update (columns not available)",
          { callId }
        );
      } else {
        // If update fails, check if call is already ended (idempotent)
        const { data: checkData } = await supabase
          .from("calls")
          .select("id, status")
          .eq("id", callId)
          .maybeSingle();

        if (checkData?.status === "ended") {
          // Call already ended - that's OK (idempotent)
          data = {
            ...checkData,
            ended_at: null,
          };
          error = null;
          safeLog.log("✅ [CALL LIFECYCLE] Call already ended (idempotent)", {
            callId,
          });
        } else {
          // Real error - log it but don't throw (call might still work)
          safeLog.warn(
            "⚠️ [CALL LIFECYCLE] Fallback update failed, but continuing",
            {
              callId,
              error: simpleError,
              currentStatus: checkData?.status,
            }
          );
          // Return null to indicate update didn't work, but don't throw
          return null;
        }
      }
    }
  }

  // Increment version separately (if RPC exists)
  if (!error && data) {
    try {
      // RPC function may not exist in type definitions yet - using type assertion
      await (
        supabase.rpc as unknown as (
          name: string,
          args?: Record<string, unknown>
        ) => Promise<unknown>
      )("increment_call_version", {
        call_id: callId,
      });
    } catch (rpcErr) {
      // RPC might not exist yet - that's OK, version is optional
      safeLog.log(
        "ℹ️ [CALL LIFECYCLE] Version increment RPC not available (optional)",
        { callId }
      );
    }
  }

  if (error) {
    // If it's a "no rows updated" error, the call might already be ended - that's OK (idempotent)
    if (error.code === "PGRST116" || error.message?.includes("No rows")) {
      safeLog.log(
        "✅ [CALL LIFECYCLE] No rows updated - call may already be ended (idempotent)",
        { callId }
      );
      // Try to fetch the current state to return it
      const { data: existingCall } = await supabase
        .from("calls")
        .select("id, status, ended_at")
        .eq("id", callId)
        .maybeSingle();
      return existingCall as {
        id: string;
        status: string;
        ended_at: string | null;
      } | null;
    }

    // For 406 errors or other issues, try one more time with just status update
    if (error.code === "406" || error.message?.includes("Not Acceptable")) {
      safeLog.warn(
        "⚠️ [CALL LIFECYCLE] 406 error detected, trying simple status update",
        { callId }
      );
      const { data: simpleData, error: simpleError } = await supabase
        .from("calls")
        .update({ status: "ended" })
        .eq("id", callId)
        .select("id, status")
        .single();

      if (!simpleError && simpleData) {
        safeLog.log(
          "✅ [CALL LIFECYCLE] Call ended with simple status update",
          { callId }
        );
        return {
          ...simpleData,
          ended_at: null,
        };
      }
    }

    safeLog.error("❌ [CALL LIFECYCLE] Error ending call:", error);
    // Don't throw - return null so caller can handle gracefully
    // The child side will detect the disconnect via ICE state changes
    return null;
  }

  if (data) {
    safeLog.log("✅ [CALL LIFECYCLE] Call ended successfully", {
      callId: data.id,
      status: data.status,
      ended_at: data.ended_at,
      ended_by: data.ended_by,
      end_reason: data.end_reason,
    });
  }

  return data;
}

/**
 * Check if a call is in a terminal state
 */
export function isCallTerminal(call: {
  status?: string;
  ended_at?: string | null;
}): boolean {
  return call.status === "ended" || !!call.ended_at;
}

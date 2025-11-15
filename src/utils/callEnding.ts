// src/utils/callEnding.ts
// Shared idempotent call ending utility - single source of truth for ending calls

import { supabase } from "@/integrations/supabase/client";
import { callLog } from "@/features/calls/utils/callLogger";

export type EndCallBy = 'parent' | 'child';
export type EndCallReason = 'hangup' | 'disconnected' | 'failed' | 'closed' | string;

/**
 * Idempotent end call mutation - both sides use the same function
 * Only flips to ended if not already ended (idempotent)
 */
export async function endCall({
  callId,
  by,
  reason = 'hangup',
}: {
  callId: string;
  by: EndCallBy;
  reason?: EndCallReason;
}): Promise<{ id: string; status: string; ended_at: string | null } | null> {
  callLog.debug("LIFECYCLE", "End requested", {
    callId,
    by,
    reason,
    timestamp: new Date().toISOString(),
  });

  // First, check if call is already ended (idempotent check)
  // This avoids 406 errors from .neq() filter and ensures we don't update unnecessarily
  // Use a simple query to avoid any potential issues with column selection
  let existingCall: any = null;
  try {
    const { data, error: checkError } = await supabase
      .from('calls')
      .select('id, status, ended_at')
      .eq('id', callId)
      .maybeSingle();
    
    if (checkError) {
      callLog.warn("LIFECYCLE", "Error checking call status (will continue)", checkError);
      // Continue anyway - might be a transient error or column doesn't exist yet
    } else {
      existingCall = data;
    }
  } catch (err) {
    // If query fails completely, continue with update attempt
    callLog.warn("LIFECYCLE", "Exception checking call status (will continue)", err);
  }
  
  // If call is already ended, return existing data (idempotent)
  if (existingCall && (existingCall.status === 'ended' || existingCall.ended_at)) {
    callLog.debug("LIFECYCLE", "Call already ended (idempotent)", {
      callId,
      status: existingCall.status,
      ended_at: existingCall.ended_at,
    });
    return existingCall;
  }
  
  // Try with new columns first (if migration has run)
  let data: any = null;
  let error: any = null;
  
  const updateWithNewColumns = {
    status: 'ended',
    ended_at: new Date().toISOString(),
    ended_by: by,
    end_reason: reason,
  };
  
  // Update without .neq() filter to avoid 406 errors
  // We've already checked that the call isn't ended above
  const { data: newData, error: newError } = await supabase
    .from('calls')
    .update(updateWithNewColumns)
    .eq('id', callId)
    .select('id, status, ended_at, ended_by, end_reason')
    .single();
  
  data = newData;
  error = newError;

  // If schema cache error or 406 (columns don't exist yet or format issue), try fallback
  if (error && (error.code === 'PGRST204' || error.code === '406' || error.message?.includes('end_reason') || error.message?.includes('ended_by') || error.message?.includes('ended_at') || error.message?.includes('Not Acceptable'))) {
    callLog.warn("LIFECYCLE", "Update failed (possibly schema issue), trying fallback", { 
      callId, 
      errorCode: error.code,
      errorMessage: error.message 
    });
    
    // Try to ensure columns exist via RPC function
    let ensureError = null;
    try {
      const { error: rpcError } = await supabase.rpc('ensure_call_ending_columns');
      ensureError = rpcError;
    } catch (rpcErr) {
      // RPC might not exist yet - that's OK, we'll fall back
      ensureError = { message: 'RPC function not available' };
    }
    
    if (!ensureError) {
      callLog.debug("LIFECYCLE", "Columns created, retrying update", { callId });
      // Retry the original update now that columns exist (without .neq() filter)
      const { data: retryData, error: retryError } = await supabase
        .from('calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          ended_by: by,
          end_reason: reason,
        })
        .eq('id', callId)
        .select('id, status, ended_at, ended_by, end_reason')
        .single();
      
      if (!retryError) {
        data = retryData;
        error = null;
        callLog.debug("LIFECYCLE", "Call ended successfully after creating columns", { callId });
      } else {
        // If retry still fails, fall through to basic update
        error = retryError;
      }
    }
    
    // If column creation failed or retry failed, fall back to basic update
    if (error) {
      callLog.warn("LIFECYCLE", "Column creation failed or retry failed, falling back to basic update", { callId });
      
      // Fallback: just update status (without .neq() filter to avoid 406)
      // We've already checked that the call isn't ended above
      const { data: simpleData, error: simpleError } = await supabase
        .from('calls')
        .update({ status: 'ended' })
        .eq('id', callId)
        .select('id, status')
        .single();
      
      if (!simpleError) {
        data = simpleData;
        error = null;
        callLog.debug("LIFECYCLE", "Call ended with simple update (columns not available)", { callId });
      } else {
        // If update fails, check if call is already ended (idempotent)
        const { data: checkData } = await supabase
          .from('calls')
          .select('id, status')
          .eq('id', callId)
          .maybeSingle();
        
        if (checkData?.status === 'ended') {
          // Call already ended - that's OK (idempotent)
          data = checkData;
          error = null;
          callLog.debug("LIFECYCLE", "Call already ended (idempotent)", { callId });
        } else {
          // Real error - log it but don't throw (call might still work)
          callLog.warn("LIFECYCLE", "Fallback update failed, but continuing", { 
            callId, 
            error: simpleError,
            currentStatus: checkData?.status 
          });
          // Return null to indicate update didn't work, but don't throw
          return null;
        }
      }
    }
  }

  // Increment version separately (if RPC exists)
  if (!error && data) {
    try {
      const rpcResult = supabase.rpc('increment_call_version', { call_id: callId });
      // Check if it's a promise before calling .catch
      if (rpcResult && typeof rpcResult.catch === 'function') {
        await rpcResult.catch(() => {
          // RPC might not exist yet - that's OK, version is optional
        });
      }
    } catch (rpcErr) {
      // RPC might not exist yet - that's OK, version is optional
      callLog.debug("LIFECYCLE", "Version increment RPC not available (optional)", { callId });
    }
  }

  if (error) {
    // If it's a "no rows updated" error, the call might already be ended - that's OK (idempotent)
    if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
      callLog.debug("LIFECYCLE", "No rows updated - call may already be ended (idempotent)", { callId });
      // Try to fetch the current state to return it
      const { data: existingCall } = await supabase
        .from('calls')
        .select('id, status, ended_at')
        .eq('id', callId)
        .maybeSingle();
      return existingCall;
    }
    
    // For 406 errors or other issues, try one more time with just status update
    if (error.code === '406' || error.message?.includes('Not Acceptable')) {
      callLog.warn("LIFECYCLE", "406 error detected, trying simple status update", { callId });
      const { data: simpleData, error: simpleError } = await supabase
        .from('calls')
        .update({ status: 'ended' })
        .eq('id', callId)
        .select('id, status')
        .single();
      
      if (!simpleError && simpleData) {
        callLog.debug("LIFECYCLE", "Call ended with simple status update", { callId });
        return simpleData;
      }
    }
    
    callLog.error("LIFECYCLE", "Error ending call", error);
    // Don't throw - return null so caller can handle gracefully
    // The child side will detect the disconnect via ICE state changes
    return null;
  }

  if (data) {
    callLog.debug("LIFECYCLE", "Call ended successfully", {
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
export function isCallTerminal(call: { status?: string; ended_at?: string | null }): boolean {
  return call.status === 'ended' || !!call.ended_at;
}


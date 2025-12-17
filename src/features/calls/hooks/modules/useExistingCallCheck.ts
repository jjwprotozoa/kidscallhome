// src/features/calls/hooks/modules/useExistingCallCheck.ts
// Check for existing incoming calls from URL parameters
// Handles direct navigation with callId in URL

import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import type { CallState } from "./useCallStateMachine";

export interface UseExistingCallCheckParams {
  state: CallState;
  localProfileId: string;
  role: "parent" | "child" | "family_member";
  callId: string | null;
  setCallId: (callId: string) => void;
  setStateWithLogging: (
    newState: CallState,
    reason: string,
    context?: Record<string, unknown>
  ) => void;
}

export const useExistingCallCheck = ({
  state,
  localProfileId,
  role,
  callId,
  setCallId,
  setStateWithLogging,
}: UseExistingCallCheckParams) => {
  useEffect(() => {
    if (state !== "idle" || !localProfileId || callId) return;

    // Check if there's a callId in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlCallId = urlParams.get("callId");
    if (!urlCallId) return;

    // Check if this is an existing incoming call
    const checkExistingCall = async () => {
      try {
        const { data: call, error } = await supabase
          .from("calls")
          .select("*")
          .eq("id", urlCallId)
          .single();

        if (error || !call) return;

        // Verify this is an incoming call for this user
        // CRITICAL: Handle family member calls correctly
        let isIncomingCall = false;
        if (role === "child") {
          // Child receives calls from parent OR family member
          isIncomingCall =
            call.status === "ringing" &&
            (call.caller_type === "parent" ||
              call.caller_type === "family_member") &&
            call.child_id === localProfileId &&
            !!call.offer;
        } else if (role === "family_member") {
          // Family member receives calls from child
          isIncomingCall =
            call.status === "ringing" &&
            call.caller_type === "child" &&
            call.family_member_id === localProfileId &&
            !!call.offer;
        } else if (role === "parent") {
          // Parent receives calls from child
          isIncomingCall =
            call.status === "ringing" &&
            call.caller_type === "child" &&
            call.parent_id === localProfileId &&
            !!call.offer;
        }

        if (isIncomingCall) {
          console.warn(
            "📞 [EXISTING CALL CHECK] Found existing incoming call from URL:",
            urlCallId
          );
          setCallId(call.id);
          setStateWithLogging("incoming", "Incoming call detected from URL", {
            callId: call.id,
            callerType: call.caller_type,
          });
        }
      } catch (error) {
        console.error("Error checking existing call:", error);
      }
    };

    // Small delay to ensure component is fully mounted
    const timeoutId = setTimeout(checkExistingCall, 100);
    return () => clearTimeout(timeoutId);
  }, [state, localProfileId, role, callId, setStateWithLogging, setCallId]);
};


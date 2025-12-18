// src/features/calls/hooks/modules/useExistingCallCheck.ts
// Check for existing incoming calls from URL parameters
// Handles direct navigation with callId in URL

import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
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
  // Use React Router's useSearchParams for reliable URL parameter reading
  const [searchParams] = useSearchParams();
  const urlCallId = searchParams.get("callId");
  
  // Track if we've already processed this callId to prevent duplicate attempts
  const processedCallIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    // CRITICAL: Only check when idle and we have a localProfileId
    // But also check when callId is null (not yet set) to detect incoming calls from URL
    if (state !== "idle" || !localProfileId) {
      console.log("📞 [EXISTING CALL CHECK] Skipping check:", {
        state,
        hasLocalProfileId: !!localProfileId,
        hasCallId: !!callId,
        urlCallId,
      });
      return;
    }

    // If callId is already set, don't check again
    if (callId) {
      console.log("📞 [EXISTING CALL CHECK] CallId already set, skipping:", callId);
      return;
    }

    // Check if there's a callId in the URL (from React Router, not window.location)
    if (!urlCallId) {
      console.log("📞 [EXISTING CALL CHECK] No callId in URL");
      return;
    }
    
    // Prevent duplicate processing of the same callId
    if (processedCallIdRef.current === urlCallId) {
      console.log("📞 [EXISTING CALL CHECK] Already processed callId:", urlCallId);
      return;
    }

    console.log("📞 [EXISTING CALL CHECK] Checking for incoming call from URL:", {
      urlCallId,
      localProfileId,
      role,
      state,
    });

    // Check if this is an existing incoming call
    const checkExistingCall = async () => {
      try {
        const { data: call, error } = await supabase
          .from("calls")
          .select("*")
          .eq("id", urlCallId)
          .single();

        if (error) {
          console.error("📞 [EXISTING CALL CHECK] Error fetching call:", error);
          return;
        }

        if (!call) {
          console.log("📞 [EXISTING CALL CHECK] Call not found:", urlCallId);
          return;
        }

        console.log("📞 [EXISTING CALL CHECK] Call found:", {
          callId: call.id,
          status: call.status,
          caller_type: call.caller_type,
          parent_id: call.parent_id,
          family_member_id: call.family_member_id,
          child_id: call.child_id,
          hasOffer: !!call.offer,
          localProfileId,
          role,
        });

        // Verify this is an incoming call for this user
        // CRITICAL: Handle family member calls correctly
        // CRITICAL: Accept both "ringing" and "active" status - the call might have been
        // accepted on another device or the status might change while we're navigating
        const isValidStatus = call.status === "ringing" || call.status === "active";
        let isIncomingCall = false;
        if (role === "child") {
          // Child receives calls from parent OR family member
          isIncomingCall =
            isValidStatus &&
            (call.caller_type === "parent" ||
              call.caller_type === "family_member") &&
            call.child_id === localProfileId &&
            !!call.offer;
        } else if (role === "family_member") {
          // Family member receives calls from child
          isIncomingCall =
            isValidStatus &&
            call.caller_type === "child" &&
            call.family_member_id === localProfileId &&
            !!call.offer;
        } else if (role === "parent") {
          // Parent receives calls from child
          isIncomingCall =
            isValidStatus &&
            call.caller_type === "child" &&
            call.parent_id === localProfileId &&
            !!call.offer;
        }

        console.log("📞 [EXISTING CALL CHECK] Validation result:", {
          isIncomingCall,
          status: call.status,
          caller_type: call.caller_type,
          role,
          idMatches:
            role === "child"
              ? call.child_id === localProfileId
              : role === "family_member"
              ? call.family_member_id === localProfileId
              : call.parent_id === localProfileId,
          hasOffer: !!call.offer,
        });

        if (isIncomingCall) {
          console.warn(
            "✅ [EXISTING CALL CHECK] Found existing incoming call from URL:",
            urlCallId
          );
          // Mark as processed to prevent duplicate attempts
          processedCallIdRef.current = urlCallId;
          setCallId(call.id);
          setStateWithLogging("incoming", "Incoming call detected from URL", {
            callId: call.id,
            callerType: call.caller_type,
          });
        } else {
          console.warn(
            "⚠️ [EXISTING CALL CHECK] Call found but not a valid incoming call:",
            {
              urlCallId,
              status: call.status,
              caller_type: call.caller_type,
              role,
              idMatches:
                role === "child"
                  ? call.child_id === localProfileId
                  : role === "family_member"
                  ? call.family_member_id === localProfileId
                  : call.parent_id === localProfileId,
              hasOffer: !!call.offer,
            }
          );
        }
      } catch (error) {
        console.error("❌ [EXISTING CALL CHECK] Error checking existing call:", error);
      }
    };

    // Small delay to ensure component is fully mounted
    const timeoutId = setTimeout(checkExistingCall, 100);
    return () => clearTimeout(timeoutId);
  }, [state, localProfileId, role, callId, urlCallId, setStateWithLogging, setCallId]);
};


// src/features/calls/hooks/modules/handlers/childIncomingCallHandler.ts
// Child receiving incoming call handler
// Handles child receiving calls from parent OR family_member

import { supabase } from "@/integrations/supabase/client";

export interface ChildIncomingCallParams {
  callId: string;
  localProfileId: string; // child_id
}

export interface ChildIncomingCallValidation {
  isValid: boolean;
  call: Record<string, unknown> | null;
  reason?: string;
}

export const validateChildIncomingCall = async ({
  callId,
  localProfileId,
}: ChildIncomingCallParams): Promise<ChildIncomingCallValidation> => {
  const { data: call, error } = await supabase
    .from("calls")
    .select("*")
    .eq("id", callId)
    .single();

  if (error || !call) {
    return {
      isValid: false,
      call: null,
      reason: "Call not found",
    };
  }

  // Child receives calls from parent OR family_member
  const callerTypeMatches =
    call.caller_type === "parent" || call.caller_type === "family_member";
  const idMatches = !localProfileId || call.child_id === localProfileId;
  const hasOffer = !!call.offer;
  const isRinging = call.status === "ringing";

  const isValid = isRinging && callerTypeMatches && hasOffer && idMatches;

  if (!isValid) {
    return {
      isValid: false,
      call,
      reason: "Not a valid incoming call for child",
    };
  }

  return { isValid: true, call };
};

// src/features/calls/hooks/modules/handlers/adultIncomingCallHandler.ts
// Parent/family_member receiving incoming call handler
// Works the same for both parent and family_member roles

import { supabase } from "@/integrations/supabase/client";

export interface AdultIncomingCallParams {
  role: "parent" | "family_member";
  callId: string;
  localProfileId: string; // parent_id or family_member_id (user_id)
}

export interface AdultIncomingCallValidation {
  isValid: boolean;
  call: Record<string, unknown> | null;
  reason?: string;
}

export const validateAdultIncomingCall = async ({
  role,
  callId,
  localProfileId,
}: AdultIncomingCallParams): Promise<AdultIncomingCallValidation> => {
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

  // Parent/family_member receives calls from child
  const callerTypeMatches = call.caller_type === "child";
  const hasOffer = !!call.offer;
  const isRinging = call.status === "ringing";

  // Check ID match based on role
  let idMatches = true; // Default to true if localProfileId is empty
  if (localProfileId) {
    if (role === "parent") {
      idMatches = call.parent_id === localProfileId;
    } else {
      // family_member
      idMatches = call.family_member_id === localProfileId;
    }
  }

  const isValid = isRinging && callerTypeMatches && hasOffer && idMatches;

  if (!isValid) {
    return {
      isValid: false,
      call,
      reason: `Not a valid incoming call for ${role}`,
    };
  }

  return { isValid: true, call };
};

// src/features/calls/hooks/modules/handlers/childOutgoingCallHandler.ts
// Child-initiated outgoing call handler
// Handles child calling parent OR family_member

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { checkCalleeBusy } from "../../../utils/busyDetection";

export interface ChildOutgoingCallParams {
  localProfileId: string; // child_id
  remoteId: string; // parent_id or family_member_id (user_id)
  offer: RTCSessionDescriptionInit;
}

export interface ChildOutgoingCallResult {
  callId: string;
  recipientType: "parent" | "family_member";
  recipientId: string;
}

export const handleChildOutgoingCall = async ({
  localProfileId,
  remoteId,
  offer,
}: ChildOutgoingCallParams): Promise<ChildOutgoingCallResult> => {
  // Edge case: Check if callee is busy (has active call)
  // Determine callee role based on recipient type detection below
  // For now, check both parent and family_member roles
  const parentBusyCheck = await checkCalleeBusy(remoteId, "parent");
  const familyMemberBusyCheck = await checkCalleeBusy(remoteId, "family_member");
  
  if (parentBusyCheck.isBusy || familyMemberBusyCheck.isBusy) {
    const busyCheck = parentBusyCheck.isBusy ? parentBusyCheck : familyMemberBusyCheck;
    console.warn("📞 [CHILD OUTGOING] Callee is busy, cannot initiate call:", {
      remoteId,
      activeCallId: busyCheck.activeCallId,
      reason: busyCheck.reason,
    });
    throw new Error("User is busy in another call");
  }

  // Step A: Create call_session with state=initiating
  const callData: Record<string, unknown> = {
    caller_type: "child",
    child_id: localProfileId,
    status: "initiating", // Start with initiating, will transition to ringing
    offer: { type: offer.type, sdp: offer.sdp } as Json,
    ended_at: null,
  };

  console.warn("🔍 [CHILD OUTGOING] Detecting recipient type:", {
    remoteId,
    localProfileId,
    timestamp: new Date().toISOString(),
  });

  // Always detect from database - don't rely on localStorage
  // Check adult_profiles first (canonical source for new system)
  let adultProfile: {
    role: string;
    user_id: string;
    id: string;
  } | null = null;
  let profileError: unknown = null;

  // First try: assume remoteId is user_id (auth.users.id) - this is the correct case
  const { data: profileByUserId, error: errorByUserId } =
    (await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("adult_profiles")
      .select("role, user_id, id")
      .eq("user_id", remoteId)
      .maybeSingle()) as {
      data: { role: string; user_id: string; id: string } | null;
      error: unknown;
    };

  if (profileByUserId) {
    adultProfile = profileByUserId;
  } else {
    // Second try: remoteId might be adult_profiles.id (fallback case from conversations)
    const { data: profileById, error: errorById } =
      (await // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("adult_profiles")
        .select("role, user_id, id")
        .eq("id", remoteId)
        .maybeSingle()) as {
        data: { role: string; user_id: string; id: string } | null;
        error: unknown;
      };

    if (profileById) {
      adultProfile = profileById;
      console.warn(
        "⚠️ [CHILD OUTGOING] remoteId was adult_profiles.id, not user_id. Using profile:",
        {
          remoteId,
          user_id: profileById.user_id,
          adult_profile_id: profileById.id,
        }
      );
    } else {
      profileError = errorByUserId || errorById;
    }
  }

  console.warn("🔍 [CHILD OUTGOING] Adult profile lookup result:", {
    found: !!adultProfile,
    role: adultProfile?.role,
    userId: adultProfile?.user_id,
    error: profileError,
  });

  // CRITICAL: Use selectedParticipantType from localStorage as a hint
  const storedParticipantType = localStorage.getItem(
    "selectedParticipantType"
  ) as "parent" | "family_member" | null;

  let isFamilyMember = false;

  if (adultProfile?.role === "family_member") {
    isFamilyMember = true;
    console.warn(
      "✅ [CHILD OUTGOING] Detected FAMILY MEMBER recipient (from adult_profiles)"
    );
  } else if (adultProfile?.role === "parent") {
    isFamilyMember = false;
    console.warn(
      "✅ [CHILD OUTGOING] Detected PARENT recipient (from adult_profiles)"
    );
  } else if (storedParticipantType === "family_member") {
    isFamilyMember = true;
    console.warn(
      "✅ [CHILD OUTGOING] Using FAMILY MEMBER from localStorage (database lookup failed)"
    );
  } else if (storedParticipantType === "parent") {
    isFamilyMember = false;
    console.warn(
      "✅ [CHILD OUTGOING] Using PARENT from localStorage (database lookup failed)"
    );
  } else {
    // Fallback: Check family_members table (legacy system)
    const { data: familyMember } = await supabase
      .from("family_members")
      .select("id")
      .eq("id", remoteId)
      .maybeSingle();

    if (familyMember) {
      isFamilyMember = true;
      console.warn(
        "✅ [CHILD OUTGOING] Detected FAMILY MEMBER recipient (legacy table)"
      );
    } else {
      console.warn(
        "✅ [CHILD OUTGOING] Assuming PARENT recipient (no family member found)"
      );
    }
  }

  // CRITICAL: Use user_id from adultProfile, not remoteId (which might be adult_profiles.id)
  const actualUserId = adultProfile?.user_id || remoteId;

  if (isFamilyMember) {
    // Child calling family member
    callData.family_member_id = actualUserId;
    callData.recipient_type = "family_member";

    console.warn("📞 [CHILD OUTGOING] Child calling FAMILY MEMBER:", {
      child_id: callData.child_id,
      family_member_id: callData.family_member_id,
      caller_type: callData.caller_type,
      recipient_type: callData.recipient_type,
      remoteId,
      actualUserId,
    });

    // Also need parent_id - get from child's parent_id (for RLS compatibility)
    const { data: childData } = await supabase
      .from("children")
      .select("parent_id")
      .eq("id", localProfileId)
      .maybeSingle();

    if (childData?.parent_id) {
      callData.parent_id = childData.parent_id;
      console.warn(
        "✅ [CHILD OUTGOING] Added parent_id for RLS compatibility:",
        childData.parent_id
      );
    } else {
      console.warn(
        "⚠️ [CHILD OUTGOING] Could not find parent_id for child - RLS might fail"
      );
    }

    const { data: call, error } = await supabase
      .from("calls")
      .insert(callData)
      .select()
      .single();

    if (error) throw error;
    if (!call) throw new Error("Failed to create call");

    // Step A: Update status to ringing after creation (caller UI shows "Calling...")
    await supabase
      .from("calls")
      .update({ status: "ringing" })
      .eq("id", call.id);

    return {
      callId: call.id,
      recipientType: "family_member",
      recipientId: actualUserId,
    };
  } else {
    // Child calling parent
    callData.parent_id = actualUserId;
    callData.recipient_type = "parent";

    console.warn("📞 [CHILD OUTGOING] Child calling PARENT:", {
      child_id: callData.child_id,
      parent_id: callData.parent_id,
      caller_type: callData.caller_type,
      recipient_type: callData.recipient_type,
      remoteId,
      actualUserId,
    });

    const { data: call, error } = await supabase
      .from("calls")
      .insert(callData)
      .select()
      .single();

    if (error) throw error;
    if (!call) throw new Error("Failed to create call");

    // Step A: Update status to ringing after creation (caller UI shows "Calling...")
    await supabase
      .from("calls")
      .update({ status: "ringing" })
      .eq("id", call.id);

    return {
      callId: call.id,
      recipientType: "parent",
      recipientId: actualUserId,
    };
  }
};

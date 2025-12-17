// src/features/calls/hooks/modules/handlers/adultOutgoingCallHandler.ts
// Parent/family_member-initiated outgoing call handler
// Works the same for both parent and family_member roles

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface AdultOutgoingCallParams {
  role: "parent" | "family_member";
  localProfileId: string; // parent_id or family_member_id (user_id)
  remoteId: string; // child_id
  offer: RTCSessionDescriptionInit;
}

export interface AdultOutgoingCallResult {
  callId: string;
}

export const handleAdultOutgoingCall = async ({
  role,
  localProfileId,
  remoteId,
  offer,
}: AdultOutgoingCallParams): Promise<AdultOutgoingCallResult> => {
  const callData: Record<string, unknown> = {
    caller_type: role,
    child_id: remoteId,
    status: "ringing",
    offer: { type: offer.type, sdp: offer.sdp } as Json,
    ended_at: null,
    recipient_type: "child", // CRITICAL: Set recipient_type for Realtime filtering
  };

  // Set IDs based on role - both parent and family_member work the same way
  if (role === "parent") {
    callData.parent_id = localProfileId;
  } else {
    // family_member - same pattern as parent
    callData.family_member_id = localProfileId;
    // Also need parent_id for the call (for RLS compatibility)
    // Try to get parent_id from children table first (legacy)
    let parentId: string | null = null;
    const { data: childData } = await supabase
      .from("children")
      .select("parent_id")
      .eq("id", remoteId)
      .maybeSingle();

    if (childData?.parent_id) {
      parentId = childData.parent_id;
      console.warn(
        `📞 [${role.toUpperCase()} OUTGOING] Found parent_id from children table:`,
        parentId
      );
    }

    if (parentId) {
      callData.parent_id = parentId;
    } else {
      console.warn(
        `⚠️ [${role.toUpperCase()} OUTGOING] Could not find parent_id for family member call`
      );
    }
  }

  console.warn(`📞 [${role.toUpperCase()} OUTGOING] Creating call:`, {
    caller_type: role,
    child_id: remoteId,
    [role === "parent" ? "parent_id" : "family_member_id"]: localProfileId,
    recipient_type: "child",
  });

  const { data: call, error } = await supabase
    .from("calls")
    .insert(callData)
    .select()
    .single();

  if (error) {
    console.error(`❌ [${role.toUpperCase()} OUTGOING] Error creating call:`, {
      error,
      callData,
    });
    throw error;
  }
  if (!call) throw new Error("Failed to create call");

  return { callId: call.id };
};

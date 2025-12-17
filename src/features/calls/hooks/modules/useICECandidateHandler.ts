// src/features/calls/hooks/modules/useICECandidateHandler.ts
// ICE candidate handling for outgoing calls
// Works for all roles (child, parent, family_member)

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { RTCIceCandidateInit } from "react-native-webrtc";

export interface UseICECandidateHandlerParams {
  callId: string;
  role: "parent" | "child" | "family_member";
  peerConnection: RTCPeerConnection;
}

export const useICECandidateHandler = ({
  callId,
  role,
  peerConnection,
}: UseICECandidateHandlerParams) => {
  // Set up ICE candidate handling
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate && callId) {
      // Family members use parent_ice_candidates (they're calling like parents)
      const candidateField =
        role === "parent" || role === "family_member"
          ? "parent_ice_candidates"
          : "child_ice_candidates";

      const { data: currentCall } = await supabase
        .from("calls")
        .select(candidateField)
        .eq("id", callId)
        .single();

      const existingCandidates =
        (currentCall?.[candidateField] as RTCIceCandidateInit[]) || [];
      const updatedCandidates = [
        ...existingCandidates,
        event.candidate.toJSON(),
      ];

      await supabase
        .from("calls")
        .update({ [candidateField]: updatedCandidates as Json })
        .eq("id", callId);
    }
  };
};


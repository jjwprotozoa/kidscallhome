// src/features/calls/hooks/modules/useCallTermination.ts
// Call termination and cleanup logic

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { endCall as endCallUtil } from "../../utils/callEnding";
import { resetUserStartedCall } from "@/utils/userInteraction";
import type { CallState } from "./useCallStateMachine";

export interface UseCallTerminationParams {
  callId: string | null;
  role: "parent" | "child" | "family_member";
  callChannelRef: React.MutableRefObject<RealtimeChannel | null>;
  terminationChannelRef: React.MutableRefObject<RealtimeChannel | null>;
  answerPollingIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
  cleanupWebRTC: (force?: boolean) => void;  // Added force parameter
  setStateWithLogging: (
    newState: CallState,
    reason: string,
    context?: Record<string, unknown>
  ) => void;
}

export const useCallTermination = ({
  callId,
  role,
  callChannelRef,
  terminationChannelRef,
  answerPollingIntervalRef,
  cleanupWebRTC,
  setStateWithLogging,
}: UseCallTerminationParams) => {
  const endCall = async () => {
    if (!callId) return;

    // CRITICAL: Set state to "ended" IMMEDIATELY for instant UI feedback
    // Don't wait for database update - user clicked end call, so end it now
    const by = role;
    setStateWithLogging("ended", "Call ended by user", {
      callId,
      by,
      reason: "hangup",
    });

    // Reset user interaction state for next call
    resetUserStartedCall();

    // CRITICAL: Force cleanup WebRTC immediately - this stops the camera
    // force=true ensures cleanup happens even if ICE is in "new" or "checking" state
    cleanupWebRTC(true);

    // Cleanup polling interval
    if (answerPollingIntervalRef.current) {
      clearInterval(answerPollingIntervalRef.current);
      answerPollingIntervalRef.current = null;
    }

    // Cleanup channels immediately
    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }

    if (terminationChannelRef.current) {
      supabase.removeChannel(terminationChannelRef.current);
      terminationChannelRef.current = null;
    }

    // Update database asynchronously (don't block UI)
    // If this fails, the call is already ended from user's perspective
    try {
      await endCallUtil({ callId, by, reason: "hangup" });
      // eslint-disable-next-line no-console
      console.log("📞 [CALL ENGINE] Call ended:", callId);
    } catch (error) {
      console.error(
        "Error ending call in database (call already ended locally):",
        error
      );
      // Don't show toast - call is already ended from user's perspective
      // The error is logged for debugging but doesn't affect UX
    }
  };

  return { endCall };
};


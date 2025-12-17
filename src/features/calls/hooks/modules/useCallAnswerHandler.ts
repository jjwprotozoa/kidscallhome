// src/features/calls/hooks/modules/useCallAnswerHandler.ts
// Answer subscription and polling handler for outgoing calls
// Works for all roles (child, parent, family_member)

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { CallState } from "./useCallStateMachine";

export interface UseCallAnswerHandlerParams {
  callId: string;
  role: "parent" | "child" | "family_member";
  stateRef: React.MutableRefObject<CallState>;
  webRTCPeerConnectionRef: React.MutableRefObject<RTCPeerConnection | null>;
  iceCandidatesQueue: React.MutableRefObject<RTCIceCandidateInit[]>;
  answerPollingIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setStateWithLogging: (
    newState: CallState,
    reason: string,
    context?: Record<string, unknown>
  ) => void;
  setIsConnecting: (connecting: boolean) => void;
}

export interface UseCallAnswerHandlerReturn {
  subscribeToAnswer: () => RealtimeChannel;
  startPolling: () => void;
  checkExistingAnswer: () => Promise<void>;
}

export const useCallAnswerHandler = ({
  callId,
  role,
  stateRef,
  webRTCPeerConnectionRef,
  iceCandidatesQueue,
  answerPollingIntervalRef,
  setStateWithLogging,
  setIsConnecting,
}: UseCallAnswerHandlerParams): UseCallAnswerHandlerReturn => {
  const processAnswer = async (
    answer: Json,
    source: "realtime" | "polling" | "existing"
  ) => {
    const pc = webRTCPeerConnectionRef.current;
    if (!pc || pc.remoteDescription !== null) {
      return; // Already processed or no peer connection
    }

    console.warn(`📞 [ANSWER HANDLER] Processing answer from ${source}:`, {
      callId,
      hasAnswer: !!answer,
    });

    const answerDesc = answer as unknown as RTCSessionDescriptionInit;
    await pc.setRemoteDescription(new RTCSessionDescription(answerDesc));
    console.warn(`✅ [ANSWER HANDLER] Remote description set from ${source}`);

    // Process queued ICE candidates
    const queuedCount = iceCandidatesQueue.current.length;
    if (queuedCount > 0) {
      console.warn(
        `📞 [ANSWER HANDLER] Processing ${queuedCount} queued ICE candidates`
      );
      for (const candidate of iceCandidatesQueue.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          const error = err as Error;
          if (
            !error.message?.includes("duplicate") &&
            !error.message?.includes("already")
          ) {
            console.error("Error adding queued ICE candidate:", error.message);
          }
        }
      }
      iceCandidatesQueue.current = [];
    }

    // Process remote ICE candidates
    // Family members read from child_ice_candidates (they're calling children)
    const remoteCandidateField =
      role === "parent" || role === "family_member"
        ? "child_ice_candidates"
        : "parent_ice_candidates";
    const { data: callData } = await supabase
      .from("calls")
      .select(remoteCandidateField)
      .eq("id", callId)
      .single();

    const remoteCandidates =
      (callData?.[remoteCandidateField] as RTCIceCandidateInit[]) || [];
    if (pc && remoteCandidates.length > 0) {
      console.warn(
        `📞 [ANSWER HANDLER] Processing ${remoteCandidates.length} existing remote ICE candidates from ${remoteCandidateField}`
      );
      for (const candidate of remoteCandidates) {
        try {
          if (!candidate.candidate) continue;
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          const error = err as Error;
          if (
            !error.message?.includes("duplicate") &&
            !error.message?.includes("already")
          ) {
            console.error("Error adding remote ICE candidate:", error.message);
          }
        }
      }
    }

    // Update state
    if (stateRef.current === "calling") {
      setStateWithLogging("connecting", `Answer received from ${source}`, {
        callId,
      });
    }
    setIsConnecting(false);

    // Stop polling if it was running
    if (answerPollingIntervalRef.current) {
      clearInterval(answerPollingIntervalRef.current);
      answerPollingIntervalRef.current = null;
    }
  };

  const subscribeToAnswer = (): RealtimeChannel => {
    const answerChannel = supabase
      .channel(`call:${callId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${callId}`,
        },
        async (payload) => {
          console.warn("📡 [ANSWER HANDLER] UPDATE event received:", {
            callId,
            hasNew: !!payload.new,
            hasOld: !!payload.old,
            timestamp: new Date().toISOString(),
          });

          const updatedCall = payload.new as {
            answer: Json | null;
            status: string;
          };
          const oldCallPayload = payload.old as { status: string } | null;
          const pc = webRTCPeerConnectionRef.current;

          console.warn("📡 [ANSWER HANDLER] Update details:", {
            hasAnswer: !!updatedCall.answer,
            hadAnswer: !!oldCallPayload,
            status: updatedCall.status,
            oldStatus: oldCallPayload?.status,
            hasRemoteDesc: !!pc?.remoteDescription,
            currentState: stateRef.current,
          });

          // Process answer when it appears
          if (updatedCall.answer && pc && pc.remoteDescription === null) {
            await processAnswer(updatedCall.answer, "realtime");
            console.warn(
              "✅ [ANSWER HANDLER] Call connected! Answer processed successfully."
            );
          } else if (
            updatedCall.answer &&
            pc &&
            pc.remoteDescription !== null
          ) {
            console.warn(
              "⚠️ [ANSWER HANDLER] Answer received but remoteDescription already set - skipping"
            );
          }

          // Handle status changes even if answer isn't present yet
          const statusChanged =
            oldCallPayload?.status !== updatedCall.status &&
            (updatedCall.status === "in_call" ||
              updatedCall.status === "active") &&
            stateRef.current === "calling";

          if (statusChanged) {
            console.warn(
              "📞 [ANSWER HANDLER] Call status changed to accepted, transitioning to connecting",
              {
                callId,
                oldStatus: oldCallPayload?.status,
                newStatus: updatedCall.status,
                currentState: stateRef.current,
              }
            );
            setStateWithLogging(
              "connecting",
              "Call accepted by recipient (status change)",
              {
                callId,
                status: updatedCall.status,
              }
            );
          }
        }
      )
      .subscribe((status, err) => {
        console.warn("📡 [ANSWER HANDLER] Answer subscription status:", {
          callId,
          status,
          error: err,
          channelName: `call:${callId}`,
        });
        if (status === "SUBSCRIBED") {
          console.warn(
            "✅ [ANSWER HANDLER] Successfully subscribed to answer updates"
          );
        } else if (status === "CHANNEL_ERROR" || err) {
          console.error(
            "❌ [ANSWER HANDLER] Answer subscription error:",
            err || "Channel error"
          );
        }
      });

    return answerChannel;
  };

  const startPolling = () => {
    // Clear any existing polling interval
    if (answerPollingIntervalRef.current) {
      clearInterval(answerPollingIntervalRef.current);
    }

    console.warn("🔄 [ANSWER HANDLER] Starting answer polling fallback", {
      callId,
      role,
    });

    answerPollingIntervalRef.current = setInterval(async () => {
      // Only poll if we're still in "calling" state and have a callId
      if (stateRef.current !== "calling" || !callId) {
        if (answerPollingIntervalRef.current) {
          clearInterval(answerPollingIntervalRef.current);
          answerPollingIntervalRef.current = null;
        }
        return;
      }

      try {
        console.warn("🔄 [ANSWER HANDLER] Polling for answer update...", {
          callId,
          currentState: stateRef.current,
        });

        const { data: polledCall, error } = await supabase
          .from("calls")
          .select("answer, status")
          .eq("id", callId)
          .single();

        if (error) {
          console.warn(
            "⚠️ [ANSWER HANDLER] Error polling for answer:",
            error.message
          );
          return;
        }

        console.warn("🔄 [ANSWER HANDLER] Poll result:", {
          callId,
          hasAnswer: !!polledCall?.answer,
          status: polledCall?.status,
          hasRemoteDesc: !!webRTCPeerConnectionRef.current?.remoteDescription,
        });

        // If answer is present but we haven't processed it yet, process it now
        if (polledCall?.answer) {
          const pc = webRTCPeerConnectionRef.current;
          if (pc && pc.remoteDescription === null) {
            await processAnswer(polledCall.answer, "polling");
          }
        }
      } catch (pollError) {
        console.error(
          "❌ [ANSWER HANDLER] Error in answer polling:",
          pollError
        );
      }
    }, 2000); // Poll every 2 seconds
  };

  const checkExistingAnswer = async () => {
    console.warn("🔄 [ANSWER HANDLER] Checking for existing answer...", {
      callId,
    });

    const { data: currentCall, error: currentCallError } = await supabase
      .from("calls")
      .select("answer, status")
      .eq("id", callId)
      .single();

    if (currentCallError) {
      console.warn(
        "⚠️ [ANSWER HANDLER] Error checking for existing answer:",
        currentCallError.message
      );
      return;
    }

    console.warn("🔄 [ANSWER HANDLER] Initial answer check result:", {
      callId,
      hasAnswer: !!currentCall?.answer,
      status: currentCall?.status,
    });

    if (currentCall?.answer) {
      console.warn(
        "📞 [ANSWER HANDLER] Answer already present when subscription set up - processing immediately",
        {
          callId,
          hasAnswer: !!currentCall.answer,
          status: currentCall.status,
        }
      );
      await processAnswer(currentCall.answer, "existing");
      console.warn(
        "✅ [ANSWER HANDLER] Call connected! Answer processed from existing state."
      );
    }
  };

  return {
    subscribeToAnswer,
    startPolling,
    checkExistingAnswer,
  };
};

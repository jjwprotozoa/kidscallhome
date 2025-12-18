// src/features/calls/hooks/modules/useIncomingCall.ts
// Incoming call orchestration module
// Routes to role-specific handlers at orchestration level

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useCallback } from "react";
import { validateAdultIncomingCall } from "./handlers/adultIncomingCallHandler";
import { validateChildIncomingCall } from "./handlers/childIncomingCallHandler";
import { stopAllActiveStreams } from "../../utils/mediaCleanup";
import { resetUserStartedCall } from "@/utils/userInteraction";
import type { CallState } from "./useCallStateMachine";

export interface UseIncomingCallParams {
  role: "parent" | "child" | "family_member";
  localProfileId: string;
  localStream: MediaStream | null;
  webRTCPeerConnectionRef: React.MutableRefObject<RTCPeerConnection | null>;
  initializeConnection: () => Promise<void>;
  setStateWithLogging: (
    newState: CallState,
    reason: string,
    context?: Record<string, unknown>
  ) => void;
  setIsConnecting: (connecting: boolean) => void;
  setCallId: (callId: string) => void;
  cleanupWebRTC?: (force?: boolean) => void;  // Optional cleanup function
}

export interface UseIncomingCallReturn {
  acceptIncomingCall: (callId: string) => Promise<void>;
  rejectIncomingCall: (callId: string) => Promise<void>;
}

export const useIncomingCall = ({
  role,
  localProfileId,
  localStream,
  webRTCPeerConnectionRef,
  initializeConnection,
  setStateWithLogging,
  setIsConnecting,
  setCallId,
  cleanupWebRTC,
}: UseIncomingCallParams): UseIncomingCallReturn => {
  const acceptIncomingCall = useCallback(
    async (incomingCallId: string) => {
      try {
        // IMMEDIATE UI RESPONSE: Set state to connecting before any async work
        setStateWithLogging("connecting", "Accepting incoming call", {
          incomingCallId,
        });
        setIsConnecting(true);

        // Ensure peer connection is initialized
        let pc = webRTCPeerConnectionRef.current;
        if (!pc) {
          console.warn(
            "📞 [INCOMING CALL] Peer connection not initialized, initializing now..."
          );
          await initializeConnection();
          pc = webRTCPeerConnectionRef.current;
          if (!pc) {
            throw new Error("Failed to initialize peer connection");
          }
        }

        // Ensure local stream is ready
        if (!localStream) {
          console.warn(
            "📞 [INCOMING CALL] Local stream not ready, initializing now..."
          );
          await initializeConnection();
          pc = webRTCPeerConnectionRef.current;
          if (!pc) {
            throw new Error("Failed to initialize peer connection");
          }
        }

        // ROLE-BASED VALIDATION: Route to appropriate validator
        let validation;
        if (role === "child") {
          validation = await validateChildIncomingCall({
            callId: incomingCallId,
            localProfileId,
          });
        } else {
          // parent or family_member - same validation logic
          validation = await validateAdultIncomingCall({
            role,
            callId: incomingCallId,
            localProfileId,
          });
        }

        if (!validation.isValid || !validation.call) {
          throw new Error(validation.reason || "Invalid incoming call");
        }

        const call = validation.call;

        if (!call.offer) {
          throw new Error("Call offer not found");
        }

        // Set remote description (offer)
        // CRITICAL: Check if remote description is already set (not signaling state)
        // "stable" is the INITIAL state before any offer/answer - it's fine to set remote description
        // Only skip if remote description is already set (already processed)
        if (pc.remoteDescription !== null) {
          console.warn(
            "⚠️ [INCOMING CALL] Remote description already set - call may have already been processed",
            {
              signalingState: pc.signalingState,
              hasRemoteDescription: pc.remoteDescription !== null,
              hasLocalDescription: pc.localDescription !== null,
            }
          );
          // If remote description is already set, check if we need to create answer
          if (pc.localDescription === null) {
            // Remote description is set but no local description - create answer
            console.warn(
              "📞 [INCOMING CALL] Remote description set but no answer - creating answer now"
            );
            // Continue to create answer below
          } else {
            // Both descriptions are set - call is already processed
            setCallId(incomingCallId);
            setIsConnecting(false);
            return;
          }
        }

        // Only set remote description if it's not already set
        const justSetRemoteDescription = pc.remoteDescription === null;
        if (justSetRemoteDescription) {
          const offerDesc = call.offer as unknown as RTCSessionDescriptionInit;
          await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));
          
          // Wait for signaling state to change to have-remote-offer
          // This ensures the offer is properly set before creating the answer
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Timeout waiting for signaling state change"));
            }, 5000);

            const checkState = () => {
              if (
                pc.signalingState === "have-remote-offer" ||
                pc.signalingState === "have-local-pranswer"
              ) {
                clearTimeout(timeout);
                resolve();
              } else if (pc.signalingState === "closed") {
                clearTimeout(timeout);
                reject(new Error("Peer connection closed"));
              } else {
                setTimeout(checkState, 100);
              }
            };
            checkState();
          });
        } else {
          // Remote description already set - verify we're in the right state
          if (
            pc.signalingState !== "have-remote-offer" &&
            pc.signalingState !== "have-local-pranswer" &&
            pc.signalingState !== "stable"
          ) {
            console.warn(
              "⚠️ [INCOMING CALL] Unexpected signaling state with remote description set:",
              pc.signalingState
            );
          }
        }

        // Check if answer is already created
        if (pc.localDescription !== null) {
          console.warn(
            "⚠️ [INCOMING CALL] Local description (answer) already set - call may have already been accepted",
            {
              signalingState: pc.signalingState,
              hasRemoteDescription: pc.remoteDescription !== null,
              hasLocalDescription: pc.localDescription !== null,
            }
          );
          // Answer already created - just set call ID and return
          setCallId(incomingCallId);
          setIsConnecting(false);
          return;
        }

        // Verify tracks are added before creating answer
        const senderTracks = pc
          .getSenders()
          .map((s) => s.track)
          .filter(Boolean);
        const audioTracks = senderTracks.filter((t) => t?.kind === "audio");
        const videoTracks = senderTracks.filter((t) => t?.kind === "video");

        if (senderTracks.length === 0) {
          throw new Error(
            "Cannot create answer: no media tracks found. Please ensure camera/microphone permissions are granted."
          );
        }

        console.warn("📹 [INCOMING CALL] Tracks before creating answer:", {
          audioTracks: audioTracks.length,
          videoTracks: videoTracks.length,
          totalTracks: senderTracks.length,
          audioEnabled: audioTracks.every((t) => t?.enabled),
        });

        if (audioTracks.length === 0) {
          console.error(
            "❌ [INCOMING CALL] WARNING: No audio tracks found! Audio will not work."
          );
        }

        // Create answer
        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });

        // Verify answer SDP includes media tracks
        const hasAudio = answer.sdp?.includes("m=audio");
        const hasVideo = answer.sdp?.includes("m=video");
        console.warn("📋 [INCOMING CALL] Answer SDP verification:", {
          hasAudio,
          hasVideo,
          sdpLength: answer.sdp?.length,
        });

        if (!hasAudio && !hasVideo) {
          throw new Error(
            "Answer SDP missing media tracks - ensure tracks are added before creating answer"
          );
        }

        if (!hasAudio) {
          console.error(
            "❌ [INCOMING CALL] WARNING: Answer SDP has no audio! Audio will not work."
          );
        }

        await pc.setLocalDescription(answer);

        // Update call with answer - works the same for all roles
        const { error: updateError } = await supabase
          .from("calls")
          .update({
            answer: { type: answer.type, sdp: answer.sdp } as Json,
            status: "active",
            ended_at: null,
          })
          .eq("id", incomingCallId);

        if (updateError) {
          console.error(
            "❌ [INCOMING CALL] Error updating call with answer:",
            updateError
          );
          throw updateError;
        }

        setCallId(incomingCallId);
        console.warn("📞 [INCOMING CALL] Call accepted:", incomingCallId);
        setIsConnecting(false);

        // Process existing remote ICE candidates immediately
        // Family members read from child_ice_candidates (they're calling children)
        const remoteCandidateField =
          role === "parent" || role === "family_member"
            ? "child_ice_candidates"
            : "parent_ice_candidates";
        const remoteCandidates =
          (call[remoteCandidateField] as RTCIceCandidateInit[]) || [];

        // DIAGNOSTIC: Log ICE candidate state when accepting call
        console.warn(
          `🧊 [INCOMING CALL] ICE candidate state when accepting:`, {
            role,
            remoteCandidateField,
            existingCandidatesCount: remoteCandidates.length,
            callHasField: remoteCandidateField in call,
            rawFieldValue: call[remoteCandidateField],
            iceConnectionState: pc.iceConnectionState,
          }
        );

        if (remoteCandidates.length > 0) {
          console.warn(
            `📞 [INCOMING CALL] Processing ${remoteCandidates.length} existing remote ICE candidates`
          );
          let addedCount = 0;
          for (const candidate of remoteCandidates) {
            try {
              if (!candidate.candidate) continue;
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
              addedCount++;
            } catch (err) {
              const error = err as Error;
              if (
                !error.message?.includes("duplicate") &&
                !error.message?.includes("already")
              ) {
                console.error(
                  "Error adding remote ICE candidate:",
                  error.message
                );
              }
            }
          }
          console.warn(`✅ [INCOMING CALL] Added ${addedCount} ICE candidates`);
        } else {
          console.warn(
            `⚠️ [INCOMING CALL] No existing ICE candidates from caller - they may arrive via UPDATE events`
          );
        }
      } catch (error) {
        console.error("Error accepting call:", error);
        // CRITICAL: Cleanup WebRTC on error to release camera
        if (cleanupWebRTC) {
          cleanupWebRTC(true);
        }
        // CRITICAL: Safety fallback - ensure all streams are stopped
        stopAllActiveStreams();
        // NOTE: Do NOT call resetUserStartedCall() here!
        // The user explicitly clicked Accept, so their intent is clear.
        // Resetting would cause audio to be muted if they retry or if the call
        // still connects after the error. Only reset on explicit reject/end.
        throw error;
      }
    },
    [
      role,
      localProfileId,
      localStream,
      webRTCPeerConnectionRef,
      initializeConnection,
      setStateWithLogging,
      setIsConnecting,
      setCallId,
      cleanupWebRTC,
    ]
  );

  const rejectIncomingCall = useCallback(
    async (incomingCallId: string) => {
      try {
        await supabase
          .from("calls")
          .update({ status: "rejected" })
          .eq("id", incomingCallId);

        setStateWithLogging("ended", "Call rejected by user", {
          incomingCallId,
        });
        
        // CRITICAL: Cleanup WebRTC to release camera when rejecting call
        if (cleanupWebRTC) {
          cleanupWebRTC(true);
        }
        // CRITICAL: Safety fallback - ensure all streams are stopped
        stopAllActiveStreams();
        resetUserStartedCall();
        
        console.warn("📞 [INCOMING CALL] Call rejected:", incomingCallId);
      } catch (error) {
        console.error("Error rejecting call:", error);
        // Still cleanup even on error
        if (cleanupWebRTC) {
          cleanupWebRTC(true);
        }
        // CRITICAL: Safety fallback - ensure all streams are stopped even on error
        stopAllActiveStreams();
        resetUserStartedCall();
        throw error;
      }
    },
    [setStateWithLogging, cleanupWebRTC]
  );

  return {
    acceptIncomingCall,
    rejectIncomingCall,
  };
};

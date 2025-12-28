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

        // OPTIMIZED: Start validation and connection setup in parallel for faster acceptance
        // This reduces total wait time when both operations are needed
        const needsConnection = !webRTCPeerConnectionRef.current || !localStream;
        
        const [validation, connectionResult] = await Promise.all([
          // ROLE-BASED VALIDATION: Route to appropriate validator
          role === "child"
            ? validateChildIncomingCall({
                callId: incomingCallId,
                localProfileId,
              })
            : validateAdultIncomingCall({
                role,
                callId: incomingCallId,
                localProfileId,
              }),
          // Only initialize connection if needed
          needsConnection
            ? (async () => {
                console.warn(
                  "📞 [INCOMING CALL] Initializing connection..."
                );
                await initializeConnection();
                return webRTCPeerConnectionRef.current;
              })()
            : Promise.resolve(webRTCPeerConnectionRef.current),
        ]);

        // Ensure peer connection is initialized
        let pc = connectionResult;
        if (!pc) {
          throw new Error("Failed to initialize peer connection");
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
          // CRITICAL: Check signaling state - must be "stable" to set remote offer
          if (pc.signalingState !== "stable") {
            console.warn(
              "⚠️ [INCOMING CALL] Cannot set remote offer - wrong signaling state",
              {
                signalingState: pc.signalingState,
                expectedState: "stable",
                hasLocalDescription: pc.localDescription !== null,
                hasRemoteDescription: pc.remoteDescription !== null,
              }
            );
            // If we're not in stable state, the connection might already be in progress
            // Check if we need to create an answer instead
            if (pc.signalingState === "have-local-offer" && call.answer) {
              // We have a local offer and call has an answer - set the answer instead
              console.warn(
                "📞 [INCOMING CALL] Already have local offer, setting remote answer instead",
                {
                  callId: incomingCallId,
                  signalingState: pc.signalingState,
                }
              );
              
              // CRITICAL: Double-check signaling state right before setting (race condition protection)
              if (pc.signalingState !== "have-local-offer") {
                console.warn(
                  "⚠️ [INCOMING CALL] Signaling state changed before setting remote answer - skipping",
                  {
                    callId: incomingCallId,
                    expectedState: "have-local-offer",
                    actualState: pc.signalingState,
                  }
                );
                throw new Error(
                  `Cannot set remote answer - peer connection in ${pc.signalingState} state`
                );
              }
              
              const answerDesc = call.answer as unknown as RTCSessionDescriptionInit;
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(answerDesc));
                setCallId(incomingCallId);
                setIsConnecting(false);
                return;
              } catch (error) {
                console.error("❌ [INCOMING CALL] Failed to set remote answer:", error);
                throw error;
              }
            } else {
              throw new Error(
                `Cannot set remote offer - peer connection in ${pc.signalingState} state`
              );
            }
          }

          const offerDesc = call.offer as unknown as RTCSessionDescriptionInit;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));
          } catch (error) {
            const err = error as Error;
            console.error("❌ [INCOMING CALL] Failed to set remote offer:", err.message, {
              signalingState: pc.signalingState,
              hasLocalDescription: pc.localDescription !== null,
            });
            throw new Error(`Failed to set remote offer: ${err.message}`);
          }
          
          // Wait for signaling state to change to have-remote-offer
          // OPTIMIZED: Check immediately first, then use faster polling (10ms) and shorter timeout (2s)
          // Most state changes happen immediately, so this speeds up the common case
          if (
            pc.signalingState === "have-remote-offer" ||
            pc.signalingState === "have-local-pranswer"
          ) {
            // Already in the right state - no need to wait
          } else {
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error("Timeout waiting for signaling state change"));
              }, 2000); // Reduced from 5000ms to 2000ms

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
                  setTimeout(checkState, 10); // Reduced from 100ms to 10ms for faster detection
                }
              };
              checkState();
            });
          }
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

        // OPTIMIZED: Process ICE candidates and database update in parallel for faster connection
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

        // Process ICE candidates in parallel with database update
        const iceCandidatePromise = (async () => {
          if (remoteCandidates.length > 0) {
            console.warn(
              `📞 [INCOMING CALL] Processing ${remoteCandidates.length} existing remote ICE candidates`
            );
            let addedCount = 0;
            // Process candidates in parallel batches for speed
            const candidatePromises = remoteCandidates.map(async (candidate) => {
              try {
                if (!candidate.candidate) return false;
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                return true;
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
                return false;
              }
            });
            const results = await Promise.all(candidatePromises);
            addedCount = results.filter(Boolean).length;
            console.warn(`✅ [INCOMING CALL] Added ${addedCount} ICE candidates`);
          } else {
            console.warn(
              `⚠️ [INCOMING CALL] No existing ICE candidates from caller - they may arrive via UPDATE events`
            );
          }
        })();

        // Update call with answer - works the same for all roles
        const dbUpdatePromise = supabase
          .from("calls")
          .update({
            answer: { type: answer.type, sdp: answer.sdp } as Json,
            status: "active",
            ended_at: null,
          })
          .eq("id", incomingCallId);

        // Wait for both operations in parallel
        const [{ error: updateError }] = await Promise.all([
          dbUpdatePromise,
          iceCandidatePromise,
        ]);

        if (updateError) {
          console.error(
            "❌ [INCOMING CALL] Error updating call with answer:",
            updateError
          );
          throw updateError;
        }

        setCallId(incomingCallId);
        console.warn("📞 [INCOMING CALL] Call accepted:", incomingCallId);
        
        // Log connection diagnostics after accepting call (especially useful for iPhone debugging)
        // Defer this to not block the connection process
        if (import.meta.env.DEV) {
          Promise.resolve().then(async () => {
            try {
              const { logConnectionDiagnostics } = await import(
                "@/utils/callConnectionDiagnostics"
              );
              logConnectionDiagnostics(pc);
            } catch (err) {
              // Diagnostics module not critical - continue even if import fails
              console.warn("Failed to load diagnostics:", err);
            }
          }).catch(() => {
            // Silently handle errors
          });
        }
        
        setIsConnecting(false);
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

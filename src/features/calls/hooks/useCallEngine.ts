// src/features/calls/hooks/useCallEngine.ts
// Call engine hook implementing state machine for parent/child calls

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { endCall as endCallUtil, isCallTerminal } from "../utils/callEnding";
import { useWebRTC } from "./useWebRTC";

export type CallState =
  | "idle"
  | "calling"
  | "incoming"
  | "connecting"
  | "in_call"
  | "ended";

export interface UseCallEngineOptions {
  role: "parent" | "child" | "family_member";
  localProfileId: string; // parent_id for parent, child_id for child, family_member_id for family_member
  remoteProfileId: string; // child_id for parent/family_member, parent_id for child
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
}

export interface UseCallEngineReturn {
  state: CallState;
  callId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  startOutgoingCall: (remoteId: string) => Promise<void>;
  acceptIncomingCall: (callId: string) => Promise<void>;
  rejectIncomingCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
}

export const useCallEngine = ({
  role,
  localProfileId,
  remoteProfileId,
  localVideoRef,
  remoteVideoRef,
}: UseCallEngineOptions): UseCallEngineReturn => {
  const [state, setState] = useState<CallState>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // DIAGNOSTIC: Log all state transitions
  const logStateTransition = useCallback(
    (
      newState: CallState,
      reason: string,
      context?: Record<string, unknown>
    ) => {
      // eslint-disable-next-line no-console
      console.log("🔄 [CALL STATE] State transition:", {
        from: state,
        to: newState,
        callId: callId || "none",
        role,
        reason,
        timestamp: new Date().toISOString(),
        ...context,
      });
    },
    [state, callId, role]
  );

  // Wrapper for setState that logs transitions
  const setStateWithLogging = useCallback(
    (
      newState: CallState,
      reason: string,
      context?: Record<string, unknown>
    ) => {
      if (state !== newState) {
        logStateTransition(newState, reason, context);
        setState(newState);
      }
    },
    [state, logStateTransition]
  );

  const navigate = useNavigate();
  const { toast } = useToast();
  const callChannelRef = useRef<RealtimeChannel | null>(null);
  const terminationChannelRef = useRef<RealtimeChannel | null>(null);
  const initializationRef = useRef(false);

  const {
    localStream,
    remoteStream,
    isConnecting,
    setIsConnecting,
    initializeConnection,
    cleanup: cleanupWebRTC,
    iceCandidatesQueue,
    peerConnectionRef: webRTCPeerConnectionRef,
    playRemoteVideo,
  } = useWebRTC(callId, localVideoRef, remoteVideoRef, role === "child");

  // Initialize WebRTC connection
  useEffect(() => {
    if (!initializationRef.current && state === "idle") {
      initializationRef.current = true;
      initializeConnection().catch((error) => {
        console.error("Failed to initialize WebRTC:", error);
        toast({
          title: "Connection Error",
          description: "Failed to initialize video connection",
          variant: "destructive",
        });
      });
    }
  }, [state, initializeConnection, toast]);

  // Pre-warm local media when incoming call is detected
  // This makes Accept feel instant - camera/mic are already active
  useEffect(() => {
    if (state === "incoming" && !localStream) {
      // eslint-disable-next-line no-console
      console.log("📞 [CALL ENGINE] Pre-warming local media for incoming call");
      initializeConnection().catch((error) => {
        console.error("Failed to pre-warm media:", error);
        // Don't show toast - user hasn't accepted yet
      });
    }
  }, [state, localStream, initializeConnection]);

  // Listen for incoming calls
  useEffect(() => {
    if (state !== "idle" || !localProfileId) return;

    // For family members, we need to listen for calls to children in their family
    // We'll use a broader filter and check family membership in the handler
    const channel = supabase
      .channel(`incoming-calls:${localProfileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter:
            role === "parent"
              ? `parent_id=eq.${localProfileId}`
              : role === "family_member"
              ? `family_member_id=eq.${localProfileId}`
              : `child_id=eq.${localProfileId}`,
        },
        async (payload) => {
          const call = payload.new as {
            id: string;
            status: string;
            caller_type: string;
            offer: Json | null;
          };

          // Only handle incoming calls (opposite caller_type)
          if (
            call.status === "ringing" &&
            call.caller_type !== role &&
            call.offer
          ) {
            // eslint-disable-next-line no-console
            console.log("📞 [CALL ENGINE] Incoming call detected:", call.id);
            setCallId(call.id);
            setStateWithLogging(
              "incoming",
              "Incoming call detected from database",
              {
                callId: call.id,
                callerType: call.caller_type,
                hasOffer: !!call.offer,
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state, localProfileId, role, setStateWithLogging]);

  // Monitor call status changes
  useEffect(() => {
    if (!callId) return;

    const channel = supabase
      .channel(`call-status:${callId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${callId}`,
        },
        async (payload) => {
          const updatedCall = payload.new as {
            id: string;
            status: string;
            answer: Json | null;
            ended_at: string | null;
            ended_by?: string | null;
            parent_ice_candidates?: Json | null;
            child_ice_candidates?: Json | null;
          };
          const oldCall = payload.old as { status?: string } | null;
          const pc = webRTCPeerConnectionRef.current;

          // Handle answer received (for outgoing calls)
          // CRITICAL: Check for both "in_call" and "active" status for compatibility
          // Also handle "connecting" state (when accepting incoming calls)
          if (
            (state === "calling" || state === "connecting") &&
            updatedCall.answer &&
            (updatedCall.status === "in_call" ||
              updatedCall.status === "active")
          ) {
            // eslint-disable-next-line no-console
            console.log(
              "📞 [CALL ENGINE] Answer received, setting remote description"
            );
            if (pc && pc.remoteDescription === null) {
              const answerDesc =
                updatedCall.answer as unknown as RTCSessionDescriptionInit;
              await pc.setRemoteDescription(
                new RTCSessionDescription(answerDesc)
              );

              // Process queued ICE candidates
              for (const candidate of iceCandidatesQueue.current) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                  const error = err as Error;
                  if (
                    !error.message?.includes("duplicate") &&
                    !error.message?.includes("already")
                  ) {
                    console.error(
                      "Error adding queued ICE candidate:",
                      error.message
                    );
                  }
                }
              }
              iceCandidatesQueue.current = [];

              // CRITICAL: Stop connecting immediately when answer is received
              // This stops the ringtone and indicates call is being answered
              setIsConnecting(false);
            }
          }

          // Handle call rejection/missed
          if (
            (state === "calling" ||
              state === "incoming" ||
              state === "connecting") &&
            (updatedCall.status === "rejected" ||
              updatedCall.status === "missed")
          ) {
            // eslint-disable-next-line no-console
            console.log("📞 [CALL ENGINE] Call rejected or missed");
            setStateWithLogging("ended", "Call rejected or missed", {
              dbStatus: updatedCall.status,
              oldState: state,
            });
            cleanupWebRTC();
          }

          // Handle call ended
          // Process termination if call is now terminal AND either:
          // 1. oldCall exists and was not terminal, OR
          // 2. oldCall is undefined (first update we see)
          // CRITICAL: Only process if ended by remote party (not by ourselves)
          if (
            isCallTerminal(updatedCall) &&
            (!oldCall || !isCallTerminal(oldCall))
          ) {
            // Check who ended the call - only show notification if ended by remote party
            const endedBy = updatedCall.ended_by;
            const endedByRemote = 
              (role === "parent" && endedBy === "child") ||
              (role === "child" && endedBy === "parent") ||
              (role === "family_member" && endedBy === "child");
            
            // Log for debugging
            // eslint-disable-next-line no-console
            console.log("📞 [CALL ENGINE] Call termination detected", {
              role,
              endedBy,
              endedByRemote,
              isTerminal: isCallTerminal(updatedCall),
              oldCallStatus: oldCall?.status,
              newCallStatus: updatedCall.status,
              state,
            });
            
            // Always update state when call ends, but only show notification if ended by remote party
            const endedBySelf = 
              (role === "parent" && endedBy === "parent") ||
              (role === "child" && endedBy === "child") ||
              (role === "family_member" && endedBy === "family_member");
            
            // Update state to ended
            setStateWithLogging("ended", endedByRemote ? "Call ended by remote party" : "Call ended", {
              dbStatus: updatedCall.status,
              endedAt: updatedCall.ended_at,
              endedBy,
              oldState: state,
            });
            cleanupWebRTC();
            
            // Only show notification if ended by remote party (not by ourselves)
            if (endedByRemote) {
              // eslint-disable-next-line no-console
              console.log("📞 [CALL ENGINE] Call ended by remote party - showing notification");
              toast({
                title: "Call Ended",
                description: "The other person ended the call",
              });
            } else if (endedBySelf) {
              // eslint-disable-next-line no-console
              console.log("📞 [CALL ENGINE] Call ended by local user - no notification");
              // Don't show notification - user ended it themselves
            } else {
              // ended_by is not set - for backward compatibility, show notification
              // eslint-disable-next-line no-console
              console.log("📞 [CALL ENGINE] Call ended (ended_by not set) - showing notification for backward compatibility");
              toast({
                title: "Call Ended",
                description: "The call has ended",
              });
            }
          }

          // CRITICAL: Process ICE candidates from remote peer
          // This ensures we process candidates that arrive after answer is sent
          // Family members read from child_ice_candidates (they're calling children)
          const remoteCandidateField =
            role === "parent" || role === "family_member"
              ? "child_ice_candidates"
              : "parent_ice_candidates";
          const remoteCandidates =
            (updatedCall[remoteCandidateField] as RTCIceCandidateInit[]) || [];

          if (remoteCandidates.length > 0 && pc && pc.remoteDescription) {
            // Process new candidates (avoid reprocessing by checking if already added)
            for (const candidate of remoteCandidates) {
              try {
                if (!candidate.candidate) continue;
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                const error = err as Error;
                // Silently handle duplicates - this is expected
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
          }

          // Transition to in_call when connection is established
          // CRITICAL: Check for both "in_call" and "active" status for compatibility
          if (
            (updatedCall.status === "in_call" ||
              updatedCall.status === "active") &&
            (state === "calling" ||
              state === "incoming" ||
              state === "connecting")
          ) {
            if (pc) {
              const checkConnection = () => {
                const iceState = pc.iceConnectionState;
                const connState = pc.connectionState;

                if (
                  (iceState === "connected" || iceState === "completed") &&
                  connState === "connected" &&
                  remoteStream
                ) {
                  // eslint-disable-next-line no-console
                  console.log(
                    "📞 [CALL ENGINE] Connection established, transitioning to in_call"
                  );
                  setStateWithLogging(
                    "in_call",
                    "WebRTC connection established",
                    {
                      iceState,
                      connectionState: connState,
                      hasRemoteStream: !!remoteStream,
                      remoteStreamTracks: remoteStream.getTracks().length,
                      audioTracks: remoteStream.getAudioTracks().length,
                      videoTracks: remoteStream.getVideoTracks().length,
                    }
                  );
                  setIsConnecting(false);
                }
              };

              // Check immediately
              checkConnection();

              // Also listen for connection state changes
              pc.addEventListener("iceconnectionstatechange", checkConnection);
              pc.addEventListener("connectionstatechange", checkConnection);

              return () => {
                pc.removeEventListener(
                  "iceconnectionstatechange",
                  checkConnection
                );
                pc.removeEventListener(
                  "connectionstatechange",
                  checkConnection
                );
              };
            }
          }
        }
      )
      .subscribe();

    callChannelRef.current = channel;

    return () => {
      if (callChannelRef.current) {
        supabase.removeChannel(callChannelRef.current);
        callChannelRef.current = null;
      }
    };
  }, [
    callId,
    state,
    remoteStream,
    setIsConnecting,
    cleanupWebRTC,
    toast,
    role,
    iceCandidatesQueue,
    webRTCPeerConnectionRef,
    setStateWithLogging,
  ]);

  // Monitor WebRTC connection state
  useEffect(() => {
    const pc = webRTCPeerConnectionRef.current;
    if (!pc || state !== "calling") return;

    const handleConnectionChange = () => {
      const iceState = pc.iceConnectionState;
      const connState = pc.connectionState;

      if (
        (iceState === "connected" || iceState === "completed") &&
        connState === "connected" &&
        remoteStream &&
        state === "calling"
      ) {
        // eslint-disable-next-line no-console
        console.log(
          "📞 [CALL ENGINE] WebRTC connected, transitioning to in_call"
        );
        setStateWithLogging("in_call", "WebRTC connected (monitor effect)", {
          iceState,
          connectionState: connState,
          hasRemoteStream: !!remoteStream,
          remoteStreamTracks: remoteStream.getTracks().length,
        });
        setIsConnecting(false);
      }
    };

    pc.addEventListener("iceconnectionstatechange", handleConnectionChange);
    pc.addEventListener("connectionstatechange", handleConnectionChange);

    return () => {
      pc.removeEventListener(
        "iceconnectionstatechange",
        handleConnectionChange
      );
      pc.removeEventListener("connectionstatechange", handleConnectionChange);
    };
  }, [
    state,
    remoteStream,
    setIsConnecting,
    webRTCPeerConnectionRef,
    setStateWithLogging,
  ]);

  // Redirect on ended state
  useEffect(() => {
    if (state === "ended") {
      // eslint-disable-next-line no-console
      console.log("🔄 [CALL STATE] Call ended, scheduling redirect", {
        callId,
        role,
        timestamp: new Date().toISOString(),
      });
      const timeout = setTimeout(() => {
        const homePath =
          role === "parent"
            ? "/parent"
            : role === "family_member"
            ? "/family-member/dashboard"
            : "/child";
        navigate(homePath);
      }, 2000); // Give time for cleanup

      return () => clearTimeout(timeout);
    }
  }, [state, navigate, role, callId]);

  const startOutgoingCall = useCallback(
    async (remoteId: string) => {
      if (state !== "idle") {
        console.warn("Cannot start call: not in idle state");
        return;
      }

      try {
        setStateWithLogging("calling", "Starting outgoing call", {
          remoteId,
          localProfileId,
        });
        setIsConnecting(true);

        const pc = webRTCPeerConnectionRef.current;
        if (!pc) {
          throw new Error("Peer connection not initialized");
        }

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Create call record in Supabase
        const callerType = role;
        let callData: Record<string, any> = {
          caller_type: callerType,
          status: "ringing",
          offer: { type: offer.type, sdp: offer.sdp } as Json,
          ended_at: null, // Ensure ended_at is null for new calls
        };

        // Set IDs based on role
        if (role === "parent") {
          callData.parent_id = localProfileId;
          callData.child_id = remoteId;
        } else if (role === "family_member") {
          callData.family_member_id = localProfileId;
          callData.child_id = remoteId;
          // Also need parent_id for the call (from the child's parent_id)
          const { data: childData } = await supabase
            .from("children")
            .select("parent_id")
            .eq("id", remoteId)
            .single();
          if (childData?.parent_id) {
            callData.parent_id = childData.parent_id;
          }
        } else {
          // child role
          callData.child_id = localProfileId;
          callData.parent_id = remoteId;
        }

        const { data: call, error } = await supabase
          .from("calls")
          .insert(callData)
          .select()
          .single();

        if (error) throw error;
        if (!call) throw new Error("Failed to create call");

        setCallId(call.id);
        // eslint-disable-next-line no-console
        console.log("📞 [CALL ENGINE] Outgoing call created:", call.id);

        // Set up ICE candidate handling
        pc.onicecandidate = async (event) => {
          if (event.candidate && call.id) {
            // Family members use parent_ice_candidates (they're calling like parents)
            const candidateField =
              role === "parent" || role === "family_member"
                ? "parent_ice_candidates"
                : "child_ice_candidates";

            const { data: currentCall } = await supabase
              .from("calls")
              .select(candidateField)
              .eq("id", call.id)
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
              .eq("id", call.id);
          }
        };

        // Listen for answer
        const answerChannel = supabase
          .channel(`call-answer:${call.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "calls",
              filter: `id=eq.${call.id}`,
            },
            async (payload) => {
              const updatedCall = payload.new as {
                answer: Json | null;
                status: string;
              };
              const pc = webRTCPeerConnectionRef.current;

              // CRITICAL: Check for both "in_call" and "active" status for compatibility
              if (
                updatedCall.answer &&
                (updatedCall.status === "in_call" ||
                  updatedCall.status === "active")
              ) {
                if (!pc) return;
                const answerDesc =
                  updatedCall.answer as unknown as RTCSessionDescriptionInit;
                await pc.setRemoteDescription(
                  new RTCSessionDescription(answerDesc)
                );

                // Process remote ICE candidates
                // Family members read from child_ice_candidates (they're calling children)
                const remoteCandidateField =
                  role === "parent" || role === "family_member"
                    ? "child_ice_candidates"
                    : "parent_ice_candidates";
                const { data: callData } = await supabase
                  .from("calls")
                  .select(remoteCandidateField)
                  .eq("id", call.id)
                  .single();

                const remoteCandidates =
                  (callData?.[remoteCandidateField] as RTCIceCandidateInit[]) ||
                  [];
                if (pc) {
                  for (const candidate of remoteCandidates) {
                    try {
                      await pc.addIceCandidate(new RTCIceCandidate(candidate));
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
                }

                // CRITICAL: Stop connecting immediately when answer is received
                // This stops the ringtone and indicates call is being answered
                setIsConnecting(false);
              }
            }
          )
          .subscribe();

        callChannelRef.current = answerChannel;
      } catch (error) {
        console.error("Error starting outgoing call:", error);
        toast({
          title: "Call Failed",
          description:
            error instanceof Error ? error.message : "Failed to start call",
          variant: "destructive",
        });
        setStateWithLogging("idle", "Outgoing call failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        setIsConnecting(false);
      }
    },
    [
      state,
      localProfileId,
      role,
      setIsConnecting,
      toast,
      setStateWithLogging,
      webRTCPeerConnectionRef,
    ]
  );

  const acceptIncomingCall = useCallback(
    async (incomingCallId: string) => {
      if (state !== "incoming") {
        console.warn("Cannot accept call: not in incoming state");
        return;
      }

      try {
        // IMMEDIATE UI RESPONSE: Set state to connecting before any async work
        setStateWithLogging("connecting", "Accepting incoming call", {
          incomingCallId,
          currentState: state,
        });
        setIsConnecting(true);

        const pc = webRTCPeerConnectionRef.current;
        if (!pc) {
          throw new Error("Peer connection not initialized");
        }

        // Ensure local stream is ready (should already be pre-warmed)
        if (!localStream) {
          // eslint-disable-next-line no-console
          console.log(
            "📞 [CALL ENGINE] Local stream not ready, initializing now..."
          );
          await initializeConnection();
        }

        // Fetch call data
        const { data: call, error: fetchError } = await supabase
          .from("calls")
          .select("*")
          .eq("id", incomingCallId)
          .single();

        if (fetchError || !call) {
          throw new Error("Call not found");
        }

        if (!call.offer) {
          throw new Error("Call offer not found");
        }

        // Set remote description (offer)
        const offerDesc = call.offer as unknown as RTCSessionDescriptionInit;
        await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));

        // CRITICAL: Verify tracks are added before creating answer
        const senderTracks = pc
          .getSenders()
          .map((s) => s.track)
          .filter(Boolean);

        if (senderTracks.length === 0) {
          throw new Error(
            "Cannot create answer: no media tracks found. Please ensure camera/microphone permissions are granted."
          );
        }

        // Create answer with explicit media track requests
        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(answer);

        // Verify answer SDP includes media tracks
        const hasAudio = answer.sdp?.includes("m=audio");
        const hasVideo = answer.sdp?.includes("m=video");
        if (!hasAudio && !hasVideo) {
          throw new Error(
            "Answer SDP missing media tracks - ensure tracks are added before creating answer"
          );
        }

        // Update call with answer - use the EXISTING call row
        // CRITICAL: Use "active" status to match callHandlers convention
        // This ensures compatibility with existing call handlers
        const { error: updateError } = await supabase
          .from("calls")
          .update({
            answer: { type: answer.type, sdp: answer.sdp } as Json,
            status: "active",
            ended_at: null, // Clear ended_at when reactivating call
          })
          .eq("id", incomingCallId);

        if (updateError) {
          console.error(
            "❌ [CALL ENGINE] Error updating call with answer:",
            updateError
          );
          throw updateError;
        }

        setCallId(incomingCallId);
        // eslint-disable-next-line no-console
        console.log("📞 [CALL ENGINE] Call accepted:", incomingCallId);

        // CRITICAL: Stop connecting immediately after accepting call
        // This stops the ringtone and indicates call is being answered
        setIsConnecting(false);

        // CRITICAL: DO NOT overwrite the ICE candidate handler from useWebRTC
        // The useWebRTC hook already has a robust handler that uses the callId ref
        // Setting callId above will make that handler work automatically

        // Process existing remote ICE candidates immediately
        // Family members read from child_ice_candidates (they're calling children)
        const remoteCandidateField =
          role === "parent" || role === "family_member"
            ? "child_ice_candidates"
            : "parent_ice_candidates";
        const remoteCandidates =
          (call[remoteCandidateField] as RTCIceCandidateInit[]) || [];

        if (remoteCandidates.length > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `📞 [CALL ENGINE] Processing ${remoteCandidates.length} existing remote ICE candidates`
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
                console.error(
                  "Error adding remote ICE candidate:",
                  error.message
                );
              }
            }
          }
        }

        // CRITICAL: The call status listener (set up in useEffect above) will handle
        // processing new ICE candidates from the database. We don't need a separate
        // listener here - the existing listener will catch all updates including ICE candidates.
        // The useWebRTC hook's ICE candidate handler will send our candidates automatically.
      } catch (error) {
        console.error("Error accepting call:", error);
        toast({
          title: "Call Failed",
          description:
            error instanceof Error ? error.message : "Failed to accept call",
          variant: "destructive",
        });
        setStateWithLogging("idle", "Accept call failed", {
          error: error instanceof Error ? error.message : "Unknown error",
          incomingCallId,
        });
        setIsConnecting(false);
      }
    },
    [
      state,
      localStream,
      initializeConnection,
      role,
      setIsConnecting,
      toast,
      webRTCPeerConnectionRef,
      setStateWithLogging,
    ]
  );

  const rejectIncomingCall = useCallback(
    async (incomingCallId: string) => {
      if (state !== "incoming") {
        console.warn("Cannot reject call: not in incoming state");
        return;
      }

      try {
        await supabase
          .from("calls")
          .update({ status: "rejected" })
          .eq("id", incomingCallId);

        setStateWithLogging("ended", "Call rejected by user", {
          incomingCallId,
        });
        // eslint-disable-next-line no-console
        console.log("📞 [CALL ENGINE] Call rejected:", incomingCallId);
      } catch (error) {
        console.error("Error rejecting call:", error);
        toast({
          title: "Error",
          description: "Failed to reject call",
          variant: "destructive",
        });
      }
    },
    [state, toast, setStateWithLogging]
  );

  const endCall = useCallback(async () => {
    if (!callId) return;

    try {
      const by = role;
      await endCallUtil({ callId, by, reason: "hangup" });

      setStateWithLogging("ended", "Call ended by user", {
        callId,
        by,
        reason: "hangup",
      });
      cleanupWebRTC();

      if (callChannelRef.current) {
        supabase.removeChannel(callChannelRef.current);
        callChannelRef.current = null;
      }

      if (terminationChannelRef.current) {
        supabase.removeChannel(terminationChannelRef.current);
        terminationChannelRef.current = null;
      }

      // eslint-disable-next-line no-console
      console.log("📞 [CALL ENGINE] Call ended:", callId);
    } catch (error) {
      console.error("Error ending call:", error);
      toast({
        title: "Error",
        description: "Failed to end call",
        variant: "destructive",
      });
    }
  }, [callId, role, cleanupWebRTC, toast, setStateWithLogging]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      const newMutedState = !isMuted;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !newMutedState;
      });
      setIsMuted(newMutedState);
    }
  }, [localStream, isMuted]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const newVideoOffState = !isVideoOff;
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !newVideoOffState;
      });
      setIsVideoOff(newVideoOffState);
    }
  }, [localStream, isVideoOff]);

  return {
    state,
    callId,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    startOutgoingCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
};

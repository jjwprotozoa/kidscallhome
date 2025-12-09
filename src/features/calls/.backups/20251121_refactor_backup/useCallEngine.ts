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
  role: "parent" | "child";
  localProfileId: string; // parent_id for parent, child_id for child
  remoteProfileId: string; // child_id for parent, parent_id for child
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
            console.log("📞 [CALL ENGINE] Incoming call detected:", call.id);
            setCallId(call.id);
            setState("incoming");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state, localProfileId, role]);

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
            console.log("📞 [CALL ENGINE] Call rejected or missed");
            setState("ended");
            cleanupWebRTC();
          }

          // Handle call ended
          if (
            isCallTerminal(updatedCall) &&
            oldCall &&
            !isCallTerminal(oldCall)
          ) {
            console.log("📞 [CALL ENGINE] Call ended by remote party");
            setState("ended");
            cleanupWebRTC();
            toast({
              title: "Call Ended",
              description: "The other person ended the call",
            });
          }

          // CRITICAL: Process ICE candidates from remote peer
          // This ensures we process candidates that arrive after answer is sent
          const remoteCandidateField =
            role === "parent"
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
                  console.log(
                    "📞 [CALL ENGINE] Connection established, transitioning to in_call"
                  );
                  setState("in_call");
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
        console.log(
          "📞 [CALL ENGINE] WebRTC connected, transitioning to in_call"
        );
        setState("in_call");
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
  }, [state, remoteStream, setIsConnecting, webRTCPeerConnectionRef]);

  // Redirect on ended state
  useEffect(() => {
    if (state === "ended") {
      const timeout = setTimeout(() => {
        const homePath = role === "parent" ? "/parent" : "/child";
        navigate(homePath);
      }, 2000); // Give time for cleanup

      return () => clearTimeout(timeout);
    }
  }, [state, navigate, role]);

  const startOutgoingCall = useCallback(
    async (remoteId: string) => {
      if (state !== "idle") {
        console.warn("Cannot start call: not in idle state");
        return;
      }

      try {
        setState("calling");
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
        const callData = {
          [role === "parent" ? "parent_id" : "child_id"]: localProfileId,
          [role === "parent" ? "child_id" : "parent_id"]: remoteId,
          caller_type: callerType,
          status: "ringing",
          offer: { type: offer.type, sdp: offer.sdp } as Json,
          ended_at: null, // Ensure ended_at is null for new calls
        };

        const { data: call, error } = await supabase
          .from("calls")
          .insert(
            callData as {
              parent_id: string;
              child_id: string;
              caller_type: "parent" | "child";
              status: string;
              offer: Json;
              ended_at: null;
            }
          )
          .select()
          .single();

        if (error) throw error;
        if (!call) throw new Error("Failed to create call");

        setCallId(call.id);
        console.log("📞 [CALL ENGINE] Outgoing call created:", call.id);

        // Set up ICE candidate handling
        pc.onicecandidate = async (event) => {
          if (event.candidate && call.id) {
            const candidateField =
              role === "parent"
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
                const remoteCandidateField =
                  role === "parent"
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
        setState("idle");
        setIsConnecting(false);
      }
    },
    [state, localProfileId, role, setIsConnecting, toast]
  );

  const acceptIncomingCall = useCallback(
    async (incomingCallId: string) => {
      if (state !== "incoming") {
        console.warn("Cannot accept call: not in incoming state");
        return;
      }

      try {
        // IMMEDIATE UI RESPONSE: Set state to connecting before any async work
        setState("connecting");
        setIsConnecting(true);

        const pc = webRTCPeerConnectionRef.current;
        if (!pc) {
          throw new Error("Peer connection not initialized");
        }

        // Ensure local stream is ready (should already be pre-warmed)
        if (!localStream) {
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
        console.log("📞 [CALL ENGINE] Call accepted:", incomingCallId);

        // CRITICAL: Stop connecting immediately after accepting call
        // This stops the ringtone and indicates call is being answered
        setIsConnecting(false);

        // CRITICAL: DO NOT overwrite the ICE candidate handler from useWebRTC
        // The useWebRTC hook already has a robust handler that uses the callId ref
        // Setting callId above will make that handler work automatically

        // Process existing remote ICE candidates immediately
        const remoteCandidateField =
          role === "parent" ? "child_ice_candidates" : "parent_ice_candidates";
        const remoteCandidates =
          (call[remoteCandidateField] as RTCIceCandidateInit[]) || [];

        if (remoteCandidates.length > 0) {
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
        setState("idle");
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

        setState("ended");
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
    [state, toast]
  );

  const endCall = useCallback(async () => {
    if (!callId) return;

    try {
      const by = role;
      await endCallUtil({ callId, by, reason: "hangup" });

      setState("ended");
      cleanupWebRTC();

      if (callChannelRef.current) {
        supabase.removeChannel(callChannelRef.current);
        callChannelRef.current = null;
      }

      if (terminationChannelRef.current) {
        supabase.removeChannel(terminationChannelRef.current);
        terminationChannelRef.current = null;
      }

      console.log("📞 [CALL ENGINE] Call ended:", callId);
    } catch (error) {
      console.error("Error ending call:", error);
      toast({
        title: "Error",
        description: "Failed to end call",
        variant: "destructive",
      });
    }
  }, [callId, role, cleanupWebRTC, toast]);

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

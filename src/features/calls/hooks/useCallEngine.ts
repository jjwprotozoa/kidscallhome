// src/features/calls/hooks/useCallEngine.ts
// Call engine hook - orchestration layer with role-based routing
// Imports modular components and routes based on role (child, parent, family_member)

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isCallTerminal } from "../utils/callEnding";
import { useAudioNotifications } from "./useAudioNotifications";
import { useWebRTC } from "./useWebRTC";
// Import modular components
import { useCallConnectionState } from "./modules/useCallConnectionState";
import { useCallMedia } from "./modules/useCallMedia";
import {
  useCallStateMachine,
  type CallState,
} from "./modules/useCallStateMachine";
import { useCallTermination } from "./modules/useCallTermination";
import { useExistingCallCheck } from "./modules/useExistingCallCheck";
import { useIncomingCall } from "./modules/useIncomingCall";
import { useIncomingCallSubscription } from "./modules/useIncomingCallSubscription";
// Import handlers
import { handleAdultOutgoingCall } from "./modules/handlers/adultOutgoingCallHandler";
import { handleChildOutgoingCall } from "./modules/handlers/childOutgoingCallHandler";

export interface UseCallEngineOptions {
  role: "parent" | "child" | "family_member";
  localProfileId: string; // parent_id for parent, child_id for child, family_member_id for family_member
  remoteProfileId: string; // child_id for parent/family_member, parent_id for child
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
}

// Network quality types for adaptive streaming
import type {
  ConnectionType,
  NetworkQualityLevel,
  NetworkStats,
} from "./useNetworkQuality";

export interface NetworkQualityInfo {
  qualityLevel: NetworkQualityLevel;
  connectionType: ConnectionType;
  networkStats: NetworkStats;
  isVideoPausedDueToNetwork: boolean;
  forceAudioOnly: () => void;
  enableVideoIfPossible: () => void;
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
  // Network quality for adaptive streaming (2G-5G/WiFi support)
  networkQuality: NetworkQualityInfo;
}

export const useCallEngine = ({
  role,
  localProfileId,
  remoteProfileId,
  localVideoRef,
  remoteVideoRef,
}: UseCallEngineOptions): UseCallEngineReturn => {
  const [callId, setCallId] = useState<string | null>(null);

  // Use modular state machine
  const { state, stateRef, setStateWithLogging } = useCallStateMachine(
    role,
    callId
  );

  const navigate = useNavigate();
  const { toast } = useToast();
  const callChannelRef = useRef<RealtimeChannel | null>(null);
  const answerPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
    networkQuality, // Network quality for adaptive streaming
  } = useWebRTC(callId, localVideoRef, remoteVideoRef, role === "child");

  // Audio notifications for outgoing calls
  const { playOutgoingRingtone, stopOutgoingRingtone, playCallAnswered } =
    useAudioNotifications({ enabled: true, volume: 0.7 });

  // Play outgoing ringtone when in "calling" state (waiting for answer)
  useEffect(() => {
    if (state === "calling" && callId) {
      // Outgoing call - play waiting tone
      // eslint-disable-next-line no-console
      console.log("🔔 [CALL ENGINE AUDIO] Starting outgoing waiting tone", {
        callId,
        state,
        timestamp: new Date().toISOString(),
      });
      playOutgoingRingtone();
    } else if (state === "in_call" || state === "ended" || state === "idle") {
      // Stop waiting tone when call connects or ends
      // eslint-disable-next-line no-console
      console.log("🔇 [CALL ENGINE AUDIO] Stopping outgoing waiting tone", {
        callId,
        state,
        timestamp: new Date().toISOString(),
      });
      stopOutgoingRingtone();

      // Play happy chime when call connects
      if (state === "in_call" && remoteStream) {
        playCallAnswered();
      }
    }

    // Cleanup on unmount
    return () => {
      stopOutgoingRingtone();
    };
  }, [
    state,
    callId,
    remoteStream,
    playOutgoingRingtone,
    stopOutgoingRingtone,
    playCallAnswered,
  ]);

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

  // Use modular incoming call subscription
  useIncomingCallSubscription({
    state,
    localProfileId,
    role,
    callChannelRef,
    setCallId,
    setStateWithLogging,
  });

  // Use modular existing call check
  useExistingCallCheck({
    state,
    localProfileId,
    role,
    callId,
    setCallId,
    setStateWithLogging,
  });

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

          // DIAGNOSTIC: Log UPDATE event to debug ICE candidate reception
          // eslint-disable-next-line no-console
          console.log("📡 [CALL ENGINE STATUS] UPDATE event received:", {
            callId,
            role,
            currentState: state,
            status: updatedCall.status,
            hasAnswer: !!updatedCall.answer,
            hasParentIceCandidates: !!updatedCall.parent_ice_candidates,
            parentIceCandidatesCount: Array.isArray(
              updatedCall.parent_ice_candidates
            )
              ? updatedCall.parent_ice_candidates.length
              : 0,
            hasChildIceCandidates: !!updatedCall.child_ice_candidates,
            childIceCandidatesCount: Array.isArray(
              updatedCall.child_ice_candidates
            )
              ? updatedCall.child_ice_candidates.length
              : 0,
            payloadKeys: Object.keys(payload.new || {}),
            iceConnectionState: pc?.iceConnectionState,
          });

          // Handle answer received (for outgoing calls)
          // CRITICAL: Check for both "in_call" and "active" status for compatibility
          // Also handle "connecting" state (when accepting incoming calls)
          // IMPORTANT: Only process answer if we're in "calling" state (outgoing call waiting for answer)
          // If we're in "connecting" state with a local description, we're accepting an incoming call
          // and created the answer ourselves - don't process it as a remote answer!
          if (
            state === "calling" &&
            updatedCall.answer &&
            (updatedCall.status === "in_call" ||
              updatedCall.status === "active")
          ) {
            // eslint-disable-next-line no-console
            console.log(
              "📞 [CALL ENGINE] Answer received, setting remote description"
            );
            // CRITICAL: Only set remote description if:
            // - remoteDescription is null (haven't set it yet)
            // - signalingState is "have-local-offer" (we made an offer, waiting for answer)
            // OR localDescription is null and state is not stable/closed
            // The key insight: For outgoing calls, we HAVE a localDescription (our offer)
            // and are waiting for the answer. So we should NOT check localDescription === null
            // Instead, check if signalingState === "have-local-offer" which means we're the caller
            const isWaitingForAnswer =
              pc?.signalingState === "have-local-offer";
            const canAcceptAnswer =
              pc?.remoteDescription === null &&
              pc?.signalingState !== "closed" &&
              pc?.signalingState !== "stable";

            if (
              pc &&
              canAcceptAnswer &&
              (isWaitingForAnswer || pc.localDescription === null)
            ) {
              const answerDesc =
                updatedCall.answer as unknown as RTCSessionDescriptionInit;
              try {
                await pc.setRemoteDescription(
                  new RTCSessionDescription(answerDesc)
                );
              } catch (error) {
                const err = error as Error;
                // If already set or wrong state, that's OK - might have been set elsewhere
                if (
                  !err.message?.includes("already") &&
                  !err.message?.includes("stable")
                ) {
                  console.error("Error setting remote description:", err);
                }
                return; // Don't process candidates if setting description failed
              }

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
              (role === "child" &&
                (endedBy === "parent" || endedBy === "family_member")) ||
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
            setStateWithLogging(
              "ended",
              endedByRemote ? "Call ended by remote party" : "Call ended",
              {
                dbStatus: updatedCall.status,
                endedAt: updatedCall.ended_at,
                endedBy,
                oldState: state,
              }
            );
            cleanupWebRTC();

            // Only show notification if ended by remote party (not by ourselves)
            if (endedByRemote) {
              // eslint-disable-next-line no-console
              console.log(
                "📞 [CALL ENGINE] Call ended by remote party - showing notification"
              );
              toast({
                title: "Call Ended",
                description: "The other person ended the call",
              });
            } else if (endedBySelf) {
              // eslint-disable-next-line no-console
              console.log(
                "📞 [CALL ENGINE] Call ended by local user - no notification"
              );
              // Don't show notification - user ended it themselves
            } else {
              // ended_by is not set - for backward compatibility, show notification
              // eslint-disable-next-line no-console
              console.log(
                "📞 [CALL ENGINE] Call ended (ended_by not set) - showing notification for backward compatibility"
              );
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

          // CRITICAL FIX: Supabase Realtime may not include all columns in the UPDATE payload
          // It might only include the changed columns. So we MUST fetch the latest ICE candidates
          // directly from the database to ensure we get any new candidates.
          // Only do this if we have a peer connection with remote description set (ready to add candidates)
          if (
            pc &&
            pc.remoteDescription &&
            pc.iceConnectionState !== "connected" &&
            pc.iceConnectionState !== "completed"
          ) {
            // eslint-disable-next-line no-console
            console.log(
              "🧊 [CALL ENGINE STATUS] Fetching latest ICE candidates from database...",
              {
                role,
                remoteCandidateField,
                iceConnectionState: pc.iceConnectionState,
              }
            );

            try {
              const { data: latestCall, error: fetchError } = await supabase
                .from("calls")
                .select(remoteCandidateField)
                .eq("id", callId)
                .single();

              if (fetchError) {
                console.error(
                  "❌ [CALL ENGINE STATUS] Error fetching ICE candidates:",
                  fetchError.message
                );
              } else if (latestCall) {
                const remoteCandidates =
                  (latestCall[remoteCandidateField] as RTCIceCandidateInit[]) ||
                  [];

                // eslint-disable-next-line no-console
                console.log(
                  "🧊 [CALL ENGINE STATUS] ICE candidates from database:",
                  {
                    role,
                    remoteCandidateField,
                    remoteCandidatesCount: remoteCandidates.length,
                    hasPC: !!pc,
                    hasRemoteDescription: !!pc?.remoteDescription,
                    iceConnectionState: pc?.iceConnectionState,
                  }
                );

                if (remoteCandidates.length > 0) {
                  // eslint-disable-next-line no-console
                  console.log(
                    `🧊 [CALL ENGINE STATUS] Processing ${remoteCandidates.length} ICE candidates from ${remoteCandidateField}`
                  );
                  // Process new candidates (avoid reprocessing by checking if already added)
                  let addedCount = 0;
                  for (const candidate of remoteCandidates) {
                    try {
                      // CRITICAL: Check if peer connection is still valid before processing each candidate
                      // Note: We rely on error handling to catch closed connection errors
                      // as TypeScript types don't include "closed" for signalingState/connectionState
                      if (!pc) {
                        // Peer connection is null - stop processing candidates
                        console.warn(
                          "⚠️ [CALL ENGINE STATUS] Peer connection is null, skipping remaining ICE candidates"
                        );
                        break;
                      }
                      if (!candidate.candidate) continue;
                      await pc.addIceCandidate(new RTCIceCandidate(candidate));
                      addedCount++;
                    } catch (err) {
                      const error = err as Error;
                      // Silently handle duplicates and closed connection errors - these are expected
                      if (
                        !error.message?.includes("duplicate") &&
                        !error.message?.includes("already") &&
                        !error.message?.includes("closed")
                      ) {
                        console.error(
                          "Error adding remote ICE candidate:",
                          error.message
                        );
                      }
                    }
                  }
                  // eslint-disable-next-line no-console
                  console.log(
                    `✅ [CALL ENGINE STATUS] Added ${addedCount} new ICE candidates (${
                      remoteCandidates.length - addedCount
                    } duplicates)`
                  );
                } else {
                  // eslint-disable-next-line no-console
                  console.log(
                    `⚠️ [CALL ENGINE STATUS] No ICE candidates found in ${remoteCandidateField} from database`
                  );
                }
              }
            } catch (error) {
              console.error(
                "❌ [CALL ENGINE STATUS] Exception fetching ICE candidates:",
                error
              );
            }
          } else if (!pc) {
            // eslint-disable-next-line no-console
            console.log(
              "⚠️ [CALL ENGINE STATUS] No peer connection - cannot add ICE candidates"
            );
          } else if (!pc.remoteDescription) {
            // eslint-disable-next-line no-console
            console.log(
              "⚠️ [CALL ENGINE STATUS] No remote description - cannot add ICE candidates yet"
            );
          } else {
            // eslint-disable-next-line no-console
            console.log(
              `✅ [CALL ENGINE STATUS] ICE already ${pc.iceConnectionState} - skipping ICE fetch`
            );
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

  // Use modular connection state monitoring
  useCallConnectionState({
    state,
    remoteStream,
    webRTCPeerConnectionRef,
    setIsConnecting,
    setStateWithLogging,
  });

  // NOTE: Termination polling removed - WebRTC disconnection detection (2s timeout) is reliable
  // and doesn't require extra database queries. If you need polling as a fallback, uncomment below.
  // The WebRTC oniceconnectionstatechange handler in useWebRTC.ts detects disconnection within 2 seconds.

  // Redirect on ended state - IMMEDIATE redirect (no delay)
  // Individual call screens handle their own redirects for better UX
  // This is a fallback in case the screen doesn't handle it
  useEffect(() => {
    if (state === "ended") {
      // eslint-disable-next-line no-console
      console.log("🔄 [CALL STATE] Call ended, redirecting immediately", {
        callId,
        role,
        timestamp: new Date().toISOString(),
      });
      // Immediate redirect - no delay
      const homePath =
        role === "parent"
          ? "/parent"
          : role === "family_member"
          ? "/family-member/dashboard"
          : "/child/dashboard";
      navigate(homePath, { replace: true });
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

        // Ensure peer connection is initialized before proceeding
        let pc = webRTCPeerConnectionRef.current;
        if (!pc) {
          // eslint-disable-next-line no-console
          console.log(
            "📞 [CALL ENGINE] Peer connection not initialized, initializing now..."
          );
          await initializeConnection();
          pc = webRTCPeerConnectionRef.current;
          if (!pc) {
            throw new Error("Failed to initialize peer connection");
          }
        }

        // CRITICAL: Verify tracks are added before creating offer
        const senderTracks = pc
          .getSenders()
          .map((s) => s.track)
          .filter(Boolean);
        const audioTracks = senderTracks.filter((t) => t?.kind === "audio");
        const videoTracks = senderTracks.filter((t) => t?.kind === "video");

        console.warn("📹 [CALL ENGINE] Tracks before creating offer:", {
          audioTracks: audioTracks.length,
          videoTracks: videoTracks.length,
          totalTracks: senderTracks.length,
          audioEnabled: audioTracks.every((t) => t?.enabled),
        });

        if (senderTracks.length === 0) {
          throw new Error(
            "Cannot create offer: no media tracks found. Please ensure camera/microphone permissions are granted."
          );
        }

        if (audioTracks.length === 0) {
          console.error(
            "❌ [CALL ENGINE] WARNING: No audio tracks found! Audio will not work."
          );
        }

        // Create offer with explicit media track requests
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });

        // CRITICAL: Verify SDP includes audio codecs
        const hasAudio = offer.sdp?.includes("m=audio");
        const hasVideo = offer.sdp?.includes("m=video");
        console.warn("📋 [CALL ENGINE] Offer SDP verification:", {
          hasAudio,
          hasVideo,
          sdpLength: offer.sdp?.length,
        });

        if (!hasAudio && !hasVideo) {
          throw new Error(
            "Offer SDP missing media tracks - ensure tracks are added before creating offer"
          );
        }

        if (!hasAudio) {
          console.error(
            "❌ [CALL ENGINE] WARNING: Offer SDP has no audio! Audio will not work."
          );
        }

        await pc.setLocalDescription(offer);

        // ROLE-BASED ROUTING: Use modular handlers for call record creation
        // This ensures family_member works exactly like parent
        let result;
        if (role === "child") {
          result = await handleChildOutgoingCall({
            localProfileId,
            remoteId,
            offer,
          });
        } else {
          // parent or family_member - same handler
          result = await handleAdultOutgoingCall({
            role,
            localProfileId,
            remoteId,
            offer,
          });
        }

        const callId = result.callId;
        setCallId(callId);

        // Verify the call record was created correctly
        const { data: verifyCall, error: verifyError } = await supabase
          .from("calls")
          .select("*")
          .eq("id", callId)
          .single();

        if (verifyError) {
          console.error(
            "❌ [CALL ENGINE] Error verifying call record:",
            verifyError
          );
        } else {
          console.warn("✅ [CALL ENGINE] Call record verification:", {
            callId: verifyCall.id,
            child_id: verifyCall.child_id,
            parent_id: verifyCall.parent_id,
            family_member_id: verifyCall.family_member_id,
            caller_type: verifyCall.caller_type,
            status: verifyCall.status,
            recipientShouldBe: remoteId,
            family_member_id_matches: verifyCall.family_member_id === remoteId,
            parent_id_matches: verifyCall.parent_id === remoteId,
          });
        }

        const call = verifyCall || { id: callId };

        // Set up ICE candidate handling
        pc.onicecandidate = async (event) => {
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

        // Listen for answer
        // CRITICAL: Use same channel naming as parent/child handlers for consistency
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
              // CRITICAL: Log all UPDATE events to diagnose missing answer
              console.warn("📡 [CALL ENGINE] UPDATE event received:", {
                callId,
                subscriptionActive: answerChannel.state === "joined",
                channelName: `call:${callId}`,
                hasNew: !!payload.new,
                hasOld: !!payload.old,
                timestamp: new Date().toISOString(),
                role,
                // Log the actual payload to see what changed
                newPayload: payload.new
                  ? {
                      hasAnswer: !!(payload.new as { answer?: unknown }).answer,
                      status: (payload.new as { status?: string }).status,
                      caller_type: (payload.new as { caller_type?: string })
                        .caller_type,
                      family_member_id: (
                        payload.new as { family_member_id?: string }
                      ).family_member_id,
                      parent_id: (payload.new as { parent_id?: string })
                        .parent_id,
                    }
                  : null,
              });

              const updatedCall = payload.new as {
                answer: Json | null;
                status: string;
                parent_ice_candidates?: Json | null;
                child_ice_candidates?: Json | null;
              };
              const oldCallPayload = payload.old as { status: string } | null;
              const pc = webRTCPeerConnectionRef.current;

              console.warn("📡 [CALL ENGINE] Update details:", {
                hasAnswer: !!updatedCall.answer,
                hadAnswer: !!oldCallPayload,
                status: updatedCall.status,
                oldStatus: oldCallPayload?.status,
                hasRemoteDesc: !!pc?.remoteDescription,
                currentState: stateRef.current,
              });

              // CRITICAL: Process answer when it appears - don't wait for status change
              // This matches the old childCallHandler pattern EXACTLY
              // Only process answer if remoteDescription is not already set (prevents duplicate processing)
              // IMPORTANT: For outgoing calls (caller), we HAVE a localDescription (our offer) and are
              // waiting for the answer. So we should NOT check localDescription === null.
              // Instead, check if signalingState === "have-local-offer" which means we're the caller waiting for answer
              const isWaitingForAnswer =
                pc?.signalingState === "have-local-offer";
              // CRITICAL: Only accept answer if:
              // 1. Remote description is not already set
              // 2. Signaling state is "have-local-offer" (we sent offer, waiting for answer)
              //    This is the ONLY valid state to accept an answer
              // Note: We don't check connectionState here as TypeScript types don't include "closed"
              // The error handler will catch attempts to use a closed connection
              const canAcceptAnswer =
                pc?.remoteDescription === null &&
                pc?.signalingState === "have-local-offer";

              if (
                updatedCall.answer &&
                pc &&
                canAcceptAnswer &&
                isWaitingForAnswer
              ) {
                try {
                  // Double-check remote description is still null before setting (race condition protection)
                  if (pc.remoteDescription !== null) {
                    console.warn(
                      "⚠️ [CALL ENGINE] Answer received but remoteDescription already set - skipping",
                      {
                        callId,
                        signalingState: pc.signalingState,
                      }
                    );
                    return;
                  }
                  console.warn(
                    "📞 [CALL ENGINE] Received answer, setting remote description...",
                    {
                      callId,
                      hasAnswer: !!updatedCall.answer,
                      status: updatedCall.status,
                      currentRemoteDesc: !!pc.remoteDescription,
                      currentLocalDesc: !!pc.localDescription,
                      signalingState: pc.signalingState,
                    }
                  );
                  const answerDesc =
                    updatedCall.answer as unknown as RTCSessionDescriptionInit;
                  await pc.setRemoteDescription(
                    new RTCSessionDescription(answerDesc)
                  );
                  console.warn(
                    "✅ [CALL ENGINE] Remote description set successfully from answer"
                  );

                  // Process queued ICE candidates now that remote description is set
                  for (const candidate of iceCandidatesQueue.current) {
                    try {
                      // CRITICAL: Check if peer connection is still valid before processing each candidate
                      // Note: We rely on error handling to catch closed connection errors
                      // as TypeScript types don't include "closed" for signalingState/connectionState
                      if (!pc) {
                        // Peer connection is null - stop processing candidates
                        console.warn(
                          "⚠️ [CALL ENGINE] Peer connection is null, skipping remaining queued ICE candidates"
                        );
                        break;
                      }
                      await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (err) {
                      const error = err as Error;
                      // Silently handle duplicate candidates and closed connection errors
                      if (
                        !error.message?.includes("duplicate") &&
                        !error.message?.includes("already") &&
                        !error.message?.includes("closed")
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
                  // This matches the old handler exactly - must be called before state transition
                  setIsConnecting(false);

                  console.warn(
                    "✅ [CALL ENGINE] Call connected! Child received answer from recipient."
                  );

                  // CRITICAL: Process any existing ICE candidates from parent/family_member immediately
                  // Parent/family_member may have already sent candidates before child's listener processed the answer
                  // Process in background but await properly to ensure candidates are added
                  // This matches the old handler pattern EXACTLY
                  (async () => {
                    try {
                      // Child reads from parent_ice_candidates for BOTH parent and family_member calls
                      // Family members write to parent_ice_candidates just like parents do
                      const { data: currentCall } = await supabase
                        .from("calls")
                        .select("parent_ice_candidates")
                        .eq("id", callId)
                        .maybeSingle();

                      if (currentCall) {
                        const existingCandidates =
                          (currentCall.parent_ice_candidates as unknown as
                            | RTCIceCandidateInit[]
                            | null) || null;
                        if (
                          existingCandidates &&
                          Array.isArray(existingCandidates) &&
                          existingCandidates.length > 0
                        ) {
                          console.warn(
                            "🧊 [CALL ENGINE] Processing existing ICE candidates from parent/family_member (immediate after answer):",
                            {
                              count: existingCandidates.length,
                              hasRemoteDescription: !!pc.remoteDescription,
                              iceConnectionState: pc.iceConnectionState,
                            }
                          );

                          for (const candidate of existingCandidates) {
                            try {
                              // CRITICAL: Check if peer connection is still valid before processing each candidate
                              // Note: We rely on error handling to catch closed connection errors
                              // as TypeScript types don't include "closed" for signalingState/connectionState
                              if (!pc) {
                                // Peer connection is null - stop processing candidates
                                console.warn(
                                  "⚠️ [CALL ENGINE] Peer connection is null, skipping remaining existing ICE candidates"
                                );
                                break;
                              }
                              if (!candidate.candidate) continue;
                              if (pc.remoteDescription) {
                                // CRITICAL: Await to ensure candidate is added properly
                                await pc.addIceCandidate(
                                  new RTCIceCandidate(candidate)
                                );
                              } else {
                                iceCandidatesQueue.current.push(candidate);
                              }
                            } catch (err) {
                              const error = err as Error;
                              // Silently handle duplicate candidates and closed connection errors
                              if (
                                !error.message?.includes("duplicate") &&
                                !error.message?.includes("already") &&
                                !error.message?.includes("closed")
                              ) {
                                console.error(
                                  "❌ [CALL ENGINE] Error adding existing ICE candidate:",
                                  error.message
                                );
                              }
                            }
                          }
                          console.warn(
                            "✅ [CALL ENGINE] Finished processing existing ICE candidates from parent/family_member"
                          );
                        }
                      }
                    } catch (error) {
                      console.error(
                        "❌ [CALL ENGINE] Error fetching existing ICE candidates:",
                        error
                      );
                      // Don't throw - connection might still work
                    }
                  })(); // IIFE - runs in background without blocking

                  // CRITICAL: Transition state from "calling" to "connecting" when answer is received
                  // This updates the UI to show the call is being answered
                  if (stateRef.current === "calling") {
                    setStateWithLogging(
                      "connecting",
                      "Answer received from recipient",
                      {
                        callId,
                        status: updatedCall.status,
                      }
                    );
                  }

                  // Stop polling since we received the answer via real-time
                  if (answerPollingIntervalRef.current) {
                    clearInterval(answerPollingIntervalRef.current);
                    answerPollingIntervalRef.current = null;
                  }
                } catch (error: unknown) {
                  console.error(
                    "❌ [CALL ENGINE] Error setting remote description from answer:",
                    error
                  );
                  // Don't throw - connection might still work
                }
              } else if (
                updatedCall.answer &&
                pc &&
                pc.remoteDescription !== null
              ) {
                // Answer already processed - log for debugging
                console.warn(
                  "⚠️ [CALL ENGINE] Answer received but remoteDescription already set - skipping"
                );
              }

              // CRITICAL: Also handle status changes even if answer isn't present yet
              // This handles cases where status changes to "in_call" or "active" before answer is set
              const statusChanged =
                oldCallPayload?.status !== updatedCall.status &&
                (updatedCall.status === "in_call" ||
                  updatedCall.status === "active") &&
                stateRef.current === "calling";

              if (statusChanged) {
                console.warn(
                  "📞 [CALL ENGINE] Call status changed to accepted, transitioning to connecting",
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

              // CRITICAL: Process ICE candidates on EVERY UPDATE event (not just when answer is received)
              // This matches the old childCallHandler pattern - ICE candidates can arrive after answer
              // Child reads parent/family_member's candidates from parent_ice_candidates field
              // This works for both parent and family_member calls (they both write to parent_ice_candidates)
              const candidatesToProcess =
                (updatedCall.parent_ice_candidates as unknown as
                  | RTCIceCandidateInit[]
                  | null
                  | undefined) || null;

              if (
                candidatesToProcess &&
                Array.isArray(candidatesToProcess) &&
                pc
              ) {
                // Only log summary to reduce console spam
                const processedCount = candidatesToProcess.length;
                if (processedCount > 0 && processedCount % 10 === 0) {
                  console.warn(
                    `🧊 [CALL ENGINE] Processing ICE candidates (from ${
                      role === "child" ? "parent/family_member" : "child"
                    }):`,
                    {
                      count: processedCount,
                      iceConnectionState: pc.iceConnectionState,
                      hasRemoteDesc: !!pc.remoteDescription,
                    }
                  );
                }

                for (const candidate of candidatesToProcess) {
                  try {
                    // CRITICAL: Check if peer connection is still valid before processing each candidate
                    // Note: We rely on error handling to catch closed connection errors
                    // as TypeScript types don't include "closed" for signalingState/connectionState
                    if (!pc) {
                      // Peer connection is null - stop processing candidates
                      console.warn(
                        "⚠️ [CALL ENGINE] Peer connection is null, skipping remaining ICE candidates"
                      );
                      break;
                    }
                    // Validate candidate before adding
                    if (!candidate.candidate) {
                      continue; // Skip invalid candidates silently
                    }

                    if (pc.remoteDescription) {
                      // CRITICAL: Only add if remote description is set (answer received)
                      const iceCandidate = new RTCIceCandidate(candidate);
                      await pc.addIceCandidate(iceCandidate);
                      // Silently process - only log errors
                    } else {
                      // Queue candidates if remote description not set yet (answer not received)
                      iceCandidatesQueue.current.push(candidate);
                    }
                  } catch (err) {
                    const error = err as Error;
                    // Silently handle duplicate candidates and closed connection errors
                    if (
                      !error.message?.includes("duplicate") &&
                      !error.message?.includes("already") &&
                      !error.message?.includes("closed")
                    ) {
                      console.error(
                        "❌ [CALL ENGINE] Error adding ICE candidate:",
                        error.message
                      );
                    }
                  }
                }
              }
            }
          )
          .subscribe((status, err) => {
            console.warn("📡 [CALL ENGINE] Answer subscription status:", {
              callId,
              status,
              error: err,
              channelName: `call:${callId}`,
            });
            if (status === "SUBSCRIBED") {
              console.warn(
                "✅ [CALL ENGINE] Successfully subscribed to answer updates"
              );
            } else if (status === "CHANNEL_ERROR" || err) {
              console.error(
                "❌ [CALL ENGINE] Answer subscription error:",
                err || "Channel error"
              );
            }
          });

        callChannelRef.current = answerChannel;

        // CRITICAL: Start polling for answer updates as fallback if real-time subscription fails
        // This ensures the child's UI updates even if UPDATE events aren't received
        // Poll every 2 seconds while in "calling" state
        const startAnswerPolling = () => {
          // Clear any existing polling interval
          if (answerPollingIntervalRef.current) {
            clearInterval(answerPollingIntervalRef.current);
          }

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
              console.warn("🔄 [CALL ENGINE] Polling for answer update...", {
                callId,
                currentState: stateRef.current,
                localProfileId,
                role,
              });

              // CRITICAL: First verify we can read the call at all
              // This helps diagnose RLS issues
              const { data: testRead, error: testError } = await supabase
                .from("calls")
                .select("id, child_id, caller_type")
                .eq("id", callId)
                .single();

              if (testError) {
                console.error(
                  "❌ [CALL ENGINE] CRITICAL: Cannot read call record at all!",
                  {
                    error: testError.message,
                    errorCode: testError.code,
                    callId,
                    localProfileId,
                    role,
                    hint: "RLS policy is blocking child from reading call. Check 'Children can view their own calls' policy.",
                  }
                );
                return;
              }

              if (!testRead) {
                console.error(
                  "❌ [CALL ENGINE] Call record not found:",
                  callId
                );
                return;
              }

              console.warn("✅ [CALL ENGINE] Can read call record:", {
                callId,
                child_id: testRead.child_id,
                caller_type: testRead.caller_type,
                matchesLocalProfile: testRead.child_id === localProfileId,
              });

              // CRITICAL: Try to read the full call record first
              // If that fails due to RLS, try reading just the status and answer fields separately
              let polledCall: {
                answer: unknown;
                status: string;
                caller_type?: string;
                family_member_id?: string;
                parent_id?: string;
                child_id?: string;
              } | null = null;
              let error: {
                message: string;
                code?: string;
                details?: string;
                hint?: string;
              } | null = null;

              // CRITICAL: Filter by the correct ID field based on user role
              // - child: filter by child_id
              // - parent: filter by parent_id
              // - family_member: filter by family_member_id
              // This ensures RLS policies work correctly for each role
              let query = supabase
                .from("calls")
                .select(
                  "answer, status, caller_type, family_member_id, parent_id, child_id"
                )
                .eq("id", callId);

              // Add role-specific filter to help with RLS
              if (role === "child") {
                query = query.eq("child_id", localProfileId);
              } else if (role === "parent") {
                query = query.eq("parent_id", localProfileId);
              } else if (role === "family_member") {
                query = query.eq("family_member_id", localProfileId);
              }

              const { data: fullCall, error: fullError } = await query.single();

              if (fullError) {
                console.warn(
                  "⚠️ [CALL ENGINE] Error reading full call record, trying individual fields:",
                  {
                    error: fullError.message,
                    errorCode: fullError.code,
                    callId,
                    role,
                  }
                );
                error = fullError;

                // Fallback: Try reading status and answer separately
                const { data: statusData } = await supabase
                  .from("calls")
                  .select("status")
                  .eq("id", callId)
                  .single();
                const { data: answerData } = await supabase
                  .from("calls")
                  .select("answer")
                  .eq("id", callId)
                  .single();

                if (statusData || answerData) {
                  polledCall = {
                    status: statusData?.status || "ringing",
                    answer: answerData?.answer || null,
                    caller_type: undefined,
                    family_member_id: undefined,
                    parent_id: undefined,
                    child_id: undefined,
                  };
                }
              } else {
                polledCall = fullCall;
              }

              if (error) {
                console.warn("⚠️ [CALL ENGINE] Error polling for answer:", {
                  error: error.message,
                  errorCode: error.code,
                  errorDetails: error.details,
                  errorHint: error.hint,
                  callId,
                  role,
                  // This helps diagnose RLS issues
                  hint: "If this is a permission error, check RLS policies for children reading calls",
                });
                return;
              }

              // CRITICAL: Log the raw answer to see if it's actually there
              const answerType = polledCall?.answer
                ? (polledCall.answer as { type?: string })?.type
                : null;
              const answerSdpLength = polledCall?.answer
                ? (polledCall.answer as { sdp?: string })?.sdp?.length
                : null;

              console.warn("🔄 [CALL ENGINE] Poll result:", {
                callId,
                hasAnswer: !!polledCall?.answer,
                answerType,
                answerSdpLength,
                status: polledCall?.status,
                caller_type: polledCall?.caller_type,
                family_member_id: polledCall?.family_member_id,
                parent_id: polledCall?.parent_id,
                child_id: polledCall?.child_id,
                hasRemoteDesc:
                  !!webRTCPeerConnectionRef.current?.remoteDescription,
                role,
                // This helps verify the call record structure
                isFamilyMemberCall: !!polledCall?.family_member_id,
                isParentCall: !!polledCall?.parent_id,
                // Log raw answer object structure
                answerIsObject: typeof polledCall?.answer === "object",
                answerIsNull: polledCall?.answer === null,
                answerIsUndefined: polledCall?.answer === undefined,
              });

              // CRITICAL: Check if status changed to 'active' or 'in_call' - this means call was answered
              // Even if we can't read the answer field due to RLS, status change indicates answer
              const statusIndicatesAnswer =
                polledCall?.status === "active" ||
                polledCall?.status === "in_call";
              const hasAnswerField = !!polledCall?.answer;

              if (
                statusIndicatesAnswer &&
                !hasAnswerField &&
                stateRef.current === "calling"
              ) {
                console.error(
                  "⚠️ [CALL ENGINE] CRITICAL: Call status indicates answer but answer field is null - RLS blocking answer field!",
                  {
                    callId,
                    status: polledCall.status,
                    hasAnswer: hasAnswerField,
                    role,
                    isFamilyMemberCall: !!polledCall.family_member_id,
                    hint: "The call was answered (status='active') but child cannot read the answer field. This is an RLS issue. Attempting workaround...",
                  }
                );

                // WORKAROUND: Try to fetch the answer directly using a different approach
                // Query the call record again with just the answer field to see if RLS blocks it
                const { data: answerCheck, error: answerError } = await supabase
                  .from("calls")
                  .select("answer")
                  .eq("id", callId)
                  .single();

                if (answerError) {
                  console.error(
                    "❌ [CALL ENGINE] Cannot read answer field due to RLS:",
                    {
                      error: answerError.message,
                      errorCode: answerError.code,
                      errorDetails: (answerError as { details?: string })
                        .details,
                      errorHint: (answerError as { hint?: string }).hint,
                      callId,
                      hint: "RLS policy is blocking child from reading answer field. Migration 20251217000002 may not be applied.",
                    }
                  );
                } else if (answerCheck?.answer) {
                  // We can read it! Process it
                  console.warn(
                    "✅ [CALL ENGINE] Found answer via direct query (RLS workaround)"
                  );
                  const pc = webRTCPeerConnectionRef.current;
                  if (pc && pc.remoteDescription === null) {
                    const answerDesc =
                      answerCheck.answer as unknown as RTCSessionDescriptionInit;
                    await pc.setRemoteDescription(
                      new RTCSessionDescription(answerDesc)
                    );
                    setIsConnecting(false);
                    if (stateRef.current === "calling") {
                      setStateWithLogging(
                        "connecting",
                        "Answer received (via RLS workaround)",
                        {
                          callId,
                          status: polledCall.status,
                        }
                      );
                    }
                    // Process ICE candidates (same as normal flow)
                    // ... (will be handled by the UPDATE event or next poll)
                  }
                } else {
                  // Status says answered but we truly can't read answer - transition based on status
                  console.warn(
                    "⚠️ [CALL ENGINE] Status indicates answer but cannot read answer field. Transitioning based on status change."
                  );
                  setStateWithLogging(
                    "connecting",
                    "Call accepted (status indicates answer, but answer field not readable)",
                    {
                      callId,
                      status: polledCall.status,
                    }
                  );
                  setIsConnecting(false);
                }
              }

              // If answer is present but we haven't processed it yet, process it now
              // This matches the old handler pattern EXACTLY
              if (polledCall?.answer) {
                const pc = webRTCPeerConnectionRef.current;
                if (pc && pc.remoteDescription === null) {
                  try {
                    console.warn(
                      "📞 [CALL ENGINE] Answer found via polling (real-time subscription may have missed it)",
                      {
                        callId,
                        hasAnswer: !!polledCall.answer,
                        status: polledCall.status,
                      }
                    );

                    // Process the answer (same logic as in the UPDATE handler)
                    const answerDesc =
                      polledCall.answer as unknown as RTCSessionDescriptionInit;
                    await pc.setRemoteDescription(
                      new RTCSessionDescription(answerDesc)
                    );
                    console.warn(
                      "✅ [CALL ENGINE] Remote description set from polled answer"
                    );

                    // Process queued ICE candidates now that remote description is set
                    for (const candidate of iceCandidatesQueue.current) {
                      try {
                        await pc.addIceCandidate(
                          new RTCIceCandidate(candidate)
                        );
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
                    // This matches the old handler exactly - must be called before state transition
                    setIsConnecting(false);

                    console.warn(
                      "✅ [CALL ENGINE] Call connected! Child received answer from recipient (via polling)."
                    );

                    // CRITICAL: Process any existing ICE candidates from parent/family_member immediately
                    // This matches the old handler pattern EXACTLY
                    (async () => {
                      try {
                        // Child reads from parent_ice_candidates for BOTH parent and family_member calls
                        // Family members write to parent_ice_candidates just like parents do
                        const { data: currentCall } = await supabase
                          .from("calls")
                          .select("parent_ice_candidates")
                          .eq("id", callId)
                          .maybeSingle();

                        if (currentCall) {
                          const existingCandidates =
                            (currentCall.parent_ice_candidates as unknown as
                              | RTCIceCandidateInit[]
                              | null) || null;
                          if (
                            existingCandidates &&
                            Array.isArray(existingCandidates) &&
                            existingCandidates.length > 0
                          ) {
                            console.warn(
                              "🧊 [CALL ENGINE] Processing existing ICE candidates from parent/family_member (immediate after answer via polling):",
                              {
                                count: existingCandidates.length,
                                hasRemoteDescription: !!pc.remoteDescription,
                                iceConnectionState: pc.iceConnectionState,
                              }
                            );

                            for (const candidate of existingCandidates) {
                              try {
                                if (!candidate.candidate) continue;
                                if (pc.remoteDescription) {
                                  // CRITICAL: Await to ensure candidate is added properly
                                  await pc.addIceCandidate(
                                    new RTCIceCandidate(candidate)
                                  );
                                } else {
                                  iceCandidatesQueue.current.push(candidate);
                                }
                              } catch (err) {
                                const error = err as Error;
                                if (
                                  !error.message?.includes("duplicate") &&
                                  !error.message?.includes("already")
                                ) {
                                  console.error(
                                    "❌ [CALL ENGINE] Error adding existing ICE candidate:",
                                    error.message
                                  );
                                }
                              }
                            }
                            console.warn(
                              "✅ [CALL ENGINE] Finished processing existing ICE candidates from parent/family_member"
                            );
                          }
                        }
                      } catch (error) {
                        console.error(
                          "❌ [CALL ENGINE] Error fetching existing ICE candidates:",
                          error
                        );
                        // Don't throw - connection might still work
                      }
                    })(); // IIFE - runs in background without blocking

                    // CRITICAL: Transition state from "calling" to "connecting" when answer is received
                    if (stateRef.current === "calling") {
                      setStateWithLogging(
                        "connecting",
                        "Answer received via polling",
                        {
                          callId,
                          status: polledCall.status,
                        }
                      );
                    }

                    // Stop polling since we found the answer
                    if (answerPollingIntervalRef.current) {
                      clearInterval(answerPollingIntervalRef.current);
                      answerPollingIntervalRef.current = null;
                    }
                  } catch (error: unknown) {
                    console.error(
                      "❌ [CALL ENGINE] Error setting remote description from polled answer:",
                      error
                    );
                    // Don't throw - connection might still work
                  }
                }
              }
            } catch (pollError) {
              console.error(
                "❌ [CALL ENGINE] Error in answer polling:",
                pollError
              );
            }
          }, 2000); // Poll every 2 seconds
        };

        // Start polling immediately
        console.warn("🔄 [CALL ENGINE] Starting answer polling fallback", {
          callId,
          role,
        });
        startAnswerPolling();

        // CRITICAL: Check if answer is already present (race condition protection)
        // This handles cases where the recipient accepts before subscription is fully active
        // This matches the pattern used in parent-to-child calls
        console.warn("🔄 [CALL ENGINE] Checking for existing answer...", {
          callId,
        });
        const { data: currentCall, error: currentCallError } = await supabase
          .from("calls")
          .select("answer, status")
          .eq("id", callId)
          .single();

        if (currentCallError) {
          console.warn(
            "⚠️ [CALL ENGINE] Error checking for existing answer:",
            currentCallError.message
          );
        } else {
          console.warn("🔄 [CALL ENGINE] Initial answer check result:", {
            callId,
            hasAnswer: !!currentCall?.answer,
            status: currentCall?.status,
          });
        }

        if (currentCall?.answer) {
          console.warn(
            "📞 [CALL ENGINE] Answer already present when subscription set up - processing immediately",
            {
              callId,
              hasAnswer: !!currentCall.answer,
              status: currentCall.status,
            }
          );
          // Process the answer immediately
          const pc = webRTCPeerConnectionRef.current;
          if (pc && pc.remoteDescription === null) {
            const answerDesc =
              currentCall.answer as unknown as RTCSessionDescriptionInit;
            await pc.setRemoteDescription(
              new RTCSessionDescription(answerDesc)
            );
            console.warn(
              "✅ [CALL ENGINE] Remote description set from existing answer"
            );

            // Process queued ICE candidates
            const queuedCount = iceCandidatesQueue.current.length;
            if (queuedCount > 0) {
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
            }

            // Process remote ICE candidates
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

            if (stateRef.current === "calling") {
              setStateWithLogging(
                "connecting",
                "Answer already present when subscription set up",
                {
                  callId: call.id,
                  status: currentCall.status,
                }
              );
            }
            setIsConnecting(false);

            // Stop polling since answer was already present
            if (answerPollingIntervalRef.current) {
              clearInterval(answerPollingIntervalRef.current);
              answerPollingIntervalRef.current = null;
            }

            console.warn(
              "✅ [CALL ENGINE] Call connected! Answer processed from existing state."
            );
          }
        }
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
      stateRef, // Ref is stable, but included to satisfy linter
      localProfileId,
      role,
      setIsConnecting,
      toast,
      setStateWithLogging,
      webRTCPeerConnectionRef,
      initializeConnection,
      iceCandidatesQueue, // Ref from useWebRTC - stable but included to satisfy linter
    ]
  );

  // Use modular incoming call handling
  const { acceptIncomingCall, rejectIncomingCall } = useIncomingCall({
    role,
    localProfileId,
    localStream,
    webRTCPeerConnectionRef,
    initializeConnection,
    setStateWithLogging,
    setIsConnecting,
    setCallId,
    cleanupWebRTC, // CRITICAL: Pass cleanup function to release camera on reject/error
  });

  // Use modular termination
  const { endCall } = useCallTermination({
    callId,
    role,
    callChannelRef,
    terminationChannelRef,
    answerPollingIntervalRef,
    cleanupWebRTC,
    setStateWithLogging,
  });

  // Use modular media controls
  const { isMuted, isVideoOff, toggleMute, toggleVideo } =
    useCallMedia(localStream);

  // Cleanup polling interval when state changes from "calling" to something else
  useEffect(() => {
    if (state !== "calling" && answerPollingIntervalRef.current) {
      clearInterval(answerPollingIntervalRef.current);
      answerPollingIntervalRef.current = null;
    }
  }, [state]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (answerPollingIntervalRef.current) {
        clearInterval(answerPollingIntervalRef.current);
        answerPollingIntervalRef.current = null;
      }
    };
  }, []);

  // CRITICAL: Cleanup WebRTC on unmount to release camera/microphone
  // This ensures the camera stops when navigating away from the call screen
  useEffect(() => {
    return () => {
      // eslint-disable-next-line no-console
      console.log(
        "🧹 [CALL ENGINE] Component unmounting, cleaning up WebRTC resources"
      );
      cleanupWebRTC(true); // Force cleanup to release camera
    };
  }, [cleanupWebRTC]);

  // CRITICAL FIX: Poll for ICE candidates while in "connecting" state
  // Supabase Realtime UPDATE events may not include all columns, so we need
  // to actively fetch ICE candidates from the database to ensure connection completes
  const icePollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pc = webRTCPeerConnectionRef.current;

    // Only poll when in connecting state with an active call and peer connection
    if (state !== "connecting" || !callId || !pc || !pc.remoteDescription) {
      // Clear any existing polling when not in connecting state
      if (icePollingIntervalRef.current) {
        clearInterval(icePollingIntervalRef.current);
        icePollingIntervalRef.current = null;
      }
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      "🧊 [ICE POLLING] Starting ICE candidate polling for call:",
      callId
    );

    const remoteCandidateField =
      role === "parent" || role === "family_member"
        ? "child_ice_candidates"
        : "parent_ice_candidates";

    const pollForIceCandidates = async () => {
      const currentPc = webRTCPeerConnectionRef.current;

      // Stop polling if connection is established or failed
      if (
        !currentPc ||
        currentPc.iceConnectionState === "connected" ||
        currentPc.iceConnectionState === "completed" ||
        currentPc.iceConnectionState === "failed" ||
        currentPc.iceConnectionState === "closed"
      ) {
        // eslint-disable-next-line no-console
        console.log(
          `🧊 [ICE POLLING] Stopping - iceConnectionState: ${currentPc?.iceConnectionState}`
        );
        if (icePollingIntervalRef.current) {
          clearInterval(icePollingIntervalRef.current);
          icePollingIntervalRef.current = null;
        }
        return;
      }

      try {
        const { data: latestCall, error: fetchError } = await supabase
          .from("calls")
          .select(remoteCandidateField)
          .eq("id", callId)
          .single();

        if (fetchError) {
          console.error(
            "❌ [ICE POLLING] Error fetching ICE candidates:",
            fetchError.message
          );
          return;
        }

        if (latestCall) {
          const remoteCandidates =
            (latestCall[remoteCandidateField] as RTCIceCandidateInit[]) || [];

          if (remoteCandidates.length > 0 && currentPc.remoteDescription) {
            // eslint-disable-next-line no-console
            console.log(
              `🧊 [ICE POLLING] Found ${remoteCandidates.length} ICE candidates, processing...`
            );

            let addedCount = 0;
            for (const candidate of remoteCandidates) {
              try {
                if (!candidate.candidate) continue;
                await currentPc.addIceCandidate(new RTCIceCandidate(candidate));
                addedCount++;
              } catch (err) {
                // Silently handle duplicates - this is expected
              }
            }

            if (addedCount > 0) {
              // eslint-disable-next-line no-console
              console.log(
                `✅ [ICE POLLING] Added ${addedCount} new ICE candidates`
              );
            }
          }
        }
      } catch (error) {
        console.error("❌ [ICE POLLING] Exception:", error);
      }
    };

    // Poll immediately and then every 500ms
    pollForIceCandidates();
    icePollingIntervalRef.current = setInterval(pollForIceCandidates, 500);

    // Cleanup on unmount or state change
    return () => {
      if (icePollingIntervalRef.current) {
        clearInterval(icePollingIntervalRef.current);
        icePollingIntervalRef.current = null;
      }
    };
  }, [state, callId, role, webRTCPeerConnectionRef]);

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
    // Network quality for adaptive streaming (2G-5G/WiFi support)
    networkQuality,
  };
};

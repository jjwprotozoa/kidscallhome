// src/features/calls/hooks/useCallEngine.ts
// Call engine hook - orchestration layer with role-based routing
// Imports modular components and routes based on role (child, parent, family_member)

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { safeLog } from "@/utils/security";
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
  // Battery status for low-battery notifications
  batteryStatus: import("../webrtc/qualityController").BatteryStatus | null;
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

  // Update activeCallIdRef when callId changes
  useEffect(() => {
    activeCallIdRef.current = callId;
    // Reset answer tracking when callId changes
    if (callId) {
      answerAppliedRef.current = false;
      answerSdpHashRef.current = null;
    }
  }, [callId]);

  const navigate = useNavigate();
  const { toast } = useToast();
  const callChannelRef = useRef<RealtimeChannel | null>(null);
  const answerPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const terminationChannelRef = useRef<RealtimeChannel | null>(null);
  const initializationRef = useRef(false);
  // Track processed ICE candidates to avoid duplicates
  const processedIceCandidatesRef = useRef<Set<string>>(new Set());
  // Idempotent answer application tracking
  const answerAppliedRef = useRef(false);
  const answerSdpHashRef = useRef<string | null>(null);
  const activeCallIdRef = useRef<string | null>(null);

  // SDP hash function for idempotency checking
  const sdpHash = useCallback((sdp?: string): string | null => {
    if (!sdp) return null;
    // Cheap stable hash - good enough for idempotency
    let h = 0;
    for (let i = 0; i < sdp.length; i++) {
      h = (h * 31 + sdp.charCodeAt(i)) | 0;
    }
    return String(h);
  }, []);

  // Stop answer watchers (polling + unsubscribe)
  const stopAnswerWatchers = useCallback(() => {
    if (answerPollingIntervalRef.current) {
      clearInterval(answerPollingIntervalRef.current);
      answerPollingIntervalRef.current = null;
    }
    // Note: We don't unsubscribe from realtime here as it's used for other updates
    // But we mark answer as applied so it won't be processed again
  }, []);

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
    reconnecting, // Reconnecting state
    setUserMuted, // Function to update user's mute state in WebRTC
    setUserVideoOff, // Function to update user's video-off state in WebRTC
    batteryStatus, // Battery status for low-battery notifications
  } = useWebRTC(callId, localVideoRef, remoteVideoRef, role === "child");

  // Idempotent answer application function
  // NOTE: Must be defined AFTER useWebRTC() so webRTCPeerConnectionRef and iceCandidatesQueue are available
  const applyAnswerIdempotent = useCallback(
    async (
      answer: RTCSessionDescriptionInit,
      callId: string
    ): Promise<boolean> => {
      const pc = webRTCPeerConnectionRef.current;
      if (!pc) {
        console.warn("⚠️ [CALL ENGINE] No peer connection for answer");
        return false;
      }

      // Ignore if this callback is stale (old call/listener)
      if (activeCallIdRef.current !== callId) {
        console.warn("⚠️ [CALL ENGINE] Answer for different callId, ignoring", {
          activeCallId: activeCallIdRef.current,
          answerCallId: callId,
        });
        return false;
      }

      const hash = sdpHash(answer.sdp);
      if (hash && answerSdpHashRef.current === hash) {
        console.warn("✅ [CALL ENGINE] Answer already applied (hash match)");
        stopAnswerWatchers();
        return false;
      }

      // If already stable, the answer has almost certainly been applied
      if (pc.signalingState === "stable") {
        console.warn("✅ [CALL ENGINE] Signaling state is stable - answer already applied");
        answerAppliedRef.current = true;
        answerSdpHashRef.current = hash;
        stopAnswerWatchers();
        return false;
      }

      // Only valid state to apply remote answer for caller
      if (pc.signalingState !== "have-local-offer") {
        console.warn("⚠️ [CALL ENGINE] Cannot apply answer - wrong signaling state", {
          signalingState: pc.signalingState,
          expectedState: "have-local-offer",
        });
        return false;
      }

      // Double-check remote description is still null (race condition protection)
      if (pc.remoteDescription !== null) {
        console.warn("⚠️ [CALL ENGINE] Remote description already set - skipping");
        answerAppliedRef.current = true;
        answerSdpHashRef.current = hash;
        stopAnswerWatchers();
        return false;
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.warn("✅ [CALL ENGINE] Answer applied successfully");
        
        answerAppliedRef.current = true;
        answerSdpHashRef.current = hash;
        stopAnswerWatchers();

        // Process queued ICE candidates now that remote description is set
        for (const candidate of iceCandidatesQueue.current) {
          try {
            if (!pc) break;
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            const error = err as Error;
            if (
              !error.message?.includes("duplicate") &&
              !error.message?.includes("already") &&
              !error.message?.includes("closed")
            ) {
              console.error("Error adding queued ICE candidate:", error.message);
            }
          }
        }
        iceCandidatesQueue.current = [];

        // Stop connecting immediately when answer is received
        setIsConnecting(false);

        // Process any existing ICE candidates from remote peer
        const remoteCandidateField =
          role === "parent" || role === "family_member"
            ? "child_ice_candidates"
            : "parent_ice_candidates";

        (async () => {
          try {
            const { data: currentCall } = await supabase
              .from("calls")
              .select(remoteCandidateField)
              .eq("id", callId)
              .maybeSingle();

            if (currentCall) {
              const existingCandidates =
                (currentCall[remoteCandidateField] as RTCIceCandidateInit[]) || [];
              if (existingCandidates.length > 0 && pc.remoteDescription) {
                for (const candidate of existingCandidates) {
                  try {
                    if (!pc) break;
                    if (!candidate.candidate) continue;
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                  } catch (err) {
                    const error = err as Error;
                    if (
                      !error.message?.includes("duplicate") &&
                      !error.message?.includes("already")
                    ) {
                      console.error("Error adding existing ICE candidate:", error.message);
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error fetching existing ICE candidates:", error);
          }
        })();

        // Transition state from "calling" to "connecting" when answer is received
        if (stateRef.current === "calling") {
          setStateWithLogging("connecting", "Answer received from recipient", {
            callId,
          });
        }

        return true;
      } catch (error) {
        const err = error as Error;
        // If already set or wrong state, that's OK - might have been set elsewhere
        if (
          !err.message?.includes("already") &&
          !err.message?.includes("stable") &&
          !err.message?.includes("InvalidStateError")
        ) {
          console.error("❌ [CALL ENGINE] Error setting remote description:", err);
        }
        return false;
      }
    },
    [
      webRTCPeerConnectionRef,
      sdpHash,
      stopAnswerWatchers,
      iceCandidatesQueue,
      setIsConnecting,
      role,
      stateRef,
      setStateWithLogging,
    ]
  );

  // Audio notifications for outgoing calls
  const audioNotifications = useAudioNotifications({
    enabled: true,
    volume: 0.7,
  }) as ReturnType<typeof useAudioNotifications> & {
    playOutgoingRingtone: () => Promise<void>;
    stopOutgoingRingtone: () => void;
  };
  const playOutgoingRingtone = audioNotifications.playOutgoingRingtone;
  const stopOutgoingRingtone = audioNotifications.stopOutgoingRingtone;
  const playCallAnswered = audioNotifications.playCallAnswered;

  // Play outgoing ringtone when in "calling" state (waiting for answer)
  // Use ref to track previous state to avoid logging on every render
  const previousAudioStateRef = useRef<CallState | null>(null);
  
  useEffect(() => {
    // Only log when state actually changes (not on every render)
    const stateChanged = previousAudioStateRef.current !== state;
    previousAudioStateRef.current = state;
    
    if (state === "calling" && callId) {
      // Outgoing call - play waiting tone
      if (stateChanged && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("🔔 [CALL ENGINE AUDIO] Starting outgoing waiting tone", {
          callId,
        });
      }
      playOutgoingRingtone();
    } else if (state === "in_call" || state === "ended" || state === "idle") {
      // Stop waiting tone when call connects or ends
      if (stateChanged && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("🔇 [CALL ENGINE AUDIO] Stopping outgoing waiting tone", {
          callId,
          state,
        });
      }
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

  // Initialize WebRTC connection in idle state (but handle errors gracefully)
  // This ensures peer connection is ready when user starts a call
  // NOTE: We handle "Device in use" errors gracefully - they're expected if device is busy
  useEffect(() => {
    if (
      !initializationRef.current &&
      state === "idle" &&
      !callId &&
      !webRTCPeerConnectionRef.current // Only initialize if we don't have a connection yet
    ) {
      initializationRef.current = true;
      initializeConnection().catch(async (error) => {
        const err = error as Error;
        // Don't show error toast for "Device in use" - it's expected if device is busy
        // and will be handled gracefully by the call flow
        if (
          !err.message?.includes("Device in use") &&
          !err.name?.includes("NotReadableError")
        ) {
          console.error("Failed to initialize WebRTC:", error);
          // Log diagnostics on initialization failure
          if (import.meta.env.DEV) {
            const { logConnectionDiagnostics } = await import(
              "@/utils/callConnectionDiagnostics"
            );
            logConnectionDiagnostics(webRTCPeerConnectionRef.current);
          }
          toast({
            title: "Connection Error",
            description: "Failed to initialize video connection",
            variant: "destructive",
          });
        } else {
          // Device in use - this is OK, will be handled by call flow
          console.log(
            "⚠️ [CALL ENGINE] Device in use during idle initialization (will retry on call start)"
          );
        }
      });
    } else if (state !== "idle") {
      // Reset initialization flag when state changes away from idle
      // This allows re-initialization if needed
      initializationRef.current = false;
    }
  }, [state, callId, initializeConnection, toast, webRTCPeerConnectionRef]);

  // Pre-warm local media when incoming call is detected
  // This makes Accept feel instant - camera/mic are already active
  // NOTE: We handle "Device in use" errors gracefully - they're expected if device is busy
  useEffect(() => {
    // Accept both "incoming" (backward compat) and "ringing" (new state)
    const isIncomingState = state === "incoming" || state === "ringing";
    if (isIncomingState && !localStream) {
      // eslint-disable-next-line no-console
      console.log("📞 [CALL ENGINE] Pre-warming local media for incoming call");
      initializeConnection().catch((error) => {
        const err = error as Error;
        // Only log if it's not a "Device in use" error (those are expected if device is busy)
        if (
          !err.message?.includes("Device in use") &&
          !err.name?.includes("NotReadableError")
        ) {
          console.error("Failed to pre-warm media:", error);
        } else {
          // eslint-disable-next-line no-console
          console.log(
            "⚠️ [CALL ENGINE] Pre-warming skipped - device in use (will acquire on accept)"
          );
        }
        // Don't show toast - user hasn't accepted yet, and this is optional
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

  // Clear processed ICE candidates when callId changes
  useEffect(() => {
    processedIceCandidatesRef.current.clear();
  }, [callId]);

  // CRITICAL: Poll for ICE candidates when stuck in "new" state
  // This ensures we process candidates even if UPDATE events are missed
  useEffect(() => {
    if (!callId || !webRTCPeerConnectionRef.current) return;

    const pc = webRTCPeerConnectionRef.current;
    const remoteCandidateField =
      role === "parent" || role === "family_member"
        ? "child_ice_candidates"
        : "parent_ice_candidates";

    // Only poll if ICE is stuck in "new" or "checking" state
    // This helps recover from missed UPDATE events
    const shouldPoll =
      (pc.iceConnectionState === "new" || pc.iceConnectionState === "checking") &&
      (pc.localDescription || pc.remoteDescription) &&
      pc.signalingState !== "closed";

    if (!shouldPoll) return;

    const pollInterval = setInterval(async () => {
      const currentPC = webRTCPeerConnectionRef.current;
      if (!currentPC || currentPC.signalingState === "closed") {
        clearInterval(pollInterval);
        return;
      }

      // Stop polling if connection progresses
      if (
        currentPC.iceConnectionState === "connected" ||
        currentPC.iceConnectionState === "completed" ||
        currentPC.iceConnectionState === "failed"
      ) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const { data: latestCall } = await supabase
          .from("calls")
          .select(remoteCandidateField)
          .eq("id", callId)
          .single();

        if (latestCall) {
          const remoteCandidates =
            (latestCall[remoteCandidateField] as RTCIceCandidateInit[]) || [];

          if (remoteCandidates.length > 0) {
            let addedCount = 0;
            for (const candidate of remoteCandidates) {
              try {
                if (!candidate.candidate) continue;
                const candidateKey = `${candidate.candidate}-${candidate.sdpMLineIndex}-${candidate.sdpMid || ""}`;
                if (processedIceCandidatesRef.current.has(candidateKey)) continue;

                await currentPC.addIceCandidate(new RTCIceCandidate(candidate));
                processedIceCandidatesRef.current.add(candidateKey);
                addedCount++;
              } catch (err) {
                const error = err as Error;
                if (
                  !error.message?.includes("duplicate") &&
                  !error.message?.includes("already") &&
                  !error.message?.includes("closed")
                ) {
                  // Silently ignore expected errors
                }
              }
            }

            if (addedCount > 0) {
              console.warn(
                `🔄 [ICE POLL] Added ${addedCount} ICE candidates via polling`,
                {
                  role,
                  iceConnectionState: currentPC.iceConnectionState,
                }
              );
            }
          }
        }
      } catch (error) {
        // Silently handle errors - polling is best effort
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [callId, role, webRTCPeerConnectionRef]);

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
          const oldCall = payload.old as {
            status?: string;
            ended_at?: string | null;
          } | null;
          const pc = webRTCPeerConnectionRef.current;

          // Only log UPDATE events for important state changes (not every ICE candidate update)
          const isImportantUpdate =
            updatedCall.status !== oldCall?.status ||
            !!updatedCall.answer ||
            updatedCall.ended_at !== oldCall?.ended_at;

          if (isImportantUpdate) {
            // eslint-disable-next-line no-console
            console.log("📡 [CALL ENGINE STATUS] UPDATE event:", {
              callId,
              role,
              status: updatedCall.status,
              oldStatus: oldCall?.status,
              hasAnswer: !!updatedCall.answer,
              endedAt: updatedCall.ended_at,
              iceConnectionState: pc?.iceConnectionState,
            });
          }

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
            // The key insight: For outgoing calls, we HAVE a localDescription (our offer)
            // and are waiting for the answer. So we should NOT check localDescription === null
            // Instead, check if signalingState === "have-local-offer" which means we're the caller
            const isWaitingForAnswer =
              pc?.signalingState === "have-local-offer";
            const canAcceptAnswer =
              pc?.remoteDescription === null &&
              pc?.signalingState === "have-local-offer";

            if (
              pc &&
              canAcceptAnswer &&
              isWaitingForAnswer
            ) {
              // CRITICAL: Double-check state right before setting (race condition protection)
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
              
              // CRITICAL: Check if signaling state is already "stable" - means answer was already set
              if (pc.signalingState === "stable") {
                console.warn(
                  "⚠️ [CALL ENGINE] Answer received but signaling state is already stable - answer already processed",
                  {
                    callId,
                    signalingState: pc.signalingState,
                    hasLocalDescription: !!pc.localDescription,
                    hasRemoteDescription: !!pc.remoteDescription,
                  }
                );
                return;
              }
              
              // Final check before setting - state might have changed
              if (pc.signalingState !== "have-local-offer") {
                console.warn(
                  "⚠️ [CALL ENGINE] Signaling state changed before setting remote description - skipping",
                  {
                    callId,
                    expectedState: "have-local-offer",
                    actualState: pc.signalingState,
                  }
                );
                return;
              }
              
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
                  !err.message?.includes("stable") &&
                  !err.message?.includes("InvalidStateError")
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
          // Process ICE candidates if:
          // 1. We have a peer connection
          // 2. Remote description is set (for incoming calls) OR local description is set (for outgoing calls)
          // 3. ICE connection is not yet connected/completed
          // CRITICAL: For incoming calls, we have local description (answer) and need remote candidates
          // For outgoing calls, we have local description (offer) and remote description (answer)
          const canProcessCandidates =
            pc &&
            (pc.remoteDescription || pc.localDescription) &&
            pc.iceConnectionState !== "connected" &&
            pc.iceConnectionState !== "completed";

          if (canProcessCandidates) {
            try {
              const { data: latestCall, error: fetchError } = await supabase
                .from("calls")
                .select(remoteCandidateField)
                .eq("id", callId)
                .single();

              if (fetchError) {
                // Only log errors, not every fetch
                console.error(
                  "❌ [CALL ENGINE STATUS] Error fetching ICE candidates:",
                  fetchError.message
                );
              } else if (latestCall) {
                const remoteCandidates =
                  (latestCall[remoteCandidateField] as RTCIceCandidateInit[]) ||
                  [];

                if (remoteCandidates.length > 0) {
                  // Process new candidates with deduplication
                  let addedCount = 0;
                  let skippedCount = 0;

                  for (const candidate of remoteCandidates) {
                    try {
                      if (!pc) break; // Connection closed
                      if (!candidate.candidate) continue;

                      // Create unique key for candidate deduplication
                      const candidateKey = `${candidate.candidate}-${
                        candidate.sdpMLineIndex
                      }-${candidate.sdpMid || ""}`;

                      // Skip if already processed
                      if (processedIceCandidatesRef.current.has(candidateKey)) {
                        skippedCount++;
                        continue;
                      }

                      await pc.addIceCandidate(new RTCIceCandidate(candidate));
                      processedIceCandidatesRef.current.add(candidateKey);
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

                  // Only log when we actually add new candidates (not duplicates)
                  if (addedCount > 0) {
                    // eslint-disable-next-line no-console
                    console.log(
                      `✅ [CALL ENGINE STATUS] Added ${addedCount} new ICE candidates${
                        skippedCount > 0
                          ? ` (${skippedCount} duplicates skipped)`
                          : ""
                      }`
                    );
                  } else if (remoteCandidates.length === 0 && pc.iceConnectionState === "new") {
                    // Log when we're stuck in "new" and no candidates are available
                    // This helps diagnose if child hasn't sent candidates yet
                    console.warn(
                      `⚠️ [CALL ENGINE STATUS] ICE stuck in "new" - no remote candidates available yet`,
                      {
                        role,
                        remoteCandidateField,
                        iceConnectionState: pc.iceConnectionState,
                        hasLocalDescription: !!pc.localDescription,
                        hasRemoteDescription: !!pc.remoteDescription,
                        iceGatheringState: pc.iceGatheringState,
                      }
                    );
                  }
                }
              }
            } catch (error) {
              console.error(
                "❌ [CALL ENGINE STATUS] Exception fetching ICE candidates:",
                error
              );
            }
          } else if (pc && pc.iceConnectionState === "new") {
            // If we're stuck in "new" state, log diagnostic info
            console.warn(
              `⚠️ [CALL ENGINE STATUS] Cannot process ICE candidates - connection not ready`,
              {
                role,
                hasLocalDescription: !!pc.localDescription,
                hasRemoteDescription: !!pc.remoteDescription,
                iceConnectionState: pc.iceConnectionState,
                signalingState: pc.signalingState,
              }
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
          ? "/parent/children"
          : role === "family_member"
          ? "/family-member/dashboard"
          : "/child/parent";
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

              // CRITICAL: Process answer when it appears - use idempotent function
              // Only process if answer changed (different from old payload)
              const answerChanged =
                updatedCall.answer &&
                (!oldCallPayload ||
                  !(oldCallPayload as { answer?: unknown }).answer ||
                  JSON.stringify(updatedCall.answer) !==
                    JSON.stringify((oldCallPayload as { answer?: unknown }).answer));

              if (answerChanged && updatedCall.answer && pc) {
                const answerDesc =
                  updatedCall.answer as unknown as RTCSessionDescriptionInit;
                await applyAnswerIdempotent(answerDesc, callId);
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

                    // IMPROVEMENT: Handle end-of-candidates (null candidate)
                    // A null candidate indicates ICE gathering is complete
                    if (!candidate.candidate) {
                      // End-of-candidates marker - signal completion
                      try {
                        await pc.addIceCandidate();
                        safeLog.log(
                          "✅ [CALL ENGINE] End-of-candidates marker processed"
                        );
                      } catch (endErr) {
                        // End-of-candidates can fail if already processed - ignore
                        safeLog.log(
                          "ℹ️ [CALL ENGINE] End-of-candidates already processed or connection closed"
                        );
                      }
                      continue;
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
                    // IMPROVEMENT: Enhanced error handling with RTCError interface
                    if (err instanceof RTCError) {
                      safeLog.error(
                        "❌ [CALL ENGINE] RTCError adding ICE candidate:",
                        {
                          errorDetail: err.errorDetail,
                          sdpLineNumber: err.sdpLineNumber,
                          httpRequestStatusCode: (err as any)
                            .httpRequestStatusCode,
                          message: err.message,
                        }
                      );
                    }
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
              // Stop polling once subscription is confirmed
              if (pollingStarted && answerPollingIntervalRef.current) {
                console.warn("🛑 [CALL ENGINE] Stopping polling - realtime subscription active");
                stopAnswerWatchers();
              }
            } else if (status === "CHANNEL_ERROR" || err) {
              console.error(
                "❌ [CALL ENGINE] Answer subscription error:",
                err || "Channel error"
              );
              // Only start polling if subscription fails
              if (!pollingStarted) {
                console.warn("🔄 [CALL ENGINE] Starting polling fallback due to subscription error");
                startAnswerPolling();
              }
            }
          });

        callChannelRef.current = answerChannel;

        // CRITICAL: Start polling for answer updates ONLY if realtime subscription fails
        // Stop polling immediately once answer is applied or subscription succeeds
        let pollingStarted = false;
        const startAnswerPolling = () => {
          // Don't start if answer already applied
          if (answerAppliedRef.current) {
            return;
          }
          
          // Clear any existing polling interval
          if (answerPollingIntervalRef.current) {
            clearInterval(answerPollingIntervalRef.current);
          }

          pollingStarted = true;
          answerPollingIntervalRef.current = setInterval(async () => {
            // Stop if answer already applied
            if (answerAppliedRef.current) {
              stopAnswerWatchers();
              return;
            }

            // Only poll if we're still in "calling" state and have a callId
            if (stateRef.current !== "calling" || !callId) {
              stopAnswerWatchers();
              return;
            }

            try {
              // Simple polling - just check for answer
              const { data: polledCall } = await supabase
                .from("calls")
                .select("answer, status")
                .eq("id", callId)
                .single();

              // If answer is present but we haven't processed it yet, process it now
              if (polledCall?.answer && !answerAppliedRef.current) {
                const answerDesc =
                  polledCall.answer as unknown as RTCSessionDescriptionInit;
                await applyAnswerIdempotent(answerDesc, callId);
              }
            } catch (pollError) {
              console.error(
                "❌ [CALL ENGINE] Error in answer polling:",
                pollError
              );
            }
          }, 2000); // Poll every 2 seconds
        };

        // Don't start polling immediately - wait for subscription status
        // Polling will only start if subscription fails (see subscribe callback above)

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

        // Check if answer already present - use idempotent function
        if (currentCall?.answer && !answerAppliedRef.current) {
          console.warn(
            "📞 [CALL ENGINE] Answer already present when subscription set up - processing immediately",
            {
              callId,
              hasAnswer: !!currentCall.answer,
              status: currentCall.status,
            }
          );
          const answerDesc =
            currentCall.answer as unknown as RTCSessionDescriptionInit;
          await applyAnswerIdempotent(answerDesc, callId);
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

  // CRITICAL: Sync mute/video state with WebRTC to prevent overrides
  // This ensures that when ICE connects or quality changes, user's settings are respected
  useEffect(() => {
    setUserMuted(isMuted);
  }, [isMuted, setUserMuted]);

  useEffect(() => {
    setUserVideoOff(isVideoOff);
  }, [isVideoOff, setUserVideoOff]);

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

  // FALLBACK: Poll for ICE candidates while in "connecting" state as a backup
  // Primary mechanism is realtime subscription, but polling ensures we don't miss candidates
  // Reduced frequency to 2 seconds to minimize database queries and console noise
  const icePollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pc = webRTCPeerConnectionRef.current;

    // Poll when:
    // 1. In connecting state (outgoing call waiting for answer)
    // 2. In incoming/ringing state (incoming call being accepted)
    // 3. ICE is in "new" or "checking" state (candidates still needed)
    // 4. Have either local or remote description (connection is being set up)
    const shouldPoll =
      callId &&
      pc &&
      (state === "connecting" ||
        state === "incoming" ||
        state === "ringing" ||
        (pc.iceConnectionState === "new" || pc.iceConnectionState === "checking")) &&
      (pc.localDescription || pc.remoteDescription) &&
      pc.signalingState !== "closed";

    if (!shouldPoll) {
      // Clear any existing polling when not needed
      if (icePollingIntervalRef.current) {
        clearInterval(icePollingIntervalRef.current);
        icePollingIntervalRef.current = null;
      }
      // Reset processed candidates when not polling
      if (state === "idle" || state === "ended") {
        processedIceCandidatesRef.current.clear();
      }
      return;
    }

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
          // Only log errors, not every poll attempt
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
            let addedCount = 0;
            let skippedCount = 0;

            for (const candidate of remoteCandidates) {
              try {
                if (!candidate.candidate) continue;

                // Create unique key for candidate deduplication
                const candidateKey = `${candidate.candidate}-${
                  candidate.sdpMLineIndex
                }-${candidate.sdpMid || ""}`;

                // Skip if already processed
                if (processedIceCandidatesRef.current.has(candidateKey)) {
                  skippedCount++;
                  continue;
                }

                await currentPc.addIceCandidate(new RTCIceCandidate(candidate));
                processedIceCandidatesRef.current.add(candidateKey);
                addedCount++;
              } catch (err) {
                // Silently handle duplicates - this is expected
              }
            }

            // Only log when we actually add new candidates
            if (addedCount > 0) {
              // eslint-disable-next-line no-console
              console.log(
                `✅ [ICE POLLING] Added ${addedCount} new ICE candidates${
                  skippedCount > 0 ? ` (${skippedCount} duplicates)` : ""
                }`
              );
            }
          }
        }
      } catch (error) {
        console.error("❌ [ICE POLLING] Exception:", error);
      }
    };

    // Poll immediately and then every 2 seconds (reduced from 500ms)
    // This is a fallback - realtime subscription is the primary mechanism
    pollForIceCandidates();
    icePollingIntervalRef.current = setInterval(pollForIceCandidates, 2000);

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
    networkQuality: {
      ...networkQuality,
      reconnecting,
    },
    // Battery status for low-battery notifications
    batteryStatus,
  };
};

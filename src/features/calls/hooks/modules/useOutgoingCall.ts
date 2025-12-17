// src/features/calls/hooks/modules/useOutgoingCall.ts
// Outgoing call orchestration module
// Routes to role-specific handlers at orchestration level

import { useCallback } from "react";
import { handleAdultOutgoingCall } from "./handlers/adultOutgoingCallHandler";
import { handleChildOutgoingCall } from "./handlers/childOutgoingCallHandler";
import type { CallState } from "./useCallStateMachine";

export interface UseOutgoingCallParams {
  role: "parent" | "child" | "family_member";
  localProfileId: string;
  remoteId: string;
  offer: RTCSessionDescriptionInit;
  webRTCPeerConnectionRef: React.MutableRefObject<RTCPeerConnection | null>;
  initializeConnection: () => Promise<void>;
  setStateWithLogging: (
    newState: CallState,
    reason: string,
    context?: Record<string, unknown>
  ) => void;
  setIsConnecting: (connecting: boolean) => void;
  setCallId: (callId: string) => void;
}

export interface UseOutgoingCallReturn {
  startOutgoingCall: (remoteId: string) => Promise<void>;
}

export const useOutgoingCall = ({
  role,
  localProfileId,
  webRTCPeerConnectionRef,
  initializeConnection,
  setStateWithLogging,
  setIsConnecting,
  setCallId,
}: UseOutgoingCallParams): UseOutgoingCallReturn => {
  const startOutgoingCall = useCallback(
    async (remoteId: string) => {
      try {
        setStateWithLogging("calling", "Starting outgoing call", {
          remoteId,
          localProfileId,
        });
        setIsConnecting(true);

        // Ensure peer connection is initialized
        let pc = webRTCPeerConnectionRef.current;
        if (!pc) {
          console.warn(
            "📞 [OUTGOING CALL] Peer connection not initialized, initializing now..."
          );
          await initializeConnection();
          pc = webRTCPeerConnectionRef.current;
          if (!pc) {
            throw new Error("Failed to initialize peer connection");
          }
        }

        // Verify tracks are added before creating offer
        const senderTracks = pc
          .getSenders()
          .map((s) => s.track)
          .filter(Boolean);
        const audioTracks = senderTracks.filter((t) => t?.kind === "audio");
        const videoTracks = senderTracks.filter((t) => t?.kind === "video");

        console.warn("📹 [OUTGOING CALL] Tracks before creating offer:", {
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
            "❌ [OUTGOING CALL] WARNING: No audio tracks found! Audio will not work."
          );
        }

        // Create offer
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });

        // Verify SDP includes media tracks
        const hasAudio = offer.sdp?.includes("m=audio");
        const hasVideo = offer.sdp?.includes("m=video");
        console.warn("📋 [OUTGOING CALL] Offer SDP verification:", {
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
            "❌ [OUTGOING CALL] WARNING: Offer SDP has no audio! Audio will not work."
          );
        }

        await pc.setLocalDescription(offer);

        // ROLE-BASED ROUTING: Route to appropriate handler
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

        setCallId(result.callId);
        console.warn("✅ [OUTGOING CALL] Outgoing call created successfully:", {
          callId: result.callId,
          role,
        });

        return result.callId;
      } catch (error) {
        console.error("Error starting outgoing call:", error);
        throw error;
      }
    },
    [
      role,
      localProfileId,
      webRTCPeerConnectionRef,
      initializeConnection,
      setStateWithLogging,
      setIsConnecting,
      setCallId,
    ]
  );

  return { startOutgoingCall };
};

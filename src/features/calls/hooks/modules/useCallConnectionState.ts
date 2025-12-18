// src/features/calls/hooks/modules/useCallConnectionState.ts
// Monitor WebRTC connection state changes
// Updates UI when connection is established or fails

import { useEffect } from "react";
import type { CallState } from "./useCallStateMachine";

export interface UseCallConnectionStateParams {
  state: CallState;
  remoteStream: MediaStream | null;
  webRTCPeerConnectionRef: React.MutableRefObject<RTCPeerConnection | null>;
  setIsConnecting: (connecting: boolean) => void;
  setStateWithLogging: (
    newState: CallState,
    reason: string,
    context?: Record<string, unknown>
  ) => void;
}

export const useCallConnectionState = ({
  state,
  remoteStream,
  webRTCPeerConnectionRef,
  setIsConnecting,
  setStateWithLogging,
}: UseCallConnectionStateParams) => {
  useEffect(() => {
    const pc = webRTCPeerConnectionRef.current;
    if (!pc || state !== "connecting") return;

    const handleConnectionChange = () => {
      const connectionState = pc.connectionState;
      const iceConnectionState = pc.iceConnectionState;

      console.warn("📡 [CONNECTION STATE] Connection state changed:", {
        connectionState,
        iceConnectionState,
        hasRemoteStream: !!remoteStream,
      });

      if (connectionState === "connected" || connectionState === "completed") {
        if (state === "connecting") {
          setStateWithLogging("in_call", "WebRTC connection established", {
            connectionState,
            iceConnectionState,
          });
        }
        setIsConnecting(false);
      } else if (
        connectionState === "failed" ||
        connectionState === "closed"
      ) {
        // CRITICAL: Only end on terminal states "failed" or "closed"
        // "disconnected" is TRANSIENT and can recover - don't end the call on disconnected!
        // See: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState
        if (state === "connecting" || state === "in_call") {
          setStateWithLogging("ended", "WebRTC connection failed", {
            connectionState,
            iceConnectionState,
          });
        }
        setIsConnecting(false);
      } else if (connectionState === "disconnected") {
        // Log disconnected but DON'T end the call - it can recover
        console.warn("⚠️ [CONNECTION STATE] Connection temporarily disconnected (can recover):", {
          connectionState,
          iceConnectionState,
        });
        // Keep isConnecting as-is - don't change state
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
};


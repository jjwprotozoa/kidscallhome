// src/features/calls/hooks/webrtc/types.ts
// Shared TypeScript interfaces and types for WebRTC module

import type {
  ConnectionType,
  NetworkQualityLevel,
  NetworkStats,
} from "../useNetworkQuality";

/**
 * Return type for the useWebRTC hook
 */
export interface UseWebRTCReturn {
  peerConnection: RTCPeerConnection | null;
  peerConnectionRef: React.MutableRefObject<RTCPeerConnection | null>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnecting: boolean;
  setIsConnecting: (value: boolean) => void;
  isConnected: boolean; // True only when ICE is connected/completed
  initializeConnection: () => Promise<void>;
  cleanup: (force?: boolean) => void;
  iceCandidatesQueue: React.MutableRefObject<RTCIceCandidateInit[]>;
  playRemoteVideo: () => void;
  // Network quality state for adaptive streaming
  networkQuality: NetworkQualityState;
}

/**
 * Network quality state exposed by the hook
 */
export interface NetworkQualityState {
  qualityLevel: NetworkQualityLevel;
  connectionType: ConnectionType;
  networkStats: NetworkStats;
  isVideoPausedDueToNetwork: boolean;
  forceAudioOnly: () => void;
  enableVideoIfPossible: () => void;
}

/**
 * ICE server configuration with optional credentials
 */
export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Result from fetching Cloudflare TURN credentials
 */
export interface CloudflareTurnCredentials {
  urls: string | string[];
  username: string;
  credential: string;
}

/**
 * Response shape from the TURN credentials API endpoint
 */
export interface TurnCredentialsApiResponse {
  iceServers?:
    | CloudflareTurnCredentials[]
    | CloudflareTurnCredentials;
}

/**
 * Options for ICE server configuration
 */
export interface IceServerOptions {
  useCloudflareTurn: boolean;
  turnServersEnv?: string;
  turnUsernameEnv?: string;
  turnCredentialEnv?: string;
  isProduction: boolean;
}





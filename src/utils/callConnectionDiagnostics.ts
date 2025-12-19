// src/utils/callConnectionDiagnostics.ts
// Comprehensive call connection diagnostics for troubleshooting iPhone connection issues

import { getBrowserInfo, isIOS, isMobile } from "./mobileCompatibility";

export interface ConnectionDiagnostics {
  platform: string;
  browser: string;
  webrtcSupported: boolean;
  mediaDevicesSupported: boolean;
  peerConnectionSupported: boolean;
  httpsRequired: boolean;
  iceServersConfigured: boolean;
  issues: string[];
  recommendations: string[];
  connectionState?: {
    signalingState: string;
    iceConnectionState: string;
    connectionState: string;
    hasLocalDescription: boolean;
    hasRemoteDescription: boolean;
    localTracks: number;
    remoteTracks: number;
  };
}

/**
 * Run comprehensive diagnostics on WebRTC connection
 */
export const diagnoseConnection = (
  peerConnection?: RTCPeerConnection | null
): ConnectionDiagnostics => {
  const browserInfo = getBrowserInfo();
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check WebRTC support
  const webrtcSupported = typeof RTCPeerConnection !== "undefined";
  const mediaDevicesSupported =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const peerConnectionSupported = webrtcSupported;

  if (!webrtcSupported) {
    issues.push("WebRTC not supported");
    recommendations.push("Update to a modern browser");
  }

  if (!mediaDevicesSupported) {
    issues.push("Media devices API not available");
    if (isIOS()) {
      recommendations.push(
        "On iOS, use Safari browser for best WebRTC support"
      );
    }
  }

  // Check HTTPS requirement
  const isHTTPS =
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.startsWith("192.168.") ||
    window.location.hostname.startsWith("10.") ||
    window.location.hostname.startsWith("172.");

  if (!isHTTPS && isMobile()) {
    issues.push("HTTPS required for mobile WebRTC");
    recommendations.push("Use HTTPS or localhost for testing");
  }

  // Check ICE servers configuration
  let iceServersConfigured = false;
  if (peerConnection) {
    const config = peerConnection.getConfiguration();
    iceServersConfigured = !!config.iceServers && config.iceServers.length > 0;

    if (!iceServersConfigured) {
      issues.push("No ICE servers configured");
      recommendations.push(
        "Configure TURN/STUN servers for reliable connections"
      );
    } else {
      // Check if TURN servers are present (important for mobile)
      const hasTurnServers = config.iceServers.some((server) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some((url) =>
          typeof url === "string" ? url.includes("turn:") : false
        );
      });

      if (!hasTurnServers && isMobile()) {
        issues.push("No TURN servers configured (required for mobile)");
        recommendations.push(
          "Add TURN servers for reliable mobile connections"
        );
      }
    }
  }

  // iOS-specific checks
  if (isIOS()) {
    if (!isHTTPS) {
      issues.push("iOS requires HTTPS for getUserMedia");
      recommendations.push("Use HTTPS or test on localhost");
    }

    // Check Safari vs Chrome
    if (browserInfo.browser !== "Safari") {
      recommendations.push("For best results on iOS, use Safari browser");
    }
  }

  // Connection state diagnostics
  let connectionState: ConnectionDiagnostics["connectionState"] | undefined;
  if (peerConnection) {
    const localTracks = peerConnection
      .getSenders()
      .filter((s) => !!s.track).length;
    const receivers = peerConnection.getReceivers();
    const remoteTracks = receivers.filter((r) => !!r.track).length;

    connectionState = {
      signalingState: peerConnection.signalingState,
      iceConnectionState: peerConnection.iceConnectionState,
      connectionState: peerConnection.connectionState,
      hasLocalDescription: !!peerConnection.localDescription,
      hasRemoteDescription: !!peerConnection.remoteDescription,
      localTracks,
      remoteTracks,
    };

    // Check for common connection issues
    if (
      peerConnection.iceConnectionState === "failed" ||
      peerConnection.connectionState === "failed"
    ) {
      issues.push("Connection failed - may need TURN server");
      recommendations.push("Check TURN server configuration");
    }

    if (
      peerConnection.iceConnectionState === "disconnected" &&
      peerConnection.connectionState === "disconnected"
    ) {
      issues.push("Connection disconnected");
      recommendations.push("Check network connectivity");
    }

    if (!peerConnection.remoteDescription && peerConnection.localDescription) {
      issues.push("Waiting for remote answer");
    }

    if (peerConnection.remoteDescription && !peerConnection.localDescription) {
      issues.push("Waiting for local answer");
    }

    if (localTracks === 0) {
      issues.push("No local media tracks");
      recommendations.push("Check camera/microphone permissions");
    }

    if (remoteTracks === 0 && peerConnection.connectionState === "connected") {
      issues.push("No remote media tracks received");
      recommendations.push("Check remote peer connection");
    }
  }

  return {
    platform: browserInfo.platform,
    browser: browserInfo.browser,
    webrtcSupported,
    mediaDevicesSupported,
    peerConnectionSupported,
    httpsRequired: !isHTTPS && isMobile(),
    iceServersConfigured,
    issues,
    recommendations,
    connectionState,
  };
};

/**
 * Log connection diagnostics to console
 */
export const logConnectionDiagnostics = (
  peerConnection?: RTCPeerConnection | null
): void => {
  const diagnostics = diagnoseConnection(peerConnection);

  // eslint-disable-next-line no-console
  console.group("🔍 [CONNECTION DIAGNOSTICS]");
  // eslint-disable-next-line no-console
  console.log("Platform:", diagnostics.platform);
  // eslint-disable-next-line no-console
  console.log("Browser:", diagnostics.browser);
  // eslint-disable-next-line no-console
  console.log("WebRTC Supported:", diagnostics.webrtcSupported);
  // eslint-disable-next-line no-console
  console.log("Media Devices Supported:", diagnostics.mediaDevicesSupported);
  // eslint-disable-next-line no-console
  console.log("HTTPS:", !diagnostics.httpsRequired);
  // eslint-disable-next-line no-console
  console.log("ICE Servers Configured:", diagnostics.iceServersConfigured);

  if (diagnostics.connectionState) {
    // eslint-disable-next-line no-console
    console.group("Connection State");
    // eslint-disable-next-line no-console
    console.log("Signaling State:", diagnostics.connectionState.signalingState);
    // eslint-disable-next-line no-console
    console.log(
      "ICE Connection State:",
      diagnostics.connectionState.iceConnectionState
    );
    // eslint-disable-next-line no-console
    console.log(
      "Connection State:",
      diagnostics.connectionState.connectionState
    );
    // eslint-disable-next-line no-console
    console.log(
      "Has Local Description:",
      diagnostics.connectionState.hasLocalDescription
    );
    // eslint-disable-next-line no-console
    console.log(
      "Has Remote Description:",
      diagnostics.connectionState.hasRemoteDescription
    );
    // eslint-disable-next-line no-console
    console.log("Local Tracks:", diagnostics.connectionState.localTracks);
    // eslint-disable-next-line no-console
    console.log("Remote Tracks:", diagnostics.connectionState.remoteTracks);
    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  if (diagnostics.issues.length > 0) {
    // eslint-disable-next-line no-console
    console.group("⚠️ Issues");
    diagnostics.issues.forEach((issue) => console.warn(issue));
    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  if (diagnostics.recommendations.length > 0) {
    // eslint-disable-next-line no-console
    console.group("💡 Recommendations");
    diagnostics.recommendations.forEach((rec) => {
      // eslint-disable-next-line no-console
      console.info(rec);
    });
    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  // eslint-disable-next-line no-console
  console.groupEnd();
};

/**
 * Check if connection is likely to succeed based on current state
 */
export const isConnectionLikelyToSucceed = (
  peerConnection?: RTCPeerConnection | null
): boolean => {
  if (!peerConnection) return false;

  const diagnostics = diagnoseConnection(peerConnection);

  // Must have WebRTC support
  if (!diagnostics.webrtcSupported || !diagnostics.mediaDevicesSupported) {
    return false;
  }

  // Must have HTTPS on mobile
  if (diagnostics.httpsRequired) {
    return false;
  }

  // Must have ICE servers
  if (!diagnostics.iceServersConfigured) {
    return false;
  }

  // Check connection state
  if (diagnostics.connectionState) {
    const { connectionState, iceConnectionState, signalingState } =
      diagnostics.connectionState;

    // Terminal failure states
    if (
      connectionState === "failed" ||
      connectionState === "closed" ||
      iceConnectionState === "failed" ||
      iceConnectionState === "closed"
    ) {
      return false;
    }

    // Connected states
    if (
      connectionState === "connected" ||
      connectionState === "completed" ||
      iceConnectionState === "connected" ||
      iceConnectionState === "completed"
    ) {
      return true;
    }

    // Transient states that can succeed
    if (
      connectionState === "connecting" ||
      iceConnectionState === "checking" ||
      iceConnectionState === "connected" ||
      signalingState === "have-local-offer" ||
      signalingState === "have-remote-offer" ||
      signalingState === "have-local-pranswer" ||
      signalingState === "have-remote-pranswer"
    ) {
      return true;
    }
  }

  return true;
};

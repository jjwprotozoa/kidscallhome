// src/features/calls/webrtc/codecPreferences.ts
// Video codec preference management for WebRTC
// Prioritizes AV1 → VP9 → H.264 for better compression and quality

import { safeLog } from "@/utils/security";

/**
 * Options for codec preference selection
 */
export interface CodecPreferenceOptions {
  allowAV1: boolean;  // Whether to allow AV1 codec (requires modern hardware)
}

/**
 * Get preferred video codecs in order of preference
 * @param capabilities RTCRtpCapabilities from RTCRtpSender.getCapabilities('video')
 * @param opts Options for codec selection
 * @returns Array of preferred codecs in order (best first)
 */
export function getPreferredVideoCodecs(
  capabilities: RTCRtpCapabilities | undefined,
  opts: CodecPreferenceOptions
): RTCRtpCodecCapability[] {
  if (!capabilities || !capabilities.codecs) {
    safeLog.warn("⚠️ [CODEC] No codec capabilities available");
    return [];
  }

  const codecs = capabilities.codecs;
  const av1Codecs: RTCRtpCodecCapability[] = [];
  const vp9Codecs: RTCRtpCodecCapability[] = [];
  const h264Codecs: RTCRtpCodecCapability[] = [];
  const otherCodecs: RTCRtpCodecCapability[] = [];

  // Filter codecs by type
  for (const codec of codecs) {
    const mimeType = codec.mimeType?.toLowerCase() || "";
    
    if (mimeType.includes("av1") || mimeType.includes("av01")) {
      av1Codecs.push(codec);
    } else if (mimeType.includes("vp9") || mimeType.includes("vp09")) {
      vp9Codecs.push(codec);
    } else if (
      mimeType.includes("h264") ||
      mimeType.includes("h.264") ||
      mimeType.includes("mp4v-es")
    ) {
      h264Codecs.push(codec);
    } else {
      otherCodecs.push(codec);
    }
  }

  // Build preference list: AV1 → VP9 → H.264 → others
  const preferred: RTCRtpCodecCapability[] = [];

  // AV1 first (if allowed and available)
  if (opts.allowAV1 && av1Codecs.length > 0) {
    preferred.push(...av1Codecs);
    safeLog.log("✅ [CODEC] AV1 codec available and enabled");
  }

  // VP9 second (better compression than H.264)
  if (vp9Codecs.length > 0) {
    preferred.push(...vp9Codecs);
    safeLog.log("✅ [CODEC] VP9 codec available");
  }

  // H.264 third (widely supported fallback)
  if (h264Codecs.length > 0) {
    preferred.push(...h264Codecs);
    safeLog.log("✅ [CODEC] H.264 codec available (fallback)");
  }

  // Other codecs last
  if (otherCodecs.length > 0) {
    preferred.push(...otherCodecs);
    safeLog.log("ℹ️ [CODEC] Other codecs available:", otherCodecs.map(c => c.mimeType).join(", "));
  }

  if (preferred.length === 0) {
    safeLog.warn("⚠️ [CODEC] No video codecs found!");
  } else {
    safeLog.log("📊 [CODEC] Codec preference order:", preferred.map(c => c.mimeType).join(" → "));
  }

  return preferred;
}

/**
 * Apply video codec preferences to a peer connection
 * @param pc RTCPeerConnection to apply codec preferences to
 * @param allowAV1 Whether to allow AV1 codec
 */
export function applyVideoCodecPreferences(
  pc: RTCPeerConnection,
  allowAV1: boolean
): void {
  try {
    // Get video codec capabilities
    const capabilities = RTCRtpSender.getCapabilities("video");
    if (!capabilities) {
      safeLog.warn("⚠️ [CODEC] Cannot get video codec capabilities");
      return;
    }

    // Get preferred codecs
    const preferredCodecs = getPreferredVideoCodecs(capabilities, { allowAV1 });

    if (preferredCodecs.length === 0) {
      safeLog.warn("⚠️ [CODEC] No preferred codecs to apply");
      return;
    }

    // Get video transceivers
    const transceivers = pc.getTransceivers();
    const videoTransceivers = transceivers.filter(
      (t) => t.sender.track && t.sender.track.kind === "video"
    );

    if (videoTransceivers.length === 0) {
      safeLog.log("ℹ️ [CODEC] No video transceivers found yet (tracks may not be added)");
      return;
    }

    // Apply codec preferences to each video transceiver
    for (const transceiver of videoTransceivers) {
      try {
        // setCodecPreferences is available in modern browsers
        if (transceiver.setCodecPreferences) {
          transceiver.setCodecPreferences(preferredCodecs);
          safeLog.log("✅ [CODEC] Applied codec preferences to transceiver:", {
            codec: preferredCodecs[0]?.mimeType,
            trackId: transceiver.sender.track?.id,
          });
        } else {
          safeLog.warn("⚠️ [CODEC] setCodecPreferences not supported in this browser");
        }
      } catch (error) {
        safeLog.warn("⚠️ [CODEC] Failed to set codec preferences:", error);
      }
    }
  } catch (error) {
    safeLog.error("❌ [CODEC] Error applying codec preferences:", error);
  }
}

/**
 * Check if AV1 codec is supported
 * @returns true if AV1 is supported
 */
export function isAV1Supported(): boolean {
  try {
    const capabilities = RTCRtpSender.getCapabilities("video");
    if (!capabilities || !capabilities.codecs) {
      return false;
    }

    return capabilities.codecs.some(
      (codec) =>
        codec.mimeType?.toLowerCase().includes("av1") ||
        codec.mimeType?.toLowerCase().includes("av01")
    );
  } catch {
    return false;
  }
}

/**
 * Determine if AV1 should be allowed based on device capabilities
 * @param qualityLevel Current quality level
 * @returns true if AV1 should be allowed
 */
export function shouldAllowAV1(qualityLevel: string): boolean {
  // Only allow AV1 on good/excellent/premium quality levels
  // AV1 encoding/decoding requires more CPU, so only use on high-quality connections
  const highQualityLevels = ["good", "excellent", "premium"];
  if (!highQualityLevels.includes(qualityLevel)) {
    return false;
  }

  // Check if AV1 is actually supported
  if (!isAV1Supported()) {
    return false;
  }

  // Heuristic: Allow AV1 on desktop or high-end mobile devices
  const isDesktop = !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // For mobile, check if it's a recent device (rough heuristic based on user agent)
  const isHighEndMobile =
    /iPhone (1[3-9]|2[0-9])|iPad Pro|Samsung.*Galaxy S(2[0-9]|3[0-9])|Pixel [4-9]/.test(
      navigator.userAgent
    );

  return isDesktop || isHighEndMobile;
}


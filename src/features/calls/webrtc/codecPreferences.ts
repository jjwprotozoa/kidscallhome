// src/features/calls/webrtc/codecPreferences.ts
// Video codec preference management for WebRTC
// Prioritizes stability and smoothness: H.264 → VP9 → AV1
// H.264 is preferred for hardware acceleration and stability

import { safeLog } from "@/utils/security";

/**
 * Options for codec preference selection
 */
export interface CodecPreferenceOptions {
  allowAV1: boolean;  // Whether to allow AV1 codec (requires modern hardware)
  allowVP9: boolean;  // Whether to allow VP9 codec (better compression but higher CPU than H.264)
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

  // Build preference list: H.264 → VP9 → AV1 → others
  // PRIORITY: Stability and smoothness over quality
  // H.264 is preferred for hardware acceleration, lower CPU, and better stability
  const preferred: RTCRtpCodecCapability[] = [];

  // H.264 FIRST (most stable, hardware-accelerated, lowest CPU)
  // This is the default choice for stability and smoothness
  if (h264Codecs.length > 0) {
    preferred.push(...h264Codecs);
    safeLog.log("✅ [CODEC] H.264 codec preferred (hardware-accelerated, most stable)");
  }

  // VP9 second (better compression but higher CPU, use only if H.264 not available)
  // Only include if allowed (may be restricted on mobile/1080p)
  if (opts.allowVP9 && vp9Codecs.length > 0) {
    preferred.push(...vp9Codecs);
    safeLog.log("✅ [CODEC] VP9 codec available (fallback if H.264 unavailable)");
  } else if (vp9Codecs.length > 0) {
    safeLog.log("ℹ️ [CODEC] VP9 codec available but disabled (preferring H.264 for stability)");
  }

  // AV1 last (best compression but highest CPU, use only if others unavailable)
  if (opts.allowAV1 && av1Codecs.length > 0) {
    preferred.push(...av1Codecs);
    safeLog.log("✅ [CODEC] AV1 codec available (last resort, highest CPU)");
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
 * @param allowVP9 Whether to allow VP9 codec (default: true, but may be restricted on mobile/1080p)
 */
export function applyVideoCodecPreferences(
  pc: RTCPeerConnection,
  allowAV1: boolean,
  allowVP9: boolean = true
): void {
  try {
    // Get video codec capabilities
    const capabilities = RTCRtpSender.getCapabilities("video");
    if (!capabilities) {
      safeLog.warn("⚠️ [CODEC] Cannot get video codec capabilities");
      return;
    }

    // Get preferred codecs
    const preferredCodecs = getPreferredVideoCodecs(capabilities, { allowAV1, allowVP9 });

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
 * PRIORITY: Stability over quality - AV1 is disabled by default for stability
 * @param qualityLevel Current quality level
 * @param videoWidth Current video width (to check if 1080p)
 * @returns true if AV1 should be allowed (rarely, for stability we prefer H.264)
 */
export function shouldAllowAV1(qualityLevel: string, videoWidth?: number): boolean {
  // STABILITY FIRST: Disable AV1 by default - prefer H.264 for stability
  // Only enable AV1 if explicitly needed and H.264/VP9 unavailable
  safeLog.log("📊 [CODEC] AV1 disabled by default (preferring H.264 for stability)");
  return false;
  
  // Legacy code below (disabled for stability):
  /*
  // Only allow AV1 on good/excellent/premium quality levels
  const highQualityLevels = ["good", "excellent", "premium"];
  if (!highQualityLevels.includes(qualityLevel)) {
    return false;
  }

  if (!isAV1Supported()) {
    return false;
  }

  const isDesktop = !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  const isMobile = !isDesktop;
  const is1080p = videoWidth && videoWidth >= 1920;
  
  if (isMobile && is1080p) {
    return false;
  }

  return isDesktop;
  */
}

/**
 * Check if VP9 codec is supported
 * @returns true if VP9 is supported
 */
export function isVP9Supported(): boolean {
  try {
    const capabilities = RTCRtpSender.getCapabilities("video");
    if (!capabilities || !capabilities.codecs) {
      return false;
    }

    return capabilities.codecs.some(
      (codec) =>
        codec.mimeType?.toLowerCase().includes("vp9") ||
        codec.mimeType?.toLowerCase().includes("vp09")
    );
  } catch {
    return false;
  }
}

/**
 * Determine if VP9 should be allowed based on device capabilities
 * PRIORITY: Stability over quality - prefer H.264 for stability
 * VP9 has better compression but higher CPU and less stability than H.264
 * @param qualityLevel Current quality level
 * @param videoWidth Current video width (to check if 1080p)
 * @returns true if VP9 should be allowed (disabled by default for stability)
 */
export function shouldAllowVP9(qualityLevel: string, videoWidth?: number): boolean {
  // STABILITY FIRST: Disable VP9 by default - prefer H.264 for stability
  // VP9 has higher CPU overhead and less hardware acceleration than H.264
  safeLog.log("📊 [CODEC] VP9 disabled by default (preferring H.264 for stability and smoothness)");
  return false;
  
  // Legacy code below (disabled for stability):
  /*
  if (!isVP9Supported()) {
    return false;
  }

  const isDesktop = !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  const isMobile = !isDesktop;
  const is1080p = videoWidth && videoWidth >= 1920;
  
  if (isMobile && is1080p) {
    return false;
  }

  if (isMobile && !isDesktop) {
    const highResLevels = ["excellent", "premium"];
    if (highResLevels.includes(qualityLevel)) {
      return false;
    }
  }

  return isDesktop;
  */
}


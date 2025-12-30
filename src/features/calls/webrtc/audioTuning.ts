// src/features/calls/webrtc/audioTuning.ts
// Opus audio codec tuning for optimal quality at low bitrates
// Configures Forward Error Correction (FEC) and Discontinuous Transmission (DTX)

import { safeLog } from "@/utils/security";
import type { QualityProfile } from "../config/callQualityProfiles";

/**
 * Apply Opus audio tuning to peer connection
 * @param pc RTCPeerConnection to apply audio tuning to
 * @param profile Quality profile to use for audio bitrate
 */
export async function applyAudioTuning(
  pc: RTCPeerConnection,
  profile: QualityProfile
): Promise<void> {
  try {
    const senders = pc.getSenders();
    const audioSenders = senders.filter(
      (sender) => sender.track && sender.track.kind === "audio"
    );

    if (audioSenders.length === 0) {
      safeLog.log("ℹ️ [AUDIO TUNING] No audio senders found");
      return;
    }

    for (const sender of audioSenders) {
      try {
        const params = sender.getParameters();

        // Some browsers may not support encodings
        if (!params.encodings || params.encodings.length === 0) {
          safeLog.log("ℹ️ [AUDIO TUNING] No encodings available for audio sender");
          continue;
        }

        // Set audio bitrate from profile
        params.encodings[0].maxBitrate = profile.audioKbps * 1000; // Convert to bps
        params.encodings[0].active = true;

        // Apply parameters
        await sender.setParameters(params);

        safeLog.log("✅ [AUDIO TUNING] Applied audio bitrate", {
          bitrate: profile.audioKbps + " kbps",
          trackId: sender.track?.id,
        });
      } catch (error) {
        safeLog.warn("⚠️ [AUDIO TUNING] Failed to set audio parameters:", error);
      }
    }

    // Configure Opus FEC/DTX via SDP modification
    // Note: SDP modification is done during offer/answer creation
    // We'll log the desired configuration here
    safeLog.log("📊 [AUDIO TUNING] Opus configuration", {
      fec: "enabled (useinbandfec=1)",
      dtx: "enabled (usedtx=1)",
      bitrate: profile.audioKbps + " kbps",
    });
  } catch (error) {
    safeLog.error("❌ [AUDIO TUNING] Error applying audio tuning:", error);
  }
}

/**
 * Modify SDP to enable Opus FEC and DTX
 * This should be called when creating offers/answers
 * @param sdp SDP string to modify
 * @returns Modified SDP string with Opus FEC/DTX enabled
 */
export function modifySDPForOpusFECDTX(sdp: string): string {
  // Enable Opus FEC (Forward Error Correction) and DTX (Discontinuous Transmission)
  // These improve audio quality at low bitrates and reduce bandwidth during silence

  let modifiedSDP = sdp;

  // Find Opus codec lines and add FEC/DTX parameters
  // Opus codec format: a=rtpmap:111 opus/48000/2
  // We need to add: a=fmtp:111 useinbandfec=1;usedtx=1

  const opusRtpMapRegex = /a=rtpmap:(\d+)\s+opus\/\d+\/\d+/g;
  const matches = Array.from(sdp.matchAll(opusRtpMapRegex));

  for (const match of matches) {
    const payloadType = match[1];
    const fmtpLine = `a=fmtp:${payloadType} useinbandfec=1;usedtx=1`;

    // Check if fmtp line already exists
    const existingFmtpRegex = new RegExp(`a=fmtp:${payloadType}[^\\r\\n]*`, "g");
    if (existingFmtpRegex.test(sdp)) {
      // Replace existing fmtp line
      modifiedSDP = modifiedSDP.replace(
        existingFmtpRegex,
        fmtpLine
      );
      safeLog.log("✅ [AUDIO TUNING] Updated existing Opus fmtp line", {
        payloadType,
      });
    } else {
      // Add new fmtp line after rtpmap line
      modifiedSDP = modifiedSDP.replace(
        match[0],
        `${match[0]}\r\n${fmtpLine}`
      );
      safeLog.log("✅ [AUDIO TUNING] Added Opus fmtp line", {
        payloadType,
      });
    }
  }

  if (matches.length > 0) {
    safeLog.log("✅ [AUDIO TUNING] SDP modified for Opus FEC/DTX", {
      opusCodecsFound: matches.length,
    });
  } else {
    safeLog.log("ℹ️ [AUDIO TUNING] No Opus codec found in SDP (may use different codec)");
  }

  return modifiedSDP;
}

/**
 * Check if Opus FEC/DTX is enabled in SDP
 * @param sdp SDP string to check
 * @returns true if FEC and DTX are enabled
 */
export function isOpusFECDTXEnabled(sdp: string): boolean {
  const fmtpRegex = /a=fmtp:\d+\s+[^\\r\\n]*useinbandfec=1[^\\r\\n]*usedtx=1/i;
  return fmtpRegex.test(sdp);
}




// src/features/calls/webrtc/mediaConstraints.ts
// Media constraint helpers for getUserMedia based on quality profiles
// Dynamically adjusts video/audio constraints based on network conditions

import { safeLog } from "@/utils/security";
import { QUALITY_PROFILES, type QualityLevel } from "../config/callQualityProfiles";

/**
 * Get media constraints for a specific quality level
 * @param level Quality level to get constraints for
 * @returns MediaStreamConstraints object for getUserMedia
 */
export function getMediaConstraintsForQuality(
  level: QualityLevel
): MediaStreamConstraints {
  const profile = QUALITY_PROFILES[level];

  // Audio constraints (same for all levels except critical)
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: { ideal: 48000 }, // 48 kHz for good quality
  };

  // Critical level: audio only
  if (level === "critical") {
    return {
      video: false,
      audio: audioConstraints,
    };
  }

  // Video constraints based on quality level
  const videoConstraints: MediaTrackConstraints = {
    width: { ideal: profile.videoWidth, max: profile.videoWidth },
    height: { ideal: profile.videoHeight, max: profile.videoHeight },
    frameRate: {
      ideal: profile.videoFps,
      max: profile.videoMaxFps,
    },
    facingMode: "user", // Front-facing camera
  };

  return {
    video: videoConstraints,
    audio: audioConstraints,
  };
}

/**
 * Network connection information
 */
export interface NetworkConnectionInfo {
  type?: string;
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
  rtt?: number;
}

/**
 * Get network connection information from navigator
 * @returns Network connection info or null if not available
 */
export function getNetworkConnectionInfo(): NetworkConnectionInfo | null {
  const connection = (navigator as Navigator & {
    connection?: NetworkConnectionInfo;
  }).connection;

  if (!connection) {
    return null;
  }

  return {
    type: connection.type,
    effectiveType: connection.effectiveType,
    saveData: connection.saveData,
    downlink: connection.downlink,
    rtt: connection.rtt,
  };
}

/**
 * Pick initial quality level from network conditions
 * @param effectiveType Network effective type (slow-2g, 2g, 3g, 4g)
 * @param saveDataFlag Whether data saver mode is enabled
 * @returns Initial quality level to use
 */
export function pickInitialQualityFromNetwork(
  effectiveType?: string,
  saveDataFlag?: boolean
): QualityLevel {
  // If data saver is enabled, cap at moderate
  if (saveDataFlag) {
    safeLog.log("📊 [MEDIA] Data saver enabled, capping quality at moderate");
    return "moderate";
  }

  // Map network effective type to quality level
  switch (effectiveType) {
    case "slow-2g":
    case "2g":
      safeLog.log("📊 [MEDIA] 2G network detected, using critical (audio-only)");
      return "critical";

    case "3g":
      safeLog.log("📊 [MEDIA] 3G network detected, using poor quality");
      return "poor";

    case "4g":
      safeLog.log("📊 [MEDIA] 4G network detected, using moderate quality");
      return "moderate";

    default:
      // For unknown or better connections (5G, WiFi), start with good
      // The adaptive quality controller will upgrade if bandwidth allows
      safeLog.log("📊 [MEDIA] Good network detected, using good quality");
      return "good";
  }
}

/**
 * Get initial quality level considering both network and data saver
 * @returns Initial quality level to use
 */
export function getInitialQualityLevel(): QualityLevel {
  const connectionInfo = getNetworkConnectionInfo();
  const effectiveType = connectionInfo?.effectiveType;
  const saveData = connectionInfo?.saveData ?? false;

  return pickInitialQualityFromNetwork(effectiveType, saveData);
}

/**
 * Adjust quality level for data saver mode
 * @param level Current quality level
 * @param saveData Whether data saver is enabled
 * @returns Adjusted quality level (capped at moderate if data saver is on)
 */
export function adjustQualityForDataSaver(
  level: QualityLevel,
  saveData: boolean
): QualityLevel {
  if (!saveData) {
    return level;
  }

  // Cap quality at moderate when data saver is enabled
  const levels: QualityLevel[] = [
    "critical",
    "poor",
    "moderate",
    "good",
    "excellent",
    "premium",
  ];
  const currentIndex = levels.indexOf(level);
  const moderateIndex = levels.indexOf("moderate");

  if (currentIndex > moderateIndex) {
    safeLog.log(
      "📊 [MEDIA] Data saver enabled, capping quality from",
      level,
      "to moderate"
    );
    return "moderate";
  }

  return level;
}


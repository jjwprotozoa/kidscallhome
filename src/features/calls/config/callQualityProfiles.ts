// src/features/calls/config/callQualityProfiles.ts
// Centralized call quality profile configuration
// Optimized for data efficiency (competitive with WhatsApp) while maintaining quality

// Quality levels from worst to best
export type QualityLevel = "critical" | "poor" | "moderate" | "good" | "excellent" | "premium";

// Quality profile configuration
export interface QualityProfile {
  name: string;
  // Video settings
  videoKbps: number;           // Video bitrate in kbps
  videoWidth: number;          // Video width in pixels
  videoHeight: number;         // Video height in pixels
  videoFps: number;            // Frames per second
  videoMaxFps: number;         // Maximum frames per second
  enableVideo: boolean;        // Whether to send video at all
  // Audio settings
  audioKbps: number;           // Audio bitrate in kbps (Opus)
  // Scaling (for use with scaleResolutionDownBy)
  scaleResolutionDownBy?: number;
}

// Quality profiles optimized for data efficiency
// Slightly more data-efficient than WhatsApp to ensure good performance on all networks
export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  // Audio-only for very poor connections (2G)
  critical: {
    name: "Audio Only (2G/Critical)",
    videoKbps: 0,
    videoWidth: 0,
    videoHeight: 0,
    videoFps: 0,
    videoMaxFps: 0,
    enableVideo: false,
    audioKbps: 18,              // Opus 16-20 kbps (using 18 as middle)
  },
  // Very low quality for poor connections (3G)
  poor: {
    name: "Low Quality (3G/Poor)",
    videoKbps: 110,             // 100-120 kbps video
    videoWidth: 320,
    videoHeight: 240,
    videoFps: 12,
    videoMaxFps: 15,
    enableVideo: true,
    audioKbps: 22,              // 20-24 kbps audio
    scaleResolutionDownBy: 4,
  },
  // Medium quality for moderate connections (4G)
  moderate: {
    name: "Medium Quality (4G/Moderate)",
    videoKbps: 325,             // 300-350 kbps video
    videoWidth: 640,
    videoHeight: 480,
    videoFps: 20,
    videoMaxFps: 24,
    enableVideo: true,
    audioKbps: 28,              // 24-32 kbps audio
    scaleResolutionDownBy: 2,
  },
  // High quality for good connections (LTE+)
  // 720p is the default "Good" ceiling for face video on mobile
  // STABILITY: Reduced bitrate and FPS for smoother performance
  good: {
    name: "High Quality (LTE+/Good)",
    videoKbps: 800,             // 750-850 kbps video (reduced for stability)
    videoWidth: 1280,
    videoHeight: 720,
    videoFps: 24,               // 24 fps for smoother performance (reduced from 30)
    videoMaxFps: 24,
    enableVideo: true,
    audioKbps: 36,              // 32-40 kbps audio
    scaleResolutionDownBy: 1,
  },
  // HD quality for excellent connections (5G/WiFi)
  // STABILITY: Reduced bitrate and FPS for smoother performance
  excellent: {
    name: "HD Quality (5G/WiFi)",
    videoKbps: 1400,            // 1300-1500 kbps video (reduced for stability)
    videoWidth: 1920,
    videoHeight: 1080,
    videoFps: 24,               // 24 fps for smoother performance (reduced from 30)
    videoMaxFps: 24,
    enableVideo: true,
    audioKbps: 44,             // 40-48 kbps audio
    scaleResolutionDownBy: 1,
  },
  // Premium quality for fiber/premium connections
  // STABILITY: Reduced bitrate and FPS for smoother performance
  premium: {
    name: "Full HD Quality (Fiber/Premium)",
    videoKbps: 1600,            // 1500-1700 kbps video (reduced for stability)
    videoWidth: 1920,
    videoHeight: 1080,
    videoFps: 24,               // 24 fps for smoother performance (reduced from 30)
    videoMaxFps: 24,
    enableVideo: true,
    audioKbps: 56,             // 48-64 kbps audio
    scaleResolutionDownBy: 1,
  },
};

// Helper function to get a quality profile by level
export function getQualityProfile(level: QualityLevel): QualityProfile {
  return QUALITY_PROFILES[level];
}

// Helper function to get all quality levels
export function getAllQualityLevels(): QualityLevel[] {
  return ["critical", "poor", "moderate", "good", "excellent", "premium"];
}

// Helper function to get next quality level (for upgrades)
export function getNextQualityLevel(current: QualityLevel): QualityLevel | null {
  const levels: QualityLevel[] = ["critical", "poor", "moderate", "good", "excellent", "premium"];
  const currentIndex = levels.indexOf(current);
  if (currentIndex < levels.length - 1) {
    return levels[currentIndex + 1];
  }
  return null;
}

// Helper function to get previous quality level (for downgrades)
export function getPreviousQualityLevel(current: QualityLevel): QualityLevel | null {
  const levels: QualityLevel[] = ["critical", "poor", "moderate", "good", "excellent", "premium"];
  const currentIndex = levels.indexOf(current);
  if (currentIndex > 0) {
    return levels[currentIndex - 1];
  }
  return null;
}


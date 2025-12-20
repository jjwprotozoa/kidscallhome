// src/features/calls/hooks/useNetworkQuality.ts
// Network quality monitoring and adaptive bitrate control for WebRTC calls
// Supports all network conditions from 2G to 5G/WiFi

import { useCallback, useEffect, useRef, useState } from "react";
import { safeLog } from "@/utils/security";

// Quality levels from worst to best
export type NetworkQualityLevel = "critical" | "poor" | "moderate" | "good" | "excellent" | "premium";

// Connection type detection
export type ConnectionType = "2g" | "3g" | "4g" | "5g" | "wifi" | "unknown";

// Quality presets for different network conditions
export interface QualityPreset {
  name: string;
  maxBitrate: number;        // kbps for video
  maxFramerate: number;
  maxWidth: number;
  maxHeight: number;
  audioBitrate: number;      // kbps for audio
  enableVideo: boolean;      // Whether to send video at all
  scaleResolutionDownBy?: number;
}

// Quality presets optimized for each network condition
export const QUALITY_PRESETS: Record<NetworkQualityLevel, QualityPreset> = {
  // 2G / Very poor signal - Audio only to ensure call works
  critical: {
    name: "Audio Only (2G/Critical)",
    maxBitrate: 0,           // No video
    maxFramerate: 0,
    maxWidth: 0,
    maxHeight: 0,
    audioBitrate: 24,        // Low quality audio (24kbps Opus)
    enableVideo: false,
  },
  // 3G / Poor signal - Very low quality video
  poor: {
    name: "Low Quality (3G/Poor)",
    maxBitrate: 150,         // 150kbps video
    maxFramerate: 15,
    maxWidth: 320,
    maxHeight: 240,
    audioBitrate: 32,        // Standard quality audio
    enableVideo: true,
    scaleResolutionDownBy: 4,
  },
  // 4G / Moderate - Medium quality video
  moderate: {
    name: "Medium Quality (4G/Moderate)",
    maxBitrate: 500,         // 500kbps video
    maxFramerate: 24,
    maxWidth: 640,
    maxHeight: 480,
    audioBitrate: 48,        // Good quality audio
    enableVideo: true,
    scaleResolutionDownBy: 2,
  },
  // LTE+ / Good signal - High quality video
  good: {
    name: "High Quality (LTE+/Good)",
    maxBitrate: 1500,        // 1.5Mbps video
    maxFramerate: 30,
    maxWidth: 1280,
    maxHeight: 720,
    audioBitrate: 64,        // High quality audio
    enableVideo: true,
    scaleResolutionDownBy: 1,
  },
  // 5G / Good WiFi / Excellent - HD quality
  excellent: {
    name: "HD Quality (5G/WiFi)",
    maxBitrate: 4000,        // 4Mbps video - bumped up for HD
    maxFramerate: 30,
    maxWidth: 1920,
    maxHeight: 1080,
    audioBitrate: 96,        // High quality audio (96kbps Opus)
    enableVideo: true,
    scaleResolutionDownBy: 1,
  },
  // Fiber / Premium WiFi - Full HD with higher bitrate for crisp video
  premium: {
    name: "Full HD Quality (Fiber/Premium)",
    maxBitrate: 8000,        // 8Mbps video - excellent for 1080p
    maxFramerate: 30,
    maxWidth: 1920,
    maxHeight: 1080,
    audioBitrate: 128,       // Studio quality audio (128kbps Opus)
    enableVideo: true,
    scaleResolutionDownBy: 1,
  },
};

// Bandwidth thresholds for quality level detection (in kbps)
const BANDWIDTH_THRESHOLDS = {
  critical: 100,    // Below 100kbps = audio only
  poor: 300,        // 100-300kbps = very low quality
  moderate: 800,    // 300-800kbps = medium quality
  good: 2000,       // 800-2000kbps = high quality (720p)
  excellent: 5000,  // 2000-5000kbps = HD quality (1080p)
  // Above 5000kbps (5Mbps) = premium (high bitrate 1080p for fiber)
};

// Stats collected from WebRTC
export interface NetworkStats {
  // Outbound stats
  outboundBitrate: number;           // Current outbound bitrate (kbps)
  outboundPacketLoss: number;        // Packet loss percentage (0-100)
  roundTripTime: number;             // RTT in milliseconds
  
  // Inbound stats  
  inboundBitrate: number;            // Current inbound bitrate (kbps)
  inboundPacketLoss: number;         // Packet loss percentage (0-100)
  
  // Estimated bandwidth
  availableBandwidth: number;        // Estimated available bandwidth (kbps)
  
  // Quality assessment
  qualityLevel: NetworkQualityLevel;
  connectionType: ConnectionType;
  qualityScore: number;              // 0-100 score
}

interface UseNetworkQualityReturn {
  // Current state
  networkStats: NetworkStats;
  currentPreset: QualityPreset;
  qualityLevel: NetworkQualityLevel;
  connectionType: ConnectionType;
  
  // Video enabled state
  isVideoEnabled: boolean;
  isVideoPausedDueToNetwork: boolean;
  
  // Manual controls
  forceAudioOnly: () => void;
  enableVideoIfPossible: () => void;
  
  // Apply quality to peer connection
  applyQualityPreset: (pc: RTCPeerConnection, preset?: QualityPreset) => Promise<void>;
  
  // Start/stop monitoring
  startMonitoring: (pc: RTCPeerConnection) => void;
  stopMonitoring: () => void;
}

// Detect initial connection type using Network Information API
function detectConnectionType(): ConnectionType {
  const connection = (navigator as Navigator & { 
    connection?: { 
      effectiveType?: string;
      type?: string;
      downlink?: number;
    } 
  }).connection;
  
  if (!connection) {
    return "unknown";
  }
  
  const effectiveType = connection.effectiveType;
  
  switch (effectiveType) {
    case "slow-2g":
    case "2g":
      return "2g";
    case "3g":
      return "3g";
    case "4g":
      // Check if it might be 5G (high downlink speed)
      if (connection.downlink && connection.downlink > 50) {
        return "5g";
      }
      return "4g";
    default:
      // Check connection type for WiFi
      if (connection.type === "wifi") {
        return "wifi";
      }
      return "unknown";
  }
}

// Get initial quality level based on connection type
function getInitialQualityLevel(connectionType: ConnectionType): NetworkQualityLevel {
  // Check for high-speed connection via Network Information API
  const connection = (navigator as Navigator & { 
    connection?: { 
      downlink?: number;
    } 
  }).connection;
  
  const downlinkMbps = connection?.downlink || 0;
  
  switch (connectionType) {
    case "2g":
      return "critical";
    case "3g":
      return "poor";
    case "4g":
      return "moderate";
    case "5g":
      // 5G is always fast enough for premium
      if (downlinkMbps >= 10) return "premium";
      return "excellent";
    case "wifi":
      // WiFi quality depends on reported bandwidth
      // Even 10Mbps fiber is plenty fast for premium video
      if (downlinkMbps >= 10) return "premium";  // Fiber or fast WiFi (10+ Mbps)
      if (downlinkMbps >= 5) return "excellent"; // Good WiFi (5-10 Mbps)
      return "good"; // Standard WiFi
    default:
      return "moderate"; // Default to moderate if unknown
  }
}

// Calculate quality level from bandwidth
function getQualityLevelFromBandwidth(bandwidthKbps: number): NetworkQualityLevel {
  if (bandwidthKbps < BANDWIDTH_THRESHOLDS.critical) return "critical";
  if (bandwidthKbps < BANDWIDTH_THRESHOLDS.poor) return "poor";
  if (bandwidthKbps < BANDWIDTH_THRESHOLDS.moderate) return "moderate";
  if (bandwidthKbps < BANDWIDTH_THRESHOLDS.good) return "good";
  if (bandwidthKbps < BANDWIDTH_THRESHOLDS.excellent) return "excellent";
  return "premium";
}

// Calculate quality score (0-100) from stats
function calculateQualityScore(stats: Partial<NetworkStats>): number {
  let score = 100;
  
  // Penalize for packet loss (each 1% loss = -10 points)
  const avgPacketLoss = ((stats.outboundPacketLoss || 0) + (stats.inboundPacketLoss || 0)) / 2;
  score -= avgPacketLoss * 10;
  
  // Penalize for high RTT (each 100ms over 100ms = -10 points)
  const rtt = stats.roundTripTime || 0;
  if (rtt > 100) {
    score -= Math.min(50, (rtt - 100) / 10);
  }
  
  // Bonus for high bandwidth
  const bandwidth = stats.availableBandwidth || 0;
  if (bandwidth > 5000) score += 15; // Premium tier (5+ Mbps - fiber/fast WiFi)
  else if (bandwidth > 2000) score += 10; // Excellent tier
  else if (bandwidth < 300) score -= 20;
  
  return Math.max(0, Math.min(100, score));
}

export const useNetworkQuality = (): UseNetworkQualityReturn => {
  // State
  const [connectionType, setConnectionType] = useState<ConnectionType>(detectConnectionType);
  const [qualityLevel, setQualityLevel] = useState<NetworkQualityLevel>(() => 
    getInitialQualityLevel(detectConnectionType())
  );
  const [currentPreset, setCurrentPreset] = useState<QualityPreset>(
    QUALITY_PRESETS[getInitialQualityLevel(detectConnectionType())]
  );
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isVideoPausedDueToNetwork, setIsVideoPausedDueToNetwork] = useState(false);
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    outboundBitrate: 0,
    outboundPacketLoss: 0,
    roundTripTime: 0,
    inboundBitrate: 0,
    inboundPacketLoss: 0,
    availableBandwidth: 1000, // Assume moderate bandwidth initially
    qualityLevel: "moderate",
    connectionType: "unknown",
    qualityScore: 75,
  });
  
  // Refs
  const monitoringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const previousStatsRef = useRef<Map<string, RTCStats>>(new Map());
  const previousTimestampRef = useRef<number>(0);
  const forceAudioOnlyRef = useRef(false);
  const consecutivePoorQualityRef = useRef(0);
  const consecutiveGoodQualityRef = useRef(0);
  
  // Apply quality preset to peer connection
  const applyQualityPreset = useCallback(async (
    pc: RTCPeerConnection, 
    preset?: QualityPreset
  ): Promise<void> => {
    const presetToApply = preset || currentPreset;
    
    const senders = pc.getSenders();
    
    // Skip if no senders yet (tracks not added)
    if (senders.length === 0) {
      safeLog.log("📊 [QUALITY] No senders yet, skipping quality preset application");
      return;
    }
    
    safeLog.log("📊 [QUALITY] Applying quality preset:", {
      name: presetToApply.name,
      maxBitrate: presetToApply.maxBitrate,
      maxFramerate: presetToApply.maxFramerate,
      resolution: `${presetToApply.maxWidth}x${presetToApply.maxHeight}`,
      enableVideo: presetToApply.enableVideo,
      senderCount: senders.length,
    });
    
    for (const sender of senders) {
      if (!sender.track) continue;
      
      try {
        const params = sender.getParameters();
        
        // Some browsers may not support encodings - skip if not available
        if (!params.encodings || params.encodings.length === 0) {
          safeLog.log("📊 [QUALITY] No encodings available for", sender.track.kind, "- skipping");
          continue;
        }
        
        if (sender.track.kind === "video") {
          // Handle video track
          if (!presetToApply.enableVideo || forceAudioOnlyRef.current) {
            // Disable video by setting maxBitrate to 0 and pausing track
            params.encodings[0].maxBitrate = 0;
            params.encodings[0].active = false;
            sender.track.enabled = false;
            setIsVideoPausedDueToNetwork(!forceAudioOnlyRef.current);
            
            safeLog.log("🎥 [QUALITY] Video DISABLED due to network conditions");
          } else {
            // Apply video quality settings
            params.encodings[0].maxBitrate = presetToApply.maxBitrate * 1000; // Convert to bps
            params.encodings[0].maxFramerate = presetToApply.maxFramerate;
            params.encodings[0].active = true;
            
            if (presetToApply.scaleResolutionDownBy) {
              params.encodings[0].scaleResolutionDownBy = presetToApply.scaleResolutionDownBy;
            }
            
            sender.track.enabled = true;
            setIsVideoPausedDueToNetwork(false);
            
            safeLog.log("🎥 [QUALITY] Video bitrate set to:", presetToApply.maxBitrate, "kbps");
          }
        } else if (sender.track.kind === "audio") {
          // Apply audio quality settings
          params.encodings[0].maxBitrate = presetToApply.audioBitrate * 1000; // Convert to bps
          params.encodings[0].active = true;
          
          // CRITICAL: Audio is ALWAYS enabled, even when video is disabled
          sender.track.enabled = true;
          
          safeLog.log("🔊 [QUALITY] Audio bitrate set to:", presetToApply.audioBitrate, "kbps");
        }
        
        await sender.setParameters(params);
      } catch (error) {
        // setParameters can fail for various reasons - log but don't break the call
        safeLog.warn("⚠️ [QUALITY] Failed to set parameters for", sender.track.kind, ":", error);
      }
    }
  }, [currentPreset]);
  
  // Collect stats from peer connection
  const collectStats = useCallback(async (): Promise<void> => {
    const pc = peerConnectionRef.current;
    // Skip if no peer connection or if it's in an unusable state
    if (!pc) return;
    
    const state = pc.connectionState;
    if (state === "closed" || state === "failed" || state === "disconnected") {
      safeLog.log("📊 [QUALITY] Skipping stats collection - connection state:", state);
      return;
    }
    
    try {
      const stats = await pc.getStats();
      const currentTimestamp = Date.now();
      const timeDelta = (currentTimestamp - previousTimestampRef.current) / 1000; // seconds
      
      let outboundBitrate = 0;
      let inboundBitrate = 0;
      let outboundPacketLoss = 0;
      let inboundPacketLoss = 0;
      let roundTripTime = 0;
      let availableBandwidth = 0;
      
      stats.forEach((report) => {
        // Get outbound video stats
        if (report.type === "outbound-rtp" && report.kind === "video") {
          const prevReport = previousStatsRef.current.get(report.id) as RTCOutboundRtpStreamStats | undefined;
          if (prevReport && timeDelta > 0) {
            const bytesSent = (report as RTCOutboundRtpStreamStats).bytesSent || 0;
            const prevBytesSent = prevReport.bytesSent || 0;
            outboundBitrate = ((bytesSent - prevBytesSent) * 8) / timeDelta / 1000; // kbps
          }
        }
        
        // Get inbound video stats
        if (report.type === "inbound-rtp" && report.kind === "video") {
          const prevReport = previousStatsRef.current.get(report.id) as RTCInboundRtpStreamStats | undefined;
          if (prevReport && timeDelta > 0) {
            const bytesReceived = (report as RTCInboundRtpStreamStats).bytesReceived || 0;
            const prevBytesReceived = prevReport.bytesReceived || 0;
            inboundBitrate = ((bytesReceived - prevBytesReceived) * 8) / timeDelta / 1000; // kbps
            
            // Calculate packet loss
            const packetsLost = (report as RTCInboundRtpStreamStats).packetsLost || 0;
            const packetsReceived = (report as RTCInboundRtpStreamStats).packetsReceived || 0;
            const prevPacketsLost = prevReport.packetsLost || 0;
            const prevPacketsReceived = prevReport.packetsReceived || 0;
            
            const deltaLost = packetsLost - prevPacketsLost;
            const deltaReceived = packetsReceived - prevPacketsReceived;
            
            if (deltaReceived + deltaLost > 0) {
              inboundPacketLoss = (deltaLost / (deltaReceived + deltaLost)) * 100;
            }
          }
        }
        
        // Get RTT from candidate pair
        if (report.type === "candidate-pair" && (report as RTCIceCandidatePairStats).state === "succeeded") {
          roundTripTime = ((report as RTCIceCandidatePairStats).currentRoundTripTime || 0) * 1000; // ms
          availableBandwidth = ((report as RTCIceCandidatePairStats).availableOutgoingBitrate || 0) / 1000; // kbps
        }
        
        // Get outbound packet loss from remote-inbound-rtp
        if (report.type === "remote-inbound-rtp" && report.kind === "video") {
          const remoteReport = report as RTCRemoteInboundRtpStreamStats;
          outboundPacketLoss = (remoteReport.fractionLost || 0) * 100;
        }
      });
      
      // Store current stats for next comparison
      const newPrevStats = new Map<string, RTCStats>();
      stats.forEach((report) => {
        newPrevStats.set(report.id, report);
      });
      previousStatsRef.current = newPrevStats;
      previousTimestampRef.current = currentTimestamp;
      
      // Estimate available bandwidth if not provided
      if (availableBandwidth === 0) {
        // Use current bitrates as rough estimate
        availableBandwidth = Math.max(outboundBitrate, inboundBitrate) * 1.5 || 1000;
      }
      
      // Determine quality level
      const newQualityLevel = getQualityLevelFromBandwidth(availableBandwidth);
      const qualityScore = calculateQualityScore({
        outboundBitrate,
        outboundPacketLoss,
        roundTripTime,
        inboundBitrate,
        inboundPacketLoss,
        availableBandwidth,
      });
      
      // Adjust quality level based on packet loss and RTT
      let adjustedQualityLevel = newQualityLevel;
      const levels: NetworkQualityLevel[] = ["critical", "poor", "moderate", "good", "excellent", "premium"];
      
      if (outboundPacketLoss > 10 || inboundPacketLoss > 10) {
        // High packet loss - drop quality
        const currentIndex = levels.indexOf(newQualityLevel);
        if (currentIndex > 0) {
          adjustedQualityLevel = levels[currentIndex - 1];
        }
      }
      if (roundTripTime > 500) {
        // High latency - drop quality
        const currentIndex = levels.indexOf(adjustedQualityLevel);
        if (currentIndex > 0) {
          adjustedQualityLevel = levels[currentIndex - 1];
        }
      }
      
      // Update network stats
      const newStats: NetworkStats = {
        outboundBitrate,
        outboundPacketLoss,
        roundTripTime,
        inboundBitrate,
        inboundPacketLoss,
        availableBandwidth,
        qualityLevel: adjustedQualityLevel,
        connectionType: detectConnectionType(),
        qualityScore,
      };
      
      setNetworkStats(newStats);
      setConnectionType(newStats.connectionType);
      
      // Hysteresis: Only change quality level after consistent readings
      if (adjustedQualityLevel !== qualityLevel) {
        if (
          adjustedQualityLevel === "critical" || 
          adjustedQualityLevel === "poor"
        ) {
          consecutivePoorQualityRef.current++;
          consecutiveGoodQualityRef.current = 0;
          
          // React quickly to poor quality (2 consecutive readings)
          if (consecutivePoorQualityRef.current >= 2) {
            safeLog.log("📊 [QUALITY] Network quality degraded:", adjustedQualityLevel);
            setQualityLevel(adjustedQualityLevel);
            setCurrentPreset(QUALITY_PRESETS[adjustedQualityLevel]);
            
            // Apply new quality preset
            if (pc) {
              applyQualityPreset(pc, QUALITY_PRESETS[adjustedQualityLevel]);
            }
            consecutivePoorQualityRef.current = 0;
          }
        } else {
          consecutiveGoodQualityRef.current++;
          consecutivePoorQualityRef.current = 0;
          
          // Be more cautious about upgrading quality (5 consecutive readings)
          if (consecutiveGoodQualityRef.current >= 5) {
            safeLog.log("📊 [QUALITY] Network quality improved:", adjustedQualityLevel);
            setQualityLevel(adjustedQualityLevel);
            setCurrentPreset(QUALITY_PRESETS[adjustedQualityLevel]);
            
            // Apply new quality preset
            if (pc) {
              applyQualityPreset(pc, QUALITY_PRESETS[adjustedQualityLevel]);
            }
            consecutiveGoodQualityRef.current = 0;
          }
        }
      } else {
        // Reset counters if quality is stable
        consecutivePoorQualityRef.current = 0;
        consecutiveGoodQualityRef.current = 0;
      }
      
      // Log stats periodically (every 10th collection to reduce spam)
      if (Math.random() < 0.1) {
        safeLog.log("📊 [QUALITY] Network stats:", {
          quality: adjustedQualityLevel,
          score: qualityScore,
          bandwidth: `${availableBandwidth.toFixed(0)} kbps`,
          rtt: `${roundTripTime.toFixed(0)} ms`,
          packetLoss: `${Math.max(outboundPacketLoss, inboundPacketLoss).toFixed(1)}%`,
          videoEnabled: isVideoEnabled && !isVideoPausedDueToNetwork,
        });
      }
    } catch (error) {
      safeLog.warn("⚠️ [QUALITY] Error collecting stats:", error);
    }
  }, [qualityLevel, applyQualityPreset, isVideoEnabled, isVideoPausedDueToNetwork]);
  
  // Start monitoring
  const startMonitoring = useCallback((pc: RTCPeerConnection) => {
    peerConnectionRef.current = pc;
    
    // Apply initial quality based on detected connection type
    const initialType = detectConnectionType();
    const initialLevel = getInitialQualityLevel(initialType);
    
    safeLog.log("📊 [QUALITY] Starting network quality monitoring:", {
      connectionType: initialType,
      initialQuality: initialLevel,
      preset: QUALITY_PRESETS[initialLevel].name,
    });
    
    setConnectionType(initialType);
    setQualityLevel(initialLevel);
    setCurrentPreset(QUALITY_PRESETS[initialLevel]);
    
    // Apply initial preset
    applyQualityPreset(pc, QUALITY_PRESETS[initialLevel]);
    
    // Start periodic stats collection (every 2 seconds)
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
    }
    monitoringIntervalRef.current = setInterval(collectStats, 2000);
    
    // Also listen for network changes
    const connection = (navigator as Navigator & { 
      connection?: { 
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      } 
    }).connection;
    
    if (connection) {
      const handleChange = () => {
        const newType = detectConnectionType();
        safeLog.log("📊 [QUALITY] Network type changed:", newType);
        setConnectionType(newType);
        // Trigger immediate quality reassessment
        collectStats();
      };
      
      connection.addEventListener("change", handleChange);
    }
  }, [applyQualityPreset, collectStats]);
  
  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    peerConnectionRef.current = null;
    previousStatsRef.current.clear();
    safeLog.log("📊 [QUALITY] Stopped network quality monitoring");
  }, []);
  
  // Manual controls
  const forceAudioOnly = useCallback(() => {
    forceAudioOnlyRef.current = true;
    setIsVideoEnabled(false);
    
    const pc = peerConnectionRef.current;
    if (pc) {
      applyQualityPreset(pc, QUALITY_PRESETS.critical);
    }
    
    safeLog.log("📊 [QUALITY] Forced audio-only mode");
  }, [applyQualityPreset]);
  
  const enableVideoIfPossible = useCallback(() => {
    forceAudioOnlyRef.current = false;
    
    // Only enable if network quality allows
    if (qualityLevel !== "critical") {
      setIsVideoEnabled(true);
      
      const pc = peerConnectionRef.current;
      if (pc) {
        applyQualityPreset(pc, QUALITY_PRESETS[qualityLevel]);
      }
      
      safeLog.log("📊 [QUALITY] Re-enabled video");
    } else {
      safeLog.log("📊 [QUALITY] Cannot enable video - network quality too poor");
    }
  }, [qualityLevel, applyQualityPreset]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);
  
  return {
    networkStats,
    currentPreset,
    qualityLevel,
    connectionType,
    isVideoEnabled,
    isVideoPausedDueToNetwork,
    forceAudioOnly,
    enableVideoIfPossible,
    applyQualityPreset,
    startMonitoring,
    stopMonitoring,
  };
};


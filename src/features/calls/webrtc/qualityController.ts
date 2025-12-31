// src/features/calls/webrtc/qualityController.ts
// Adaptive quality controller with stats-driven quality adjustment
// Implements hysteresis rules to prevent oscillation
// Includes battery-aware optimizations for low-power scenarios

import { safeLog } from "@/utils/security";
import { QUALITY_PROFILES, type QualityLevel } from "../config/callQualityProfiles";
import { getBatteryMonitor, type BatteryStatus } from "./batteryMonitor";

// RTCRemoteInboundRtpStreamStats type definition
// This type represents statistics for remote inbound RTP streams
// Reported via RTCP Receiver Report (RR) or Extended Report (XR)
interface RTCRemoteInboundRtpStreamStats extends RTCStats {
  kind?: "audio" | "video";
  ssrc: number;
  transportId: string;
  codecId?: string;
  fractionLost?: number; // Fraction of packets lost (0-1)
  packetsLost?: number;
  jitter?: number;
  roundTripTime?: number;
}

// Re-export BatteryStatus for use in other components
export type { BatteryStatus } from "./batteryMonitor";

/**
 * Quality change callback
 */
export type QualityChangeCallback = (newLevel: QualityLevel) => void;

/**
 * Network statistics from WebRTC
 */
export interface QualityControllerStats {
  outboundBitrate: number;      // kbps
  inboundBitrate: number;        // kbps
  outboundPacketLoss: number;   // percentage (0-100)
  inboundPacketLoss: number;    // percentage (0-100)
  roundTripTime: number;         // milliseconds
  jitter: number;               // milliseconds
  nackCount?: number;           // Number of NACK packets (retransmission requests)
}

/**
 * Options for quality controller
 */
export interface QualityControllerOptions {
  onQualityChange?: QualityChangeCallback;
  statsInterval?: number;       // milliseconds (default: 2000)
  cooldownPeriod?: number;       // milliseconds (default: 12000)
  enableBatteryOptimizations?: boolean; // Enable battery-aware quality adjustments (default: true)
}

/**
 * Adaptive quality controller class
 */
export class QualityController {
  private pc: RTCPeerConnection | null = null;
  private currentQuality: QualityLevel;
  private options: Required<QualityControllerOptions> & { enableBatteryOptimizations: boolean };
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private previousStats: Map<string, RTCStats> = new Map();
  private previousTimestamp: number = 0;
  private lastQualityChangeTime: number = 0;
  private consecutivePoorSamples: number = 0;
  private consecutiveGoodSamples: number = 0;
  private isRunning: boolean = false;
  private batteryStatus: BatteryStatus | null = null;
  private batteryUnsubscribe: (() => void) | null = null;
  private previousNackCount: number = 0;

  constructor(
    initialQuality: QualityLevel,
    options: QualityControllerOptions = {}
  ) {
    this.currentQuality = initialQuality;
    this.options = {
      onQualityChange: options.onQualityChange || (() => {}),
      statsInterval: options.statsInterval || 2000,
      cooldownPeriod: options.cooldownPeriod || 12000,
      enableBatteryOptimizations: options.enableBatteryOptimizations !== false, // Default: true
    };
  }

  /**
   * Start quality monitoring
   */
  async start(pc: RTCPeerConnection): Promise<void> {
    if (this.isRunning) {
      safeLog.warn("⚠️ [QUALITY CONTROLLER] Already running");
      return;
    }

    this.pc = pc;
    this.isRunning = true;
    this.previousTimestamp = Date.now();

    // Start battery monitoring if enabled
    if (this.options.enableBatteryOptimizations) {
      try {
        const batteryMonitor = getBatteryMonitor();
        await batteryMonitor.start();
        
        // Subscribe to battery status changes
        this.batteryUnsubscribe = batteryMonitor.onStatusChange((status) => {
          this.batteryStatus = status;
          safeLog.log("🔋 [QUALITY CONTROLLER] Battery status updated", {
            level: (status.level * 100).toFixed(0) + "%",
            charging: status.charging,
            isLow: status.isLow,
            isCritical: status.isCritical,
          });
          
          // If battery becomes critical, immediately adjust quality
          if (status.isCritical && !status.charging) {
            this.applyBatteryOptimizations();
          }
        });
        
        // Get initial battery status
        this.batteryStatus = batteryMonitor.getStatus();
      } catch (error) {
        safeLog.warn("⚠️ [QUALITY CONTROLLER] Failed to start battery monitoring:", error);
      }
    }

    safeLog.log("✅ [QUALITY CONTROLLER] Started quality monitoring", {
      initialQuality: this.currentQuality,
      statsInterval: this.options.statsInterval,
      cooldownPeriod: this.options.cooldownPeriod,
      batteryOptimizations: this.options.enableBatteryOptimizations,
    });

    // Start periodic stats collection
    this.statsInterval = setInterval(() => {
      this.collectAndAnalyzeStats();
    }, this.options.statsInterval);
  }

  /**
   * Stop quality monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.pc = null;

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Unsubscribe from battery monitoring
    if (this.batteryUnsubscribe) {
      this.batteryUnsubscribe();
      this.batteryUnsubscribe = null;
    }

    this.previousStats.clear();
    this.consecutivePoorSamples = 0;
    this.consecutiveGoodSamples = 0;
    this.batteryStatus = null;
    this.previousNackCount = 0;

    safeLog.log("🛑 [QUALITY CONTROLLER] Stopped quality monitoring");
  }

  /**
   * Get current quality level
   */
  getCurrentQuality(): QualityLevel {
    return this.currentQuality;
  }

  /**
   * Get current battery status
   */
  getBatteryStatus(): BatteryStatus | null {
    return this.batteryStatus;
  }

  /**
   * Collect and analyze WebRTC stats
   */
  private async collectAndAnalyzeStats(): Promise<void> {
    if (!this.pc) {
      return;
    }

    const state = this.pc.connectionState;
    if (state === "closed" || state === "failed" || state === "disconnected") {
      return;
    }

    try {
      const stats = await this.pc.getStats();
      const currentTimestamp = Date.now();
      const timeDelta = (currentTimestamp - this.previousTimestamp) / 1000; // seconds

      if (timeDelta <= 0) {
        return;
      }

      const controllerStats = this.extractStats(stats, timeDelta);
      
      // Reduce FPS on high NACKs before analyzing quality
      if (controllerStats.nackCount && controllerStats.nackCount > 10) {
        this.reduceFpsOnHighNacks(controllerStats.nackCount);
      }
      
      this.analyzeAndAdjustQuality(controllerStats);

      // Store stats for next comparison
      const newPrevStats = new Map<string, RTCStats>();
      stats.forEach((report) => {
        newPrevStats.set(report.id, report);
      });
      this.previousStats = newPrevStats;
      this.previousTimestamp = currentTimestamp;
    } catch (error) {
      safeLog.warn("⚠️ [QUALITY CONTROLLER] Error collecting stats:", error);
    }
  }

  /**
   * Extract statistics from WebRTC stats
   */
  private extractStats(
    stats: RTCStatsReport,
    timeDelta: number
  ): QualityControllerStats {
    let outboundBitrate = 0;
    let inboundBitrate = 0;
    let outboundPacketLoss = 0;
    let inboundPacketLoss = 0;
    let roundTripTime = 0;
    let jitter = 0;

    stats.forEach((report) => {
      // Outbound video stats
      if (report.type === "outbound-rtp" && report.kind === "video") {
        const prevReport = this.previousStats.get(
          report.id
        ) as RTCOutboundRtpStreamStats | undefined;
        if (prevReport && timeDelta > 0) {
          const bytesSent = (report as RTCOutboundRtpStreamStats).bytesSent || 0;
          const prevBytesSent = prevReport.bytesSent || 0;
          outboundBitrate = ((bytesSent - prevBytesSent) * 8) / timeDelta / 1000; // kbps
        }
      }

      // Inbound video stats
      if (report.type === "inbound-rtp" && report.kind === "video") {
        const prevReport = this.previousStats.get(
          report.id
        ) as RTCInboundRtpStreamStats | undefined;
        if (prevReport && timeDelta > 0) {
          const bytesReceived =
            (report as RTCInboundRtpStreamStats).bytesReceived || 0;
          const prevBytesReceived = prevReport.bytesReceived || 0;
          inboundBitrate =
            ((bytesReceived - prevBytesReceived) * 8) / timeDelta / 1000; // kbps

          // Calculate packet loss
          const packetsLost =
            (report as RTCInboundRtpStreamStats).packetsLost || 0;
          const packetsReceived =
            (report as RTCInboundRtpStreamStats).packetsReceived || 0;
          const prevPacketsLost = prevReport.packetsLost || 0;
          const prevPacketsReceived = prevReport.packetsReceived || 0;

          const deltaLost = packetsLost - prevPacketsLost;
          const deltaReceived = packetsReceived - prevPacketsReceived;

          if (deltaReceived + deltaLost > 0) {
            inboundPacketLoss =
              (deltaLost / (deltaReceived + deltaLost)) * 100;
          }

          // Jitter
          jitter = (report as RTCInboundRtpStreamStats).jitter || 0;
        }
      }

      // RTT from candidate pair
      if (
        report.type === "candidate-pair" &&
        (report as RTCIceCandidatePairStats).state === "succeeded"
      ) {
        roundTripTime =
          ((report as RTCIceCandidatePairStats).currentRoundTripTime || 0) *
          1000; // ms
      }

      // Outbound packet loss from remote-inbound-rtp
      if (report.type === "remote-inbound-rtp" && report.kind === "video") {
        const remoteReport = report as RTCRemoteInboundRtpStreamStats;
        outboundPacketLoss = (remoteReport.fractionLost || 0) * 100;
      }

      // NACK count from outbound-rtp (retransmission requests indicate packet loss)
      if (report.type === "outbound-rtp" && report.kind === "video") {
        const outboundReport = report as RTCOutboundRtpStreamStats;
        // nackCount is cumulative, so we track the delta
        const currentNackCount = outboundReport.nackCount || 0;
        // We'll calculate the delta in analyzeAndAdjustQuality
      }
    });

    // Calculate NACK delta
    let nackCount = 0;
    stats.forEach((report) => {
      if (report.type === "outbound-rtp" && report.kind === "video") {
        const outboundReport = report as RTCOutboundRtpStreamStats;
        const currentNackCount = outboundReport.nackCount || 0;
        nackCount = currentNackCount - this.previousNackCount;
        // Update for next iteration
        this.previousNackCount = currentNackCount;
      }
    });

    return {
      outboundBitrate,
      inboundBitrate,
      outboundPacketLoss,
      inboundPacketLoss,
      roundTripTime,
      jitter,
      nackCount,
    };
  }

  /**
   * Analyze stats and adjust quality if needed
   */
  private analyzeAndAdjustQuality(stats: QualityControllerStats): void {
    const levels: QualityLevel[] = [
      "critical",
      "poor",
      "moderate",
      "good",
      "excellent",
      "premium",
    ];
    const currentIndex = levels.indexOf(this.currentQuality);

    // Apply battery optimizations first (if battery is low)
    if (this.options.enableBatteryOptimizations && this.batteryStatus) {
      const batteryAdjustment = this.getBatteryQualityAdjustment();
      if (batteryAdjustment) {
        const batteryIndex = levels.indexOf(batteryAdjustment);
        if (batteryIndex < currentIndex) {
          safeLog.log("🔋 [QUALITY CONTROLLER] Battery optimization: downgrading for low battery", {
            from: this.currentQuality,
            to: batteryAdjustment,
            batteryLevel: (this.batteryStatus.level * 100).toFixed(0) + "%",
            charging: this.batteryStatus.charging,
          });
          this.changeQuality(batteryAdjustment);
          return; // Battery optimization takes priority
        }
      }
    }

    // Calculate average packet loss
    const avgPacketLoss =
      (stats.outboundPacketLoss + stats.inboundPacketLoss) / 2;

    // HARD BRAKE: Immediate action for severe conditions
    // Drop fps and/or resolution immediately when RTT > 400ms or loss > 10%
    if (stats.roundTripTime > 400 || avgPacketLoss > 10) {
      if (this.currentQuality !== "critical") {
        // If at excellent/premium, drop to good (720p)
        if (this.currentQuality === "excellent" || this.currentQuality === "premium") {
          safeLog.log("🚨 [QUALITY CONTROLLER] HARD BRAKE: Severe conditions, dropping to 720p", {
            packetLoss: avgPacketLoss.toFixed(1) + "%",
            rtt: stats.roundTripTime.toFixed(0) + "ms",
            from: this.currentQuality,
            to: "good",
          });
          this.changeQuality("good");
          this.consecutivePoorSamples = 0;
          this.consecutiveGoodSamples = 0;
          return;
        }
        // If at good or below, consider dropping further
        if (this.currentQuality === "good" && (avgPacketLoss > 15 || stats.roundTripTime > 500)) {
          safeLog.log("🚨 [QUALITY CONTROLLER] HARD BRAKE: Critical conditions, forcing audio-only", {
            packetLoss: avgPacketLoss.toFixed(1) + "%",
            rtt: stats.roundTripTime.toFixed(0) + "ms",
          });
          this.changeQuality("critical");
          this.consecutivePoorSamples = 0;
          this.consecutiveGoodSamples = 0;
          return;
        }
      }
    }

    // Check for severe conditions (force critical/audio-only)
    if (avgPacketLoss > 15 || stats.roundTripTime > 500) {
      if (this.currentQuality !== "critical") {
        safeLog.log("📊 [QUALITY CONTROLLER] Severe conditions detected, forcing critical", {
          packetLoss: avgPacketLoss.toFixed(1) + "%",
          rtt: stats.roundTripTime.toFixed(0) + "ms",
        });
        this.changeQuality("critical");
        this.consecutivePoorSamples = 0;
        this.consecutiveGoodSamples = 0;
        return;
      }
    }

    // Get minimum bitrate for current quality
    const currentProfile = QUALITY_PROFILES[this.currentQuality];
    const minBitrate = currentProfile.videoKbps * 0.8; // 80% of target

    // Check if we should downgrade
    // More aggressive thresholds: packet loss > 3-5% triggers downgrade
    const shouldDowngrade =
      stats.outboundBitrate < minBitrate ||
      avgPacketLoss > 3 ||  // Lowered from 5% to 3% for faster response
      stats.roundTripTime > 300 ||
      (stats.nackCount && stats.nackCount > 10); // High NACK count indicates packet loss

    if (shouldDowngrade) {
      this.consecutivePoorSamples++;
      this.consecutiveGoodSamples = 0;

      // Downgrade faster: 1-2 consecutive poor samples (2-4 seconds)
      if (this.consecutivePoorSamples >= 1 && currentIndex > 0) {
        const newLevel = levels[currentIndex - 1];
        safeLog.log("📊 [QUALITY CONTROLLER] Downgrading quality", {
          from: this.currentQuality,
          to: newLevel,
          reason: {
            bitrate: stats.outboundBitrate.toFixed(0) + " kbps",
            packetLoss: avgPacketLoss.toFixed(1) + "%",
            rtt: stats.roundTripTime.toFixed(0) + "ms",
            nackCount: stats.nackCount || 0,
          },
        });
        this.changeQuality(newLevel);
        this.consecutivePoorSamples = 0;
      }
    } else {
      // Check if we should upgrade
      // BUT: Don't upgrade if battery is low (unless charging)
      const canUpgrade = !this.batteryStatus || 
                         this.batteryStatus.charging || 
                         (!this.batteryStatus.isLow && !this.batteryStatus.isCritical);

      if (canUpgrade) {
        this.consecutiveGoodSamples++;
        this.consecutivePoorSamples = 0;

        // STABILITY FIRST: Upgrade very slowly - 8-10 consecutive good samples (16-20 seconds)
        // This prevents overshooting on flaky connections and prioritizes stability
        if (
          this.consecutiveGoodSamples >= 8 &&
          currentIndex < levels.length - 1
        ) {
          const nextLevel = levels[currentIndex + 1];
          const nextProfile = QUALITY_PROFILES[nextLevel];
          const hasEnoughBandwidth = stats.outboundBitrate >= nextProfile.videoKbps * 0.95; // Require 95% (was 90%)

          // Very strict upgrade requirements: keep loss < 1% and RTT < 150ms
          if (hasEnoughBandwidth && avgPacketLoss < 1.0 && stats.roundTripTime < 150) {
            safeLog.log("📊 [QUALITY CONTROLLER] Upgrading quality", {
              from: this.currentQuality,
              to: nextLevel,
              reason: {
                bitrate: stats.outboundBitrate.toFixed(0) + " kbps",
                packetLoss: avgPacketLoss.toFixed(1) + "%",
                rtt: stats.roundTripTime.toFixed(0) + "ms",
              },
            });
            this.changeQuality(nextLevel);
            this.consecutiveGoodSamples = 0;
          }
        }
      } else {
        // Battery is low - prevent upgrades to save power
        safeLog.log("🔋 [QUALITY CONTROLLER] Preventing quality upgrade due to low battery", {
          batteryLevel: this.batteryStatus ? (this.batteryStatus.level * 100).toFixed(0) + "%" : "unknown",
        });
      }
    }
  }

  /**
   * Get recommended quality adjustment based on battery status
   */
  private getBatteryQualityAdjustment(): QualityLevel | null {
    if (!this.batteryStatus || this.batteryStatus.charging) {
      return null; // No adjustment if charging or unknown
    }

    const levels: QualityLevel[] = [
      "critical",
      "poor",
      "moderate",
      "good",
      "excellent",
      "premium",
    ];
    const currentIndex = levels.indexOf(this.currentQuality);

    // Critical battery (< 10%): force audio-only
    if (this.batteryStatus.isCritical) {
      return "critical";
    }

    // Low battery (< 20%): downgrade by one level
    if (this.batteryStatus.isLow && currentIndex > 0) {
      return levels[currentIndex - 1];
    }

    return null;
  }

  /**
   * Apply battery optimizations immediately
   */
  private applyBatteryOptimizations(): void {
    const adjustment = this.getBatteryQualityAdjustment();
    if (adjustment && adjustment !== this.currentQuality) {
      safeLog.log("🔋 [QUALITY CONTROLLER] Applying battery optimizations", {
        from: this.currentQuality,
        to: adjustment,
        batteryLevel: this.batteryStatus ? (this.batteryStatus.level * 100).toFixed(0) + "%" : "unknown",
      });
      this.changeQuality(adjustment);
    }
  }

  /**
   * Reduce FPS on high NACK count to reduce packet loss
   * When hitting repeated NACKs, lower both bitrate and fps (e.g. 30 → 20 → 15)
   * Reducing frame rate is often more effective at hiding loss on constrained mobile networks
   */
  private async reduceFpsOnHighNacks(nackCount: number): Promise<void> {
    if (!this.pc || nackCount <= 10) {
      return; // Only reduce if NACK count is significant
    }

    const senders = this.pc.getSenders();
    const videoSenders = senders.filter(
      (sender) => sender.track && sender.track.kind === "video"
    );

    for (const sender of videoSenders) {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          continue;
        }

        const currentFps = params.encodings[0].maxFramerate || 30;
        
        // Progressive FPS reduction: 30 → 20 → 15 → 12
        let newFps = currentFps;
        if (nackCount > 20 && currentFps > 20) {
          newFps = 20;
        } else if (nackCount > 15 && currentFps > 15) {
          newFps = 15;
        } else if (nackCount > 12 && currentFps > 12) {
          newFps = 12;
        }

        if (newFps !== currentFps) {
          params.encodings[0].maxFramerate = newFps;
          await sender.setParameters(params);
          safeLog.log("📊 [QUALITY CONTROLLER] Reduced FPS due to high NACKs", {
            from: currentFps,
            to: newFps,
            nackCount,
          });
        }
      } catch (error) {
        safeLog.warn("⚠️ [QUALITY CONTROLLER] Failed to reduce FPS:", error);
      }
    }
  }

  /**
   * Change quality level (with cooldown)
   */
  private changeQuality(newLevel: QualityLevel): void {
    const now = Date.now();
    const timeSinceLastChange = now - this.lastQualityChangeTime;

    // Enforce cooldown period
    if (timeSinceLastChange < this.options.cooldownPeriod) {
      safeLog.log("⏳ [QUALITY CONTROLLER] Quality change cooldown active", {
        timeRemaining: Math.ceil(
          (this.options.cooldownPeriod - timeSinceLastChange) / 1000
        ) + "s",
      });
      return;
    }

    if (newLevel === this.currentQuality) {
      return;
    }

    this.currentQuality = newLevel;
    this.lastQualityChangeTime = now;

    // Call callback
    this.options.onQualityChange(newLevel);
  }
}


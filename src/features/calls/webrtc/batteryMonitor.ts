// src/features/calls/webrtc/batteryMonitor.ts
// Battery monitoring for low-power optimizations during calls
// Detects low battery and triggers quality adjustments to preserve battery life

import { safeLog } from "@/utils/security";

/**
 * Battery status information
 */
export interface BatteryStatus {
  level: number;              // 0.0 to 1.0 (0% to 100%)
  charging: boolean;           // Whether device is charging
  chargingTime: number;        // Seconds until fully charged (Infinity if not charging)
  dischargingTime: number;     // Seconds until battery empty (Infinity if charging)
  isLow: boolean;              // True if battery is low (< 20%)
  isCritical: boolean;         // True if battery is critical (< 10%)
}

/**
 * Battery change callback
 */
export type BatteryChangeCallback = (status: BatteryStatus) => void;

/**
 * Battery monitor class
 * Monitors device battery level and triggers callbacks when battery status changes
 */
export class BatteryMonitor {
  private batteryManager: BatteryManager | null = null;
  private callbacks: Set<BatteryChangeCallback> = new Set();
  private currentStatus: BatteryStatus | null = null;
  private isMonitoring: boolean = false;

  /**
   * Start monitoring battery status
   * @returns Promise that resolves when monitoring starts
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      safeLog.warn("⚠️ [BATTERY] Already monitoring battery");
      return;
    }

    // Check if Battery Status API is available
    if ('getBattery' in navigator) {
      try {
        // @ts-expect-error - Battery API is not in TypeScript types but exists in some browsers
        const battery = await navigator.getBattery();
        this.batteryManager = battery;
        this.isMonitoring = true;

        // Get initial status
        this.updateStatus();

        // Listen for battery changes
        battery.addEventListener('chargingchange', () => this.updateStatus());
        battery.addEventListener('levelchange', () => this.updateStatus());
        battery.addEventListener('chargingtimechange', () => this.updateStatus());
        battery.addEventListener('dischargingtimechange', () => this.updateStatus());

        safeLog.log("✅ [BATTERY] Battery monitoring started", this.currentStatus);
      } catch (error) {
        safeLog.warn("⚠️ [BATTERY] Failed to access battery API:", error);
        // Fallback: assume unknown status
        this.setUnknownStatus();
      }
    } else {
      // Battery API not available - use fallback detection
      safeLog.log("📊 [BATTERY] Battery API not available, using fallback detection");
      this.setUnknownStatus();
    }
  }

  /**
   * Stop monitoring battery status
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.batteryManager) {
      this.batteryManager.removeEventListener('chargingchange', () => this.updateStatus());
      this.batteryManager.removeEventListener('levelchange', () => this.updateStatus());
      this.batteryManager.removeEventListener('chargingtimechange', () => this.updateStatus());
      this.batteryManager.removeEventListener('dischargingtimechange', () => this.updateStatus());
      this.batteryManager = null;
    }

    safeLog.log("🛑 [BATTERY] Battery monitoring stopped");
  }

  /**
   * Update battery status from BatteryManager
   */
  private updateStatus(): void {
    if (!this.batteryManager) {
      return;
    }

    const level = this.batteryManager.level;
    const charging = this.batteryManager.charging;
    const chargingTime = this.batteryManager.chargingTime;
    const dischargingTime = this.batteryManager.dischargingTime;

    const status: BatteryStatus = {
      level,
      charging,
      chargingTime,
      dischargingTime,
      isLow: !charging && level < 0.2,      // < 20% and not charging
      isCritical: !charging && level < 0.1, // < 10% and not charging
    };

    const previousStatus = this.currentStatus;
    this.currentStatus = status;

    // Only notify if status changed significantly
    if (!previousStatus || 
        previousStatus.isLow !== status.isLow ||
        previousStatus.isCritical !== status.isCritical ||
        Math.abs(previousStatus.level - status.level) > 0.05) {
      safeLog.log("🔋 [BATTERY] Status updated", status);
      this.notifyCallbacks(status);
    }
  }

  /**
   * Set unknown status (when Battery API is not available)
   */
  private setUnknownStatus(): void {
    // When battery API is unavailable, we can't detect low battery
    // But we can still provide a status object for consistency
    this.currentStatus = {
      level: 1.0,              // Assume full (unknown)
      charging: false,         // Unknown
      chargingTime: Infinity,
      dischargingTime: Infinity,
      isLow: false,
      isCritical: false,
    };
    this.isMonitoring = true;
  }

  /**
   * Get current battery status
   */
  getStatus(): BatteryStatus | null {
    return this.currentStatus;
  }

  /**
   * Add callback for battery status changes
   */
  onStatusChange(callback: BatteryChangeCallback): () => void {
    this.callbacks.add(callback);

    // Immediately call with current status if available
    if (this.currentStatus) {
      callback(this.currentStatus);
    }

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notify all callbacks of status change
   */
  private notifyCallbacks(status: BatteryStatus): void {
    this.callbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        safeLog.warn("⚠️ [BATTERY] Error in battery callback:", error);
      }
    });
  }

  /**
   * Check if battery optimizations should be applied
   * Returns true if battery is low and not charging
   */
  shouldApplyOptimizations(): boolean {
    if (!this.currentStatus) {
      return false;
    }

    // Apply optimizations if battery is low and not charging
    return this.currentStatus.isLow && !this.currentStatus.charging;
  }

  /**
   * Get recommended quality adjustment based on battery
   * Returns a quality level adjustment (downgrade if battery is low)
   */
  getRecommendedQualityAdjustment(currentQuality: string): string | null {
    if (!this.currentStatus) {
      return null;
    }

    // If charging, no adjustment needed
    if (this.currentStatus.charging) {
      return null;
    }

    // Critical battery: recommend audio-only
    if (this.currentStatus.isCritical) {
      return "critical";
    }

    // Low battery: downgrade by one level
    if (this.currentStatus.isLow) {
      const levels = ["critical", "poor", "moderate", "good", "excellent", "premium"];
      const currentIndex = levels.indexOf(currentQuality);
      if (currentIndex > 0) {
        return levels[currentIndex - 1];
      }
    }

    return null;
  }
}

// Global battery monitor instance
let globalBatteryMonitor: BatteryMonitor | null = null;

/**
 * Get or create global battery monitor instance
 */
export function getBatteryMonitor(): BatteryMonitor {
  if (!globalBatteryMonitor) {
    globalBatteryMonitor = new BatteryMonitor();
  }
  return globalBatteryMonitor;
}

/**
 * Battery Manager interface (for TypeScript)
 */
interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
}


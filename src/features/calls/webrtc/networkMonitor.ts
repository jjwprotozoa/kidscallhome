// src/features/calls/webrtc/networkMonitor.ts
// Network change monitoring and ICE restart detection
// Handles network transitions (WiFi ↔ cellular) and triggers ICE restart when needed

import { safeLog } from "@/utils/security";

/**
 * Network connection information
 */
export interface NetworkConnectionInfo {
  type?: string;
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
  rtt?: number;
  downlinkMax?: number;
}

/**
 * Get current network connection information
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
    downlinkMax: connection.downlinkMax,
  };
}

/**
 * Check if network type changed significantly
 * @param previous Previous network info
 * @param next Next network info
 * @returns true if network type changed (WiFi ↔ cellular)
 */
function hasNetworkTypeChanged(
  previous: NetworkConnectionInfo | null,
  next: NetworkConnectionInfo | null
): boolean {
  if (!previous || !next) {
    return false;
  }

  const prevType = previous.type;
  const nextType = next.type;

  // Network type changed (e.g., wifi ↔ cellular)
  if (prevType && nextType && prevType !== nextType) {
    return true;
  }

  // Effective type changed significantly (e.g., 4g → 2g)
  const prevEffective = previous.effectiveType;
  const nextEffective = next.effectiveType;

  if (prevEffective && nextEffective && prevEffective !== nextEffective) {
    // Consider it significant if moving between major categories
    const majorCategories = ["slow-2g", "2g", "3g", "4g"];
    const prevIsMajor = majorCategories.includes(prevEffective);
    const nextIsMajor = majorCategories.includes(nextEffective);

    if (prevIsMajor && nextIsMajor && prevEffective !== nextEffective) {
      return true;
    }
  }

  return false;
}

/**
 * Check if bandwidth changed significantly
 * @param previous Previous network info
 * @param next Next network info
 * @returns true if bandwidth changed significantly (>50% change)
 */
function hasBandwidthChangedSignificantly(
  previous: NetworkConnectionInfo | null,
  next: NetworkConnectionInfo | null
): boolean {
  if (!previous || !next) {
    return false;
  }

  const prevDownlink = previous.downlinkMax || previous.downlink || 0;
  const nextDownlink = next.downlinkMax || next.downlink || 0;

  // If either is 0, can't compare
  if (prevDownlink === 0 || nextDownlink === 0) {
    return false;
  }

  // Check if change is >50%
  const changeRatio = Math.abs(nextDownlink - prevDownlink) / Math.max(prevDownlink, nextDownlink);
  return changeRatio > 0.5;
}

/**
 * Check if RTT changed significantly
 * @param previous Previous network info
 * @param next Next network info
 * @returns true if RTT changed significantly (>100ms change or >50% change)
 */
function hasRTTChangedSignificantly(
  previous: NetworkConnectionInfo | null,
  next: NetworkConnectionInfo | null
): boolean {
  if (!previous || !next) {
    return false;
  }

  const prevRTT = previous.rtt || 0;
  const nextRTT = next.rtt || 0;

  // If either is 0, can't compare
  if (prevRTT === 0 || nextRTT === 0) {
    return false;
  }

  // Check if change is >100ms or >50%
  const changeMs = Math.abs(nextRTT - prevRTT);
  const changeRatio = changeMs / Math.max(prevRTT, nextRTT);

  return changeMs > 100 || changeRatio > 0.5;
}

/**
 * Determine if ICE restart should be triggered based on network changes
 * @param previousInfo Previous network connection info
 * @param nextInfo Next network connection info
 * @returns true if ICE restart should be triggered
 */
export function shouldTriggerIceRestart(
  previousInfo: NetworkConnectionInfo | null,
  nextInfo: NetworkConnectionInfo | null
): boolean {
  if (!previousInfo || !nextInfo) {
    return false;
  }

  // Network type changed (WiFi ↔ cellular)
  if (hasNetworkTypeChanged(previousInfo, nextInfo)) {
    safeLog.log("📡 [NETWORK] Network type changed, ICE restart recommended");
    return true;
  }

  // Bandwidth changed significantly
  if (hasBandwidthChangedSignificantly(previousInfo, nextInfo)) {
    safeLog.log("📡 [NETWORK] Bandwidth changed significantly, ICE restart recommended");
    return true;
  }

  // RTT changed significantly
  if (hasRTTChangedSignificantly(previousInfo, nextInfo)) {
    safeLog.log("📡 [NETWORK] RTT changed significantly, ICE restart recommended");
    return true;
  }

  return false;
}

/**
 * Callback for network changes
 */
export type NetworkChangeCallback = (info: NetworkConnectionInfo) => void;

/**
 * Start monitoring network changes
 * @param onChange Callback when network changes
 * @returns Cleanup function to stop monitoring
 */
export function startNetworkMonitor(
  onChange: NetworkChangeCallback
): () => void {
  const connection = (navigator as Navigator & {
    connection?: {
      addEventListener: (type: string, listener: () => void) => void;
      removeEventListener: (type: string, listener: () => void) => void;
    };
  }).connection;

  if (!connection) {
    safeLog.log("ℹ️ [NETWORK] Network Information API not available");
    return () => {}; // No-op cleanup
  }

  let previousInfo: NetworkConnectionInfo | null = getNetworkConnectionInfo();

  const handleChange = () => {
    const currentInfo = getNetworkConnectionInfo();
    
    if (currentInfo) {
      safeLog.log("📡 [NETWORK] Network change detected:", {
        type: currentInfo.type,
        effectiveType: currentInfo.effectiveType,
        downlink: currentInfo.downlink,
        rtt: currentInfo.rtt,
        saveData: currentInfo.saveData,
      });

      // Call onChange with new info
      onChange(currentInfo);

      previousInfo = currentInfo;
    }
  };

  // Listen for network changes
  connection.addEventListener("change", handleChange);

  safeLog.log("✅ [NETWORK] Started network monitoring");

  // Return cleanup function
  return () => {
    if (connection.removeEventListener) {
      connection.removeEventListener("change", handleChange);
    }
    safeLog.log("🛑 [NETWORK] Stopped network monitoring");
  };
}


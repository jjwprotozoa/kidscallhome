// src/components/NetworkQualityBadge.tsx
// Compact network quality indicator for the navigation bar
// Shows current network type and quality estimate based on Network Information API

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Wifi,
  WifiOff,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ConnectionType = "2g" | "3g" | "4g" | "5g" | "wifi" | "offline" | "unknown";
type QualityLevel = "critical" | "poor" | "moderate" | "good" | "excellent";

interface NetworkInfo {
  connectionType: ConnectionType;
  qualityLevel: QualityLevel;
  downlink?: number; // Mbps
  rtt?: number; // ms
  effectiveType?: string;
}

// Detect connection type using Network Information API
function detectNetworkInfo(): NetworkInfo {
  // Check if offline
  if (!navigator.onLine) {
    return {
      connectionType: "offline",
      qualityLevel: "critical",
    };
  }

  const connection = (navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      type?: string;
      downlink?: number;
      rtt?: number;
    };
  }).connection;

  if (!connection) {
    return {
      connectionType: "unknown",
      qualityLevel: "moderate", // Assume moderate if we can't detect
    };
  }

  const effectiveType = connection.effectiveType;
  const downlink = connection.downlink; // Mbps
  const rtt = connection.rtt; // ms

  let connectionType: ConnectionType = "unknown";
  let qualityLevel: QualityLevel = "moderate";

  // FIRST: Check if WiFi (connection.type is more reliable for WiFi detection)
  // WiFi can report any effectiveType (2g-4g) based on actual speed
  if (connection.type === "wifi") {
    connectionType = "wifi";
    // Estimate quality based on downlink speed
    if (downlink && downlink > 50) {
      qualityLevel = "excellent"; // Fast WiFi (50+ Mbps)
    } else if (downlink && downlink > 20) {
      qualityLevel = "good"; // Good WiFi (20-50 Mbps)
    } else if (downlink && downlink > 5) {
      qualityLevel = "moderate"; // Moderate WiFi (5-20 Mbps)
    } else if (downlink && downlink > 1) {
      qualityLevel = "poor"; // Slow WiFi (1-5 Mbps)
    } else {
      // No downlink info or very slow - use effectiveType as hint
      if (effectiveType === "4g") {
        qualityLevel = "good";
      } else if (effectiveType === "3g") {
        qualityLevel = "moderate";
      } else if (effectiveType === "2g" || effectiveType === "slow-2g") {
        qualityLevel = "poor";
      } else {
        qualityLevel = "moderate"; // Default for WiFi
      }
    }
  } else {
    // Mobile connection - use effectiveType
    switch (effectiveType) {
      case "slow-2g":
      case "2g":
        connectionType = "2g";
        qualityLevel = "critical";
        break;
      case "3g":
        connectionType = "3g";
        qualityLevel = "poor";
        break;
      case "4g":
        // Check if it might be 5G (very high downlink speed)
        if (downlink && downlink > 100) {
          connectionType = "5g";
          qualityLevel = "excellent";
        } else if (downlink && downlink > 30) {
          connectionType = "4g";
          qualityLevel = "excellent";
        } else if (downlink && downlink > 5) {
          // Lower threshold: 5+ Mbps is good for 4G
          connectionType = "4g";
          qualityLevel = "good";
        } else if (downlink && downlink < 2) {
          // Only show moderate if we have evidence of very slow speeds
          connectionType = "4g";
          qualityLevel = "moderate";
        } else {
          // Default 4G to good (green) - 4G is generally good reception
          connectionType = "4g";
          qualityLevel = "good";
        }
        break;
      default:
        // Unknown connection type
        connectionType = "unknown";
        // Try to guess quality from downlink
        if (downlink && downlink > 20) {
          qualityLevel = "good";
        } else if (downlink && downlink > 5) {
          qualityLevel = "moderate";
        } else {
          qualityLevel = "moderate";
        }
    }
  }

  return {
    connectionType,
    qualityLevel,
    downlink,
    rtt,
    effectiveType,
  };
}

// Quality colors for icon - fast connections are GREEN!
const qualityIconColors: Record<QualityLevel, string> = {
  critical: "text-red-500",      // Very slow (2G, offline)
  poor: "text-orange-500",       // Slow (3G, slow WiFi)
  moderate: "text-yellow-500",   // Medium (weak 4G, moderate WiFi)
  good: "text-green-400",        // Fast (good 4G, good WiFi) - GREEN
  excellent: "text-green-500",   // Fastest (5G, fast 4G, fast WiFi) - BRIGHT GREEN
};

// Quality background colors for badge
const qualityBgColors: Record<QualityLevel, string> = {
  critical: "bg-red-500/20 border-red-500/30",
  poor: "bg-orange-500/20 border-orange-500/30",
  moderate: "bg-yellow-500/20 border-yellow-500/30",
  good: "bg-green-400/20 border-green-400/30",        // Fast = green
  excellent: "bg-green-500/20 border-green-500/30",   // Fastest = bright green
};

// Quality labels
const qualityLabels: Record<QualityLevel, string> = {
  critical: "Very Poor",
  poor: "Poor",
  moderate: "Fair",
  good: "Good",
  excellent: "Excellent",
};

// Connection type labels
const connectionLabels: Record<ConnectionType, string> = {
  "2g": "2G",
  "3g": "3G",
  "4g": "4G/LTE",
  "5g": "5G",
  wifi: "WiFi",
  offline: "Offline",
  unknown: "Unknown",
};

// Icon component based on connection type
const ConnectionIcon = ({
  type,
  quality,
  className,
}: {
  type: ConnectionType;
  quality: QualityLevel;
  className?: string;
}) => {
  const colorClass = qualityIconColors[quality];

  if (type === "offline") {
    return <WifiOff className={cn("h-4 w-4", colorClass, className)} />;
  }

  if (type === "wifi") {
    // WiFi icon - always use Wifi icon regardless of quality
    return <Wifi className={cn("h-4 w-4", colorClass, className)} />;
  }

  // Mobile signal icons - icon changes based on quality level
  switch (quality) {
    case "critical":
      return <SignalLow className={cn("h-4 w-4", colorClass, className)} />;
    case "poor":
      return <SignalLow className={cn("h-4 w-4", colorClass, className)} />;
    case "moderate":
      return <SignalMedium className={cn("h-4 w-4", colorClass, className)} />;
    case "good":
      return <SignalHigh className={cn("h-4 w-4", colorClass, className)} />;
    case "excellent":
      return <Signal className={cn("h-4 w-4", colorClass, className)} />; // Full bars
    default:
      return <SignalMedium className={cn("h-4 w-4", colorClass, className)} />;
  }
};

interface NetworkQualityBadgeProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean; // Just icon, no label or background
}

// DEBUG: Test different connection types via URL param or keyboard
// Add ?network=5g (or 4g, 3g, 2g, wifi, offline) to URL to test
// Or press Ctrl+Alt+N to cycle through connection types
const DEBUG_CONNECTIONS: ConnectionType[] = ["wifi", "5g", "4g", "3g", "2g", "offline"];

function getDebugOverride(): ConnectionType | null {
  if (typeof window === "undefined") return null;
  
  // Check URL param: ?network=5g
  const urlParams = new URLSearchParams(window.location.search);
  const networkParam = urlParams.get("network");
  if (networkParam && DEBUG_CONNECTIONS.includes(networkParam as ConnectionType)) {
    return networkParam as ConnectionType;
  }
  
  return null;
}

function getNetworkInfoForType(type: ConnectionType): NetworkInfo {
  switch (type) {
    case "5g":
      return { connectionType: "5g", qualityLevel: "excellent", downlink: 150, rtt: 10 };
    case "4g":
      return { connectionType: "4g", qualityLevel: "good", downlink: 20, rtt: 50 };
    case "3g":
      return { connectionType: "3g", qualityLevel: "poor", downlink: 1.5, rtt: 300 };
    case "2g":
      return { connectionType: "2g", qualityLevel: "critical", downlink: 0.2, rtt: 800 };
    case "wifi":
      return { connectionType: "wifi", qualityLevel: "excellent", downlink: 100, rtt: 5 };
    case "offline":
      return { connectionType: "offline", qualityLevel: "critical" };
    default:
      return detectNetworkInfo();
  }
}

export const NetworkQualityBadge = ({
  className,
  showLabel = true, // Always show label by default
  compact = false,
}: NetworkQualityBadgeProps) => {
  const [debugOverride, setDebugOverride] = useState<ConnectionType | null>(getDebugOverride);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>(() => {
    const override = getDebugOverride();
    return override ? getNetworkInfoForType(override) : detectNetworkInfo();
  });

  // DEBUG: Keyboard shortcut to cycle through connection types (Ctrl+Alt+N)
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key === "N") {
        e.preventDefault();
        setDebugOverride((current) => {
          if (current === null) {
            // Start cycling
            const newType = DEBUG_CONNECTIONS[0];
            setNetworkInfo(getNetworkInfoForType(newType));
            console.log(`🔧 [DEBUG] Network override: ${newType}`);
            return newType;
          }
          const currentIndex = DEBUG_CONNECTIONS.indexOf(current);
          const nextIndex = (currentIndex + 1) % (DEBUG_CONNECTIONS.length + 1);
          if (nextIndex === DEBUG_CONNECTIONS.length) {
            // Back to auto-detect
            setNetworkInfo(detectNetworkInfo());
            console.log("🔧 [DEBUG] Network override: OFF (auto-detect)");
            return null;
          }
          const newType = DEBUG_CONNECTIONS[nextIndex];
          setNetworkInfo(getNetworkInfoForType(newType));
          console.log(`🔧 [DEBUG] Network override: ${newType}`);
          return newType;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    // Skip auto-updates if debug override is active
    if (debugOverride) return;

    // Update on online/offline changes
    const handleOnline = () => setNetworkInfo(detectNetworkInfo());
    const handleOffline = () =>
      setNetworkInfo({ connectionType: "offline", qualityLevel: "critical" });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen for connection changes if available
    const connection = (navigator as Navigator & {
      connection?: {
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      };
    }).connection;

    const handleConnectionChange = () => setNetworkInfo(detectNetworkInfo());

    if (connection) {
      connection.addEventListener("change", handleConnectionChange);
    }

    // Periodic update every 30 seconds (connection quality can change)
    const interval = setInterval(() => {
      setNetworkInfo(detectNetworkInfo());
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (connection) {
        connection.removeEventListener("change", handleConnectionChange);
      }
      clearInterval(interval);
    };
  }, [debugOverride]);

  const tooltipContent = (
    <div className="text-xs space-y-1">
      {debugOverride && (
        <div className="text-blue-400 font-medium border-b border-blue-400/30 pb-1 mb-1">
          🔧 DEBUG MODE (Ctrl+Alt+N to cycle)
        </div>
      )}
      <div className="font-medium">
        {connectionLabels[networkInfo.connectionType]} -{" "}
        {qualityLabels[networkInfo.qualityLevel]}
      </div>
      {networkInfo.downlink !== undefined && (
        <div className="text-muted-foreground">
          Speed: ~{networkInfo.downlink.toFixed(1)} Mbps
        </div>
      )}
      {networkInfo.rtt !== undefined && (
        <div className="text-muted-foreground">
          Latency: ~{networkInfo.rtt} ms
        </div>
      )}
      {networkInfo.connectionType === "offline" && (
        <div className="text-red-400">No internet connection</div>
      )}
      {!debugOverride && process.env.NODE_ENV === "development" && (
        <div className="text-muted-foreground/50 text-[10px] border-t border-muted/20 pt-1 mt-1">
          Ctrl+Alt+N to test different networks
        </div>
      )}
    </div>
  );

  // Compact mode: just the icon
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("cursor-default", className)}>
              <ConnectionIcon
                type={networkInfo.connectionType}
                quality={networkInfo.qualityLevel}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-default border",
              "transition-colors",
              qualityBgColors[networkInfo.qualityLevel],
              className
            )}
          >
            <ConnectionIcon
              type={networkInfo.connectionType}
              quality={networkInfo.qualityLevel}
            />
            {showLabel && (
              <span
                className={cn(
                  "text-xs font-medium",
                  qualityIconColors[networkInfo.qualityLevel]
                )}
              >
                {connectionLabels[networkInfo.connectionType]}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default NetworkQualityBadge;


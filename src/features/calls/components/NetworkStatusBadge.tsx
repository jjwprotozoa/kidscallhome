// src/features/calls/components/NetworkStatusBadge.tsx
// Network status badge component for displaying quality and reconnecting state
// Compact badge format for overlay on video call

import { cn } from "@/lib/utils";
import type { NetworkQualityLevel, ConnectionType } from "../hooks/useNetworkQuality";

interface NetworkStatusBadgeProps {
  qualityLevel: NetworkQualityLevel;
  connectionType: ConnectionType;
  isReconnecting?: boolean;
  className?: string;
}

// Quality level labels
const qualityLabels: Record<NetworkQualityLevel, string> = {
  critical: "Audio Only",
  poor: "Low",
  moderate: "Medium",
  good: "Good",
  excellent: "HD",
  premium: "Premium",
};

// Quality level colors
const qualityColors: Record<NetworkQualityLevel, string> = {
  critical: "text-red-500 bg-red-500/20",
  poor: "text-orange-500 bg-orange-500/20",
  moderate: "text-yellow-500 bg-yellow-500/20",
  good: "text-green-500 bg-green-500/20",
  excellent: "text-blue-500 bg-blue-500/20",
  premium: "text-purple-500 bg-purple-500/20",
};

// Connection type icons/labels
const connectionLabels: Record<ConnectionType, string> = {
  "2g": "2G",
  "3g": "3G",
  "4g": "4G",
  "5g": "5G",
  wifi: "WiFi",
  unknown: "?",
};

export const NetworkStatusBadge = ({
  qualityLevel,
  connectionType,
  isReconnecting = false,
  className,
}: NetworkStatusBadgeProps) => {
  const colorClass = qualityColors[qualityLevel];
  const label = qualityLabels[qualityLevel];
  const connectionLabel = connectionLabels[connectionType];

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-lg backdrop-blur-sm transition-all",
        colorClass,
        className
      )}
    >
      {isReconnecting ? (
        <>
          <div className="h-2 w-2 rounded-full bg-current animate-pulse" />
          <span className="text-xs font-medium">Reconnecting...</span>
        </>
      ) : (
        <>
          <span className="text-xs font-medium">{label}</span>
          {connectionType !== "unknown" && (
            <span className="text-xs opacity-75 uppercase">
              {connectionLabel}
            </span>
          )}
        </>
      )}
    </div>
  );
};








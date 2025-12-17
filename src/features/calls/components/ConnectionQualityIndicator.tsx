// src/features/calls/components/ConnectionQualityIndicator.tsx
// Visual indicator showing current connection quality during video calls
// Shows network type, quality level, and whether video is paused due to poor connection

import { cn } from "@/lib/utils";
import { 
  NetworkQualityLevel, 
  ConnectionType,
  NetworkStats 
} from "../hooks/useNetworkQuality";
import { 
  Wifi, 
  WifiOff, 
  Signal, 
  SignalLow, 
  SignalMedium, 
  SignalHigh,
  VideoOff,
  AlertTriangle,
} from "lucide-react";

interface ConnectionQualityIndicatorProps {
  qualityLevel: NetworkQualityLevel;
  connectionType: ConnectionType;
  networkStats: NetworkStats;
  isVideoPausedDueToNetwork: boolean;
  className?: string;
  showDetails?: boolean;
}

// Colors for each quality level
const qualityColors: Record<NetworkQualityLevel, string> = {
  critical: "text-red-500 bg-red-500/20",
  poor: "text-orange-500 bg-orange-500/20",
  moderate: "text-yellow-500 bg-yellow-500/20",
  good: "text-green-500 bg-green-500/20",
  excellent: "text-emerald-500 bg-emerald-500/20",
};

// Labels for quality levels
const qualityLabels: Record<NetworkQualityLevel, string> = {
  critical: "Critical",
  poor: "Poor",
  moderate: "Fair",
  good: "Good",
  excellent: "Excellent",
};

// Icons for quality levels
const QualityIcon = ({ level }: { level: NetworkQualityLevel }) => {
  const iconClass = "h-4 w-4";
  
  switch (level) {
    case "critical":
      return <SignalLow className={cn(iconClass, "text-red-500")} />;
    case "poor":
      return <SignalLow className={cn(iconClass, "text-orange-500")} />;
    case "moderate":
      return <SignalMedium className={cn(iconClass, "text-yellow-500")} />;
    case "good":
      return <SignalHigh className={cn(iconClass, "text-green-500")} />;
    case "excellent":
      return <Signal className={cn(iconClass, "text-emerald-500")} />;
  }
};

// Connection type icon
const ConnectionIcon = ({ type }: { type: ConnectionType }) => {
  const iconClass = "h-4 w-4";
  
  switch (type) {
    case "wifi":
      return <Wifi className={cn(iconClass, "text-blue-400")} />;
    case "5g":
      return <Signal className={cn(iconClass, "text-purple-400")} />;
    case "4g":
      return <SignalHigh className={cn(iconClass, "text-green-400")} />;
    case "3g":
      return <SignalMedium className={cn(iconClass, "text-yellow-400")} />;
    case "2g":
      return <SignalLow className={cn(iconClass, "text-red-400")} />;
    default:
      return <WifiOff className={cn(iconClass, "text-gray-400")} />;
  }
};

export const ConnectionQualityIndicator = ({
  qualityLevel,
  connectionType,
  networkStats,
  isVideoPausedDueToNetwork,
  className,
  showDetails = false,
}: ConnectionQualityIndicatorProps) => {
  const colorClass = qualityColors[qualityLevel];
  const label = qualityLabels[qualityLevel];
  
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* Main indicator */}
      <div 
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-lg backdrop-blur-sm",
          colorClass
        )}
      >
        <QualityIcon level={qualityLevel} />
        <span className="text-xs font-medium">{label}</span>
        <ConnectionIcon type={connectionType} />
        <span className="text-xs uppercase opacity-75">
          {connectionType === "unknown" ? "?" : connectionType}
        </span>
        
        {/* Video paused warning */}
        {isVideoPausedDueToNetwork && (
          <div className="flex items-center gap-1 ml-1 text-orange-400">
            <VideoOff className="h-3 w-3" />
            <span className="text-[10px]">Video paused</span>
          </div>
        )}
      </div>
      
      {/* Critical connection warning */}
      {qualityLevel === "critical" && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/30 rounded text-red-300 text-[10px]">
          <AlertTriangle className="h-3 w-3" />
          <span>Audio only mode - poor connection</span>
        </div>
      )}
      
      {/* Detailed stats (optional) */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 px-2 py-1 bg-black/40 rounded text-[10px] text-white/70">
          <div className="flex justify-between">
            <span>Bandwidth:</span>
            <span className="font-mono">
              {networkStats.availableBandwidth.toFixed(0)} kbps
            </span>
          </div>
          <div className="flex justify-between">
            <span>Latency:</span>
            <span className="font-mono">
              {networkStats.roundTripTime.toFixed(0)} ms
            </span>
          </div>
          <div className="flex justify-between">
            <span>Out bitrate:</span>
            <span className="font-mono">
              {networkStats.outboundBitrate.toFixed(0)} kbps
            </span>
          </div>
          <div className="flex justify-between">
            <span>In bitrate:</span>
            <span className="font-mono">
              {networkStats.inboundBitrate.toFixed(0)} kbps
            </span>
          </div>
          <div className="flex justify-between">
            <span>Pkt loss:</span>
            <span className={cn(
              "font-mono",
              networkStats.inboundPacketLoss > 5 && "text-red-400"
            )}>
              {Math.max(networkStats.outboundPacketLoss, networkStats.inboundPacketLoss).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span>Score:</span>
            <span className={cn(
              "font-mono",
              networkStats.qualityScore < 50 && "text-red-400",
              networkStats.qualityScore >= 50 && networkStats.qualityScore < 75 && "text-yellow-400",
              networkStats.qualityScore >= 75 && "text-green-400"
            )}>
              {networkStats.qualityScore.toFixed(0)}/100
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact version for overlay on video
export const ConnectionQualityBadge = ({
  qualityLevel,
  isVideoPausedDueToNetwork,
  className,
}: {
  qualityLevel: NetworkQualityLevel;
  isVideoPausedDueToNetwork: boolean;
  className?: string;
}) => {
  return (
    <div 
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-full backdrop-blur-sm",
        qualityColors[qualityLevel],
        className
      )}
    >
      <QualityIcon level={qualityLevel} />
      {isVideoPausedDueToNetwork && (
        <VideoOff className="h-3 w-3 text-orange-400" />
      )}
    </div>
  );
};


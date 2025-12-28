// src/features/calls/components/BatteryNotification.tsx
// Battery level notification component for video calls
// Shows kid-friendly warnings when battery is low or critical

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Battery, BatteryLow, BatteryWarning, Plug } from "lucide-react";
import type { BatteryStatus } from "../webrtc/batteryMonitor";

interface BatteryNotificationProps {
  batteryStatus: BatteryStatus | null;
  className?: string;
}

export const BatteryNotification = ({
  batteryStatus,
  className,
}: BatteryNotificationProps) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasShownLowWarning, setHasShownLowWarning] = useState(false);
  const [hasShownCriticalWarning, setHasShownCriticalWarning] = useState(false);

  // Reset dismissed state when battery status changes significantly
  useEffect(() => {
    if (!batteryStatus) {
      setIsDismissed(false);
      return;
    }

    // Reset if battery becomes critical (show even if previously dismissed)
    if (batteryStatus.isCritical && !hasShownCriticalWarning) {
      setIsDismissed(false);
      setHasShownCriticalWarning(true);
    }

    // Reset if battery becomes low (show even if previously dismissed)
    if (batteryStatus.isLow && !batteryStatus.isCritical && !hasShownLowWarning) {
      setIsDismissed(false);
      setHasShownLowWarning(true);
    }

    // Reset dismissed state if battery recovers (charging or above threshold)
    if (batteryStatus.charging || (!batteryStatus.isLow && !batteryStatus.isCritical)) {
      setIsDismissed(false);
      setHasShownLowWarning(false);
      setHasShownCriticalWarning(false);
    }
  }, [batteryStatus, hasShownLowWarning, hasShownCriticalWarning]);

  // Don't show if no battery status, dismissed, or charging
  if (
    !batteryStatus ||
    isDismissed ||
    batteryStatus.charging ||
    (!batteryStatus.isLow && !batteryStatus.isCritical)
  ) {
    return null;
  }

  const batteryPercent = Math.round(batteryStatus.level * 100);
  const isCritical = batteryStatus.isCritical;

  return (
    <div
      className={cn(
        "absolute top-20 left-1/2 -translate-x-1/2 z-50 max-w-[90%] sm:max-w-md",
        className
      )}
      onClick={(e) => e.stopPropagation()} // Prevent video click handler
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-sm border-2 transition-all animate-in slide-in-from-top-2 duration-300",
          isCritical
            ? "bg-gradient-to-r from-red-600 to-rose-600 border-red-400/50 text-white"
            : "bg-gradient-to-r from-orange-500 to-amber-500 border-orange-400/50 text-white"
        )}
      >
        {/* Battery Icon */}
        <div className="flex-shrink-0">
          {isCritical ? (
            <BatteryWarning className="h-6 w-6 animate-pulse" />
          ) : (
            <BatteryLow className="h-6 w-6" />
          )}
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm sm:text-base">
            {isCritical
              ? "Battery Very Low!"
              : "Battery Getting Low"}
          </div>
          <div className="text-xs sm:text-sm opacity-90 mt-0.5">
            {isCritical ? (
              <>
                {batteryPercent}% remaining • Call switched to audio only to save battery
              </>
            ) : (
              <>
                {batteryPercent}% remaining • Video quality reduced to save battery
              </>
            )}
          </div>
        </div>

        {/* Battery Percentage Badge */}
        <div
          className={cn(
            "flex-shrink-0 px-2 py-1 rounded-lg font-bold text-xs sm:text-sm",
            isCritical
              ? "bg-red-700/50 border border-red-400/50"
              : "bg-orange-600/50 border border-orange-400/50"
          )}
        >
          {batteryPercent}%
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => setIsDismissed(true)}
          className={cn(
            "flex-shrink-0 p-1 rounded-lg transition-colors",
            isCritical
              ? "hover:bg-red-700/50"
              : "hover:bg-orange-600/50"
          )}
          aria-label="Dismiss battery warning"
        >
          <span className="text-lg">×</span>
        </button>
      </div>

      {/* Charging Suggestion */}
      {!batteryStatus.charging && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-black/40 backdrop-blur-sm rounded-xl text-white/80 text-xs">
          <Plug className="h-3 w-3" />
          <span>Plug in your device to restore full quality</span>
        </div>
      )}
    </div>
  );
};

// Compact battery indicator for status bar
export const BatteryIndicator = ({
  batteryStatus,
  className,
}: BatteryNotificationProps) => {
  if (!batteryStatus || batteryStatus.charging) {
    return null;
  }

  const batteryPercent = Math.round(batteryStatus.level * 100);
  const isCritical = batteryStatus.isCritical;
  const isLow = batteryStatus.isLow;

  if (!isLow && !isCritical) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-sm text-xs font-medium",
        isCritical
          ? "bg-red-500/30 text-red-300 border border-red-400/30"
          : "bg-orange-500/30 text-orange-300 border border-orange-400/30",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {isCritical ? (
        <BatteryWarning className="h-3 w-3" />
      ) : (
        <BatteryLow className="h-3 w-3" />
      )}
      <span>{batteryPercent}%</span>
    </div>
  );
};


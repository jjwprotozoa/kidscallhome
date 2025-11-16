// src/features/presence/StatusIndicator.tsx
// Visual status indicator component (green dot for online)

import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  isOnline: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  showPulse?: boolean;
}

const sizeClasses = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

/**
 * Status indicator component showing online/offline status
 * Shows green dot when online, gray dot when offline
 */
export function StatusIndicator({
  isOnline,
  className,
  size = "md",
  showPulse = false,
}: StatusIndicatorProps) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
    >
      <div
        className={cn(
          "rounded-full border-2 border-background",
          sizeClasses[size],
          isOnline
            ? "bg-green-500 dark:bg-green-400"
            : "bg-gray-400 dark:bg-gray-500"
        )}
        aria-label={isOnline ? "Online" : "Offline"}
        title={isOnline ? "Online" : "Offline"}
      />
      {isOnline && showPulse && (
        <div
          className={cn(
            "absolute inset-0 rounded-full animate-ping",
            "bg-green-500 dark:bg-green-400 opacity-75",
            sizeClasses[size]
          )}
        />
      )}
    </div>
  );
}


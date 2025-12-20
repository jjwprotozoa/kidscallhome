// src/features/calls/components/VideoPlaceholder.tsx
// Kid-friendly placeholder shown when video is disabled due to poor connection
// Shows animated icons and friendly messaging instead of frozen video frames

import { cn } from "@/lib/utils";
import { Phone, Wifi, WifiOff, Volume2 } from "lucide-react";

interface VideoPlaceholderProps {
  type: "local" | "remote";
  reason: "network" | "disabled" | "connecting" | "error";
  className?: string;
  name?: string; // Person's name for personalization
}

// Animated wave bars for audio visualization
const AudioWaves = ({ className }: { className?: string }) => (
  <div className={cn("flex items-end gap-1 h-8", className)}>
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="w-1.5 bg-green-400 rounded-full animate-pulse"
        style={{
          height: `${20 + Math.random() * 60}%`,
          animationDelay: `${i * 0.15}s`,
          animationDuration: "0.8s",
        }}
      />
    ))}
  </div>
);

// Pulsing phone icon
const PulsingPhone = ({ className }: { className?: string }) => (
  <div className={cn("relative", className)}>
    {/* Outer pulse rings */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-24 h-24 rounded-full bg-green-500/20 animate-ping" />
    </div>
    <div className="absolute inset-0 flex items-center justify-center">
      <div 
        className="w-20 h-20 rounded-full bg-green-500/30 animate-ping"
        style={{ animationDelay: "0.3s" }}
      />
    </div>
    {/* Phone icon */}
    <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-green-500 shadow-lg shadow-green-500/50">
      <Phone className="w-8 h-8 text-white animate-bounce" style={{ animationDuration: "2s" }} />
    </div>
  </div>
);

// Animated avatar with bouncing
const AnimatedAvatar = ({ name, className }: { name?: string; className?: string }) => {
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  const colors = [
    "from-pink-500 to-rose-500",
    "from-purple-500 to-indigo-500",
    "from-blue-500 to-cyan-500",
    "from-green-500 to-emerald-500",
    "from-yellow-500 to-orange-500",
  ];
  // Pick color based on name
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;
  
  return (
    <div className={cn("relative", className)}>
      {/* Breathing animation ring */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className={cn(
            "w-28 h-28 rounded-full bg-gradient-to-br opacity-30",
            colors[colorIndex]
          )}
          style={{
            animation: "breathe 3s ease-in-out infinite",
          }}
        />
      </div>
      {/* Avatar */}
      <div 
        className={cn(
          "relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br text-white text-4xl font-bold shadow-xl",
          colors[colorIndex]
        )}
        style={{
          animation: "float 3s ease-in-out infinite",
        }}
      >
        {initial}
      </div>
    </div>
  );
};

// Signal bars animation (for connecting state)
const ConnectingAnimation = ({ className }: { className?: string }) => (
  <div className={cn("flex items-end gap-1", className)}>
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="w-3 rounded-sm bg-blue-400"
        style={{
          height: `${i * 25}%`,
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.2}s`,
          opacity: 0.5,
        }}
      />
    ))}
  </div>
);

// Poor connection animated icon
const PoorConnectionIcon = ({ className }: { className?: string }) => (
  <div className={cn("relative", className)}>
    <WifiOff className="w-12 h-12 text-orange-400 animate-pulse" />
    <div 
      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center"
      style={{ animation: "bounce 1s infinite" }}
    >
      <span className="text-white text-xs font-bold">!</span>
    </div>
  </div>
);

export const VideoPlaceholder = ({
  type,
  reason,
  className,
  name,
}: VideoPlaceholderProps) => {
  // Different content based on reason
  const getContent = () => {
    switch (reason) {
      case "network":
        return (
          <div className="flex flex-col items-center gap-4 text-center px-4">
            {type === "remote" ? (
              <>
                <AnimatedAvatar name={name} />
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-green-400">
                    <Volume2 className="w-5 h-5 animate-pulse" />
                    <span className="text-lg font-medium">Audio Call</span>
                  </div>
                  <p className="text-white/70 text-sm">
                    Video paused - slow connection
                  </p>
                  <AudioWaves className="mx-auto mt-2" />
                </div>
              </>
            ) : (
              <>
                <PoorConnectionIcon />
                <div className="space-y-1">
                  <p className="text-orange-300 text-sm font-medium">
                    Slow Connection
                  </p>
                  <p className="text-white/60 text-xs">
                    Video paused to save data
                  </p>
                </div>
              </>
            )}
          </div>
        );

      case "connecting":
        return (
          <div className="flex flex-col items-center gap-4 text-center">
            <PulsingPhone />
            <div className="space-y-2">
              <p className="text-white text-lg font-medium animate-pulse">
                Connecting...
              </p>
              <ConnectingAnimation className="mx-auto h-8" />
            </div>
          </div>
        );

      case "disabled":
        return (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative">
              {/* Subtle glow */}
              <div className="absolute inset-0 bg-slate-500/20 rounded-full blur-xl" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-white/10 shadow-lg">
                <span className="text-3xl">📷</span>
              </div>
              {/* Off indicator */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center border-2 border-slate-800">
                <span className="text-white text-xs">✕</span>
              </div>
            </div>
            <p className="text-white/50 text-xs font-medium">
              {type === "local" ? "Camera off" : "Video off"}
            </p>
          </div>
        );

      case "error":
        return (
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <WifiOff className="w-8 h-8 text-red-400" />
            </div>
            <div className="space-y-1">
              <p className="text-red-300 text-sm font-medium">
                Connection Lost
              </p>
              <p className="text-white/60 text-xs">
                Trying to reconnect...
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
        type === "remote" ? "w-full h-full" : "w-full h-full rounded-xl",
        className
      )}
    >
      {/* Animated background pattern */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 0%, transparent 50%)`,
            animation: "float 10s ease-in-out infinite",
          }}
        />
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        {getContent()}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.1); opacity: 0.5; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default VideoPlaceholder;



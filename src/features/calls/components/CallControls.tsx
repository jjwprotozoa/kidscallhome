// src/features/calls/components/CallControls.tsx
// Modern call control buttons - mobile-friendly design matching the call theme

import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2 } from "lucide-react";

interface CallControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  // Volume boost (speaker mode)
  isVolumeBoosted?: boolean;
  onToggleVolume?: () => void;
}

export const CallControls = ({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  isVolumeBoosted = false,
  onToggleVolume,
}: CallControlsProps) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 pb-8 pt-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-50">
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        {/* Volume/Speaker Button - Always show with prominent styling */}
        <button
          type="button"
          onClick={onToggleVolume}
          className={`
            relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center
            transition-all duration-200 active:scale-90
            ${isVolumeBoosted 
              ? "bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/30 ring-2 ring-green-400/50" 
              : "bg-gradient-to-br from-blue-500/80 to-indigo-600/80 shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-600"
            }
          `}
          style={{ touchAction: "manipulation" }}
          aria-label={isVolumeBoosted ? "Normal volume" : "Boost volume"}
        >
          <Volume2 className={`w-6 h-6 sm:w-7 sm:h-7 ${isVolumeBoosted ? "text-white" : "text-white"}`} />
          {/* Boost indicator */}
          {isVolumeBoosted && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-black flex items-center justify-center animate-pulse">
              <span className="text-[10px] font-bold text-black">+</span>
            </span>
          )}
          {/* Sound waves animation when boosted */}
          {isVolumeBoosted && (
            <span className="absolute inset-0 rounded-full border-2 border-green-400/50 animate-ping" style={{ animationDuration: "1.5s" }} />
          )}
        </button>

        {/* Mute Button */}
        <button
          type="button"
          onClick={onToggleMute}
          className={`
            relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center
            transition-all duration-200 active:scale-90
            ${isMuted 
              ? "bg-red-500/90 shadow-lg shadow-red-500/30" 
              : "bg-white/20 backdrop-blur-sm hover:bg-white/30"
            }
          `}
          style={{ touchAction: "manipulation" }}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? (
            <MicOff className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          ) : (
            <Mic className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          )}
          {/* Status indicator dot */}
          {isMuted && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full border-2 border-black animate-pulse" />
          )}
        </button>

        {/* End Call Button - Larger and more prominent */}
        <button
          type="button"
          onClick={onEndCall}
          className="
            w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center
            bg-gradient-to-br from-red-500 to-rose-600
            shadow-xl shadow-red-500/40
            transition-all duration-200 active:scale-90 hover:scale-105
            border-2 border-white/20
          "
          style={{ width: "4.5rem", height: "4.5rem", touchAction: "manipulation" }}
          aria-label="End call"
        >
          <PhoneOff className="w-8 h-8 sm:w-9 sm:h-9 text-white" />
        </button>

        {/* Video Toggle Button */}
        <button
          type="button"
          onClick={onToggleVideo}
          className={`
            relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center
            transition-all duration-200 active:scale-90
            ${isVideoOff 
              ? "bg-red-500/90 shadow-lg shadow-red-500/30" 
              : "bg-white/20 backdrop-blur-sm hover:bg-white/30"
            }
          `}
          style={{ touchAction: "manipulation" }}
          aria-label={isVideoOff ? "Turn on camera" : "Turn off camera"}
        >
          {isVideoOff ? (
            <VideoOff className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          ) : (
            <Video className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          )}
          {/* Status indicator dot */}
          {isVideoOff && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full border-2 border-black animate-pulse" />
          )}
        </button>
      </div>

      {/* Button labels - helpful for accessibility */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 mt-3">
        <span className={`w-14 sm:w-16 text-center text-xs font-medium ${isVolumeBoosted ? "text-green-300" : "text-blue-300"}`}>
          {isVolumeBoosted ? "🔊 Loud" : "🔈 Volume"}
        </span>
        <span className={`w-14 sm:w-16 text-center text-xs ${isMuted ? "text-red-300" : "text-white/60"}`}>
          {isMuted ? "Muted" : "Mute"}
        </span>
        <span className="w-18 sm:w-20 text-center text-xs text-red-300 font-medium" style={{ width: "4.5rem" }}>
          End
        </span>
        <span className={`w-14 sm:w-16 text-center text-xs ${isVideoOff ? "text-red-300" : "text-white/60"}`}>
          {isVideoOff ? "Video Off" : "Video"}
        </span>
      </div>
    </div>
  );
};

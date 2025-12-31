// src/features/calls/components/CallControls.tsx
// Modern call control buttons - mobile-friendly design matching the call theme

import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface CallControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  // Volume control (0-10 scale)
  volume?: number; // 0-10
  onVolumeChange?: (volume: number) => void;
}

export const CallControls = ({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  volume = 5,
  onVolumeChange,
}: CallControlsProps) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 pb-8 pt-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-50">
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        {/* Volume Slider - Always show with prominent styling */}
        <div className="flex flex-col items-center gap-2 w-20 sm:w-24">
          <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500/80 to-indigo-600/80 shadow-lg transition-all duration-200 ${
            volume === 0 ? 'opacity-50' : volume >= 8 ? 'shadow-blue-500/40 ring-2 ring-blue-400/30' : 'shadow-blue-500/20'
          }`}>
            <Volume2 className={`w-6 h-6 sm:w-7 sm:h-7 text-white transition-transform duration-200 ${
              volume === 0 ? 'opacity-50' : volume >= 8 ? 'scale-110' : ''
            }`} />
            {/* Volume level indicator */}
            {volume > 0 && (
              <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-black flex items-center justify-center transition-all duration-200 ${
                volume >= 8 ? 'bg-green-400 animate-pulse' : volume >= 5 ? 'bg-green-400' : 'bg-blue-400'
              }`}>
                <span className="text-[10px] font-bold text-black">{volume}</span>
              </span>
            )}
          </div>
          <div className="w-full px-2">
            <Slider
              value={[volume]}
              onValueChange={(values) => onVolumeChange?.(values[0])}
              onValueCommit={(values) => {
                // Log when user finishes adjusting volume for debugging
                console.log(`🔊 [VOLUME] Volume committed to ${values[0]}/10`);
              }}
              min={0}
              max={10}
              step={1}
              className="w-full group 
                [&>span]:!bg-white/20 
                [&>span>span]:!bg-blue-500 
                [&>button]:!bg-white 
                [&>button]:!border-white/50 
                [&>button]:!ring-white/30 
                [&>button]:focus-visible:!ring-white/60 
                [&>button]:hover:!bg-blue-100 
                [&>button]:active:!scale-110
                [&>button]:transition-all 
                [&>button]:cursor-grab
                [&>button]:active:cursor-grabbing"
              aria-label={`Volume control, currently at ${volume} out of 10`}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={volume}
            />
            <div className="flex justify-between text-[10px] text-white/60 mt-1">
              <span aria-hidden="true">0</span>
              <span aria-hidden="true">10</span>
            </div>
          </div>
        </div>

        {/* Mute Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            // Prevent click event from firing after touchEnd on mobile
            e.preventDefault();
            onToggleMute();
          }}
          className={`
            relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center
            transition-all duration-200 active:scale-90
            ${isMuted 
              ? "bg-red-500/90 shadow-lg shadow-red-500/30" 
              : "bg-white/20 backdrop-blur-sm hover:bg-white/30"
            }
          `}
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
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
        {/* Uses onClick and onTouchEnd for maximum compatibility (Samsung devices work better with onTouchEnd) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEndCall();
          }}
          onTouchEnd={(e) => {
            // Samsung devices (especially A31) work better with onTouchEnd
            e.stopPropagation();
            e.preventDefault();
            onEndCall();
          }}
          className="
            w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center
            bg-gradient-to-br from-red-500 to-rose-600
            shadow-xl shadow-red-500/40
            transition-all duration-200 active:scale-90 hover:scale-105
            border-2 border-white/20
          "
          style={{ width: "4.5rem", height: "4.5rem", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          aria-label="End call"
        >
          <PhoneOff className="w-8 h-8 sm:w-9 sm:h-9 text-white" />
        </button>

        {/* Video Toggle Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVideo();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            // Prevent click event from firing after touchEnd on mobile
            e.preventDefault();
            onToggleVideo();
          }}
          className={`
            relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center
            transition-all duration-200 active:scale-90
            ${isVideoOff 
              ? "bg-red-500/90 shadow-lg shadow-red-500/30" 
              : "bg-white/20 backdrop-blur-sm hover:bg-white/30"
            }
          `}
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
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
        <span className={`w-20 sm:w-24 text-center text-xs font-medium transition-colors duration-200 ${
          volume === 0 ? 'text-white/40' : volume >= 8 ? 'text-green-300' : 'text-blue-300'
        }`}>
          Volume {volume}
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

// src/features/calls/components/CallControls.tsx
// Modern call control buttons - mobile-friendly design matching the call theme

import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";

interface CallControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

export const CallControls = ({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
}: CallControlsProps) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 pb-8 pt-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
      <div className="flex items-center justify-center gap-6">
        {/* Mute Button */}
        <button
          onClick={onToggleMute}
          className={`
            relative w-16 h-16 rounded-full flex items-center justify-center
            transition-all duration-200 active:scale-90
            ${isMuted 
              ? "bg-red-500/90 shadow-lg shadow-red-500/30" 
              : "bg-white/20 backdrop-blur-sm hover:bg-white/30"
            }
          `}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? (
            <MicOff className="w-7 h-7 text-white" />
          ) : (
            <Mic className="w-7 h-7 text-white" />
          )}
          {/* Status indicator dot */}
          {isMuted && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full border-2 border-black animate-pulse" />
          )}
        </button>

        {/* End Call Button - Larger and more prominent */}
        <button
          onClick={onEndCall}
          className="
            w-20 h-20 rounded-full flex items-center justify-center
            bg-gradient-to-br from-red-500 to-rose-600
            shadow-xl shadow-red-500/40
            transition-all duration-200 active:scale-90 hover:scale-105
            border-2 border-white/20
          "
          aria-label="End call"
        >
          <PhoneOff className="w-9 h-9 text-white" />
        </button>

        {/* Video Toggle Button */}
        <button
          onClick={onToggleVideo}
          className={`
            relative w-16 h-16 rounded-full flex items-center justify-center
            transition-all duration-200 active:scale-90
            ${isVideoOff 
              ? "bg-red-500/90 shadow-lg shadow-red-500/30" 
              : "bg-white/20 backdrop-blur-sm hover:bg-white/30"
            }
          `}
          aria-label={isVideoOff ? "Turn on camera" : "Turn off camera"}
        >
          {isVideoOff ? (
            <VideoOff className="w-7 h-7 text-white" />
          ) : (
            <Video className="w-7 h-7 text-white" />
          )}
          {/* Status indicator dot */}
          {isVideoOff && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full border-2 border-black animate-pulse" />
          )}
        </button>
      </div>

      {/* Button labels - helpful for accessibility */}
      <div className="flex items-center justify-center gap-6 mt-3">
        <span className={`w-16 text-center text-xs ${isMuted ? "text-red-300" : "text-white/60"}`}>
          {isMuted ? "Muted" : "Mute"}
        </span>
        <span className="w-20 text-center text-xs text-red-300 font-medium">
          End
        </span>
        <span className={`w-16 text-center text-xs ${isVideoOff ? "text-red-300" : "text-white/60"}`}>
          {isVideoOff ? "Video Off" : "Video"}
        </span>
      </div>
    </div>
  );
};

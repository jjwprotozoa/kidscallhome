// src/features/calls/components/CallControls.tsx
// Modern call control buttons - mobile-friendly design matching the call theme

import { Mic, MicOff, PhoneOff, Video, VideoOff, PictureInPicture2 } from "lucide-react";

interface CallControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  // Picture-in-Picture support
  isPictureInPictureSupported?: boolean;
  isPictureInPictureActive?: boolean;
  onTogglePictureInPicture?: () => void;
}

export const CallControls = ({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  isPictureInPictureSupported = false,
  isPictureInPictureActive = false,
  onTogglePictureInPicture,
}: CallControlsProps) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 pb-8 pt-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-50">
      <div className="flex items-center justify-center gap-4 sm:gap-6">
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

        {/* Picture-in-Picture Button - Only show if supported */}
        {isPictureInPictureSupported && onTogglePictureInPicture && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePictureInPicture();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onTogglePictureInPicture();
            }}
            className={`
              relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center
              transition-all duration-200 active:scale-90
              ${isPictureInPictureActive
                ? "bg-blue-500/90 shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/50"
                : "bg-white/20 backdrop-blur-sm hover:bg-white/30"
              }
            `}
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            aria-label={isPictureInPictureActive ? "Exit Picture-in-Picture" : "Enter Picture-in-Picture"}
            title={
              isPictureInPictureActive
                ? "Exit Picture-in-Picture"
                : "Enter Picture-in-Picture - Creates a floating window that stays on top when switching apps (desktop) or keeps call visible (mobile)"
            }
          >
            <PictureInPicture2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            {/* Status indicator dot */}
            {isPictureInPictureActive && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400 rounded-full border-2 border-black animate-pulse" />
            )}
          </button>
        )}
      </div>

      {/* Button labels - helpful for accessibility */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 mt-3">
        <span className={`w-14 sm:w-16 text-center text-xs ${isMuted ? "text-red-300" : "text-white/60"}`}>
          {isMuted ? "Muted" : "Mute"}
        </span>
        <span className="w-18 sm:w-20 text-center text-xs text-red-300 font-medium" style={{ width: "4.5rem" }}>
          End
        </span>
        <span className={`w-14 sm:w-16 text-center text-xs ${isVideoOff ? "text-red-300" : "text-white/60"}`}>
          {isVideoOff ? "Video Off" : "Video"}
        </span>
        {isPictureInPictureSupported && onTogglePictureInPicture && (
          <span className={`w-14 sm:w-16 text-center text-xs ${isPictureInPictureActive ? "text-blue-300" : "text-white/60"}`}>
            {isPictureInPictureActive ? "PiP On" : "PiP"}
          </span>
        )}
      </div>
    </div>
  );
};

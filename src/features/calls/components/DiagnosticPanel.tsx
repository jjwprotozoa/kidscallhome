// src/features/calls/components/DiagnosticPanel.tsx
// Collapsible diagnostic panel for video call debugging
// Shows video state, audio info, and track details

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, HelpCircle, Video, Volume2, Radio } from "lucide-react";

interface DiagnosticPanelProps {
  title: string;
  icon: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  children: React.ReactNode;
}

// Individual collapsible panel
export const DiagnosticPanel = ({
  title,
  icon,
  defaultExpanded = false,
  className,
  children,
}: DiagnosticPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div 
      className={cn(
        "bg-black/60 backdrop-blur-sm rounded-lg overflow-hidden transition-all duration-200",
        className
      )}
      onClick={(e) => e.stopPropagation()} // Prevent video click handler
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-white/90 hover:bg-white/10 transition-colors"
      >
        <span className="text-white/70">{icon}</span>
        <span className="text-xs font-medium flex-1 text-left">{title}</span>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3 text-white/50" />
        ) : (
          <ChevronDown className="h-3 w-3 text-white/50" />
        )}
      </button>

      {/* Content - collapsible */}
      {isExpanded && (
        <div className="px-2 pb-2 text-white text-[10px] leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
};

// Video state diagnostic panel
interface VideoStatePanelProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoState: string;
  isAudioMutedByBrowser: boolean;
  audioElementRef: React.RefObject<HTMLAudioElement>;
  defaultExpanded?: boolean;
}

export const VideoStatePanel = ({
  videoRef,
  videoState,
  isAudioMutedByBrowser,
  audioElementRef,
  defaultExpanded = false,
}: VideoStatePanelProps) => {
  return (
    <DiagnosticPanel
      title="Video State"
      icon={<Video className="h-3 w-3" />}
      defaultExpanded={defaultExpanded}
    >
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span className="text-white/60">State:</span>
          <span className="font-mono">{videoState}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">ReadyState:</span>
          <span className="font-mono">{videoRef.current?.readyState ?? "N/A"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Paused:</span>
          <span className={cn("font-mono", videoRef.current?.paused && "text-orange-400")}>
            {videoRef.current?.paused ? "Yes" : "No"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Muted:</span>
          <span className={cn("font-mono", videoRef.current?.muted && "text-orange-400")}>
            {videoRef.current?.muted ? "Yes" : "No"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Volume:</span>
          <span className="font-mono">{videoRef.current?.volume?.toFixed(1) ?? "N/A"}</span>
        </div>
      </div>
    </DiagnosticPanel>
  );
};

// Audio state diagnostic panel
interface AudioStatePanelProps {
  isAudioMutedByBrowser: boolean;
  audioElementRef: React.RefObject<HTMLAudioElement>;
  remoteStream: MediaStream | null;
  defaultExpanded?: boolean;
}

export const AudioStatePanel = ({
  isAudioMutedByBrowser,
  audioElementRef,
  remoteStream,
  defaultExpanded = false,
}: AudioStatePanelProps) => {
  return (
    <DiagnosticPanel
      title="Audio State"
      icon={<Volume2 className="h-3 w-3" />}
      defaultExpanded={defaultExpanded}
    >
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span className="text-white/60">Blocked:</span>
          <span className={cn("font-mono", isAudioMutedByBrowser && "text-red-400")}>
            {isAudioMutedByBrowser ? "Yes" : "No"}
          </span>
        </div>
        {audioElementRef.current && (
          <>
            <div className="flex justify-between">
              <span className="text-white/60">El Volume:</span>
              <span className="font-mono">{audioElementRef.current.volume?.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">El Muted:</span>
              <span className={cn("font-mono", audioElementRef.current.muted && "text-orange-400")}>
                {audioElementRef.current.muted ? "Yes" : "No"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">El Paused:</span>
              <span className={cn("font-mono", audioElementRef.current.paused && "text-orange-400")}>
                {audioElementRef.current.paused ? "Yes" : "No"}
              </span>
            </div>
          </>
        )}
      </div>
    </DiagnosticPanel>
  );
};

// Track info diagnostic panel
interface TrackInfoPanelProps {
  remoteStream: MediaStream | null;
  defaultExpanded?: boolean;
}

export const TrackInfoPanel = ({
  remoteStream,
  defaultExpanded = false,
}: TrackInfoPanelProps) => {
  if (!remoteStream) return null;
  
  const tracks = remoteStream.getTracks();
  const audioTracks = remoteStream.getAudioTracks();
  const videoTracks = remoteStream.getVideoTracks();

  return (
    <DiagnosticPanel
      title="Tracks"
      icon={<Radio className="h-3 w-3" />}
      defaultExpanded={defaultExpanded}
    >
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-white/60">Total:</span>
          <span className="font-mono">{tracks.length}</span>
        </div>
        
        {audioTracks.length > 0 && (
          <div className="border-t border-white/10 pt-1 mt-1">
            <div className="text-white/50 mb-0.5">Audio ({audioTracks.length}):</div>
            {audioTracks.map((track, i) => (
              <div key={track.id} className="flex items-center gap-1 pl-2">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  track.enabled && !track.muted ? "bg-green-400" : "bg-red-400"
                )} />
                <span className="font-mono truncate text-[9px]">
                  {track.muted ? "muted" : "unmuted"}, {track.enabled ? "enabled" : "disabled"}
                </span>
              </div>
            ))}
          </div>
        )}
        
        {videoTracks.length > 0 && (
          <div className="border-t border-white/10 pt-1 mt-1">
            <div className="text-white/50 mb-0.5">Video ({videoTracks.length}):</div>
            {videoTracks.map((track, i) => (
              <div key={track.id} className="flex items-center gap-1 pl-2">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  track.enabled && !track.muted ? "bg-green-400" : "bg-red-400"
                )} />
                <span className="font-mono truncate text-[9px]">
                  {track.muted ? "muted" : "unmuted"}, {track.enabled ? "enabled" : "disabled"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DiagnosticPanel>
  );
};

// Main diagnostic container with all panels
interface DiagnosticContainerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoState: string;
  isAudioMutedByBrowser: boolean;
  audioElementRef: React.RefObject<HTMLAudioElement>;
  remoteStream: MediaStream | null;
  className?: string;
}

export const DiagnosticContainer = ({
  videoRef,
  videoState,
  isAudioMutedByBrowser,
  audioElementRef,
  remoteStream,
  className,
}: DiagnosticContainerProps) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  return (
    <div 
      className={cn("flex flex-col gap-1", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Toggle button */}
      <button
        onClick={() => setShowDiagnostics(!showDiagnostics)}
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-full transition-all",
          showDiagnostics 
            ? "bg-blue-500/80 text-white" 
            : "bg-black/40 text-white/60 hover:bg-black/60 hover:text-white/80"
        )}
        title={showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {/* Panels */}
      {showDiagnostics && (
        <div className="flex flex-col gap-1 w-44">
          <VideoStatePanel
            videoRef={videoRef}
            videoState={videoState}
            isAudioMutedByBrowser={isAudioMutedByBrowser}
            audioElementRef={audioElementRef}
            defaultExpanded={false}
          />
          <AudioStatePanel
            isAudioMutedByBrowser={isAudioMutedByBrowser}
            audioElementRef={audioElementRef}
            remoteStream={remoteStream}
            defaultExpanded={false}
          />
          <TrackInfoPanel
            remoteStream={remoteStream}
            defaultExpanded={false}
          />
        </div>
      )}
    </div>
  );
};



// src/components/call/VideoCallUI.tsx
// Video call UI layout component

import { useEffect, useRef, useState } from "react";
import { CallControls } from "./CallControls";
import { callLog } from "@/features/calls/utils/callLogger";

interface VideoCallUIProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  remoteStream: MediaStream | null;
  isConnecting: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  peerConnection?: RTCPeerConnection | null;
}

export const VideoCallUI = ({
  localVideoRef,
  remoteVideoRef,
  remoteStream,
  isConnecting,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  peerConnection,
}: VideoCallUIProps) => {
  const [videoState, setVideoState] = useState<'waiting' | 'loading' | 'playing' | 'error'>('waiting');
  const playAttemptedRef = useRef(false);

  // CRITICAL FIX: Use video element events instead of polling
  // This makes the UI responsive and eliminates "stuck on loading" issues
  useEffect(() => {
    if (!remoteStream || !remoteVideoRef.current) {
      setVideoState('waiting');
      return;
    }

    const video = remoteVideoRef.current;
    
    // CRITICAL: Ensure srcObject is set correctly
    if (video.srcObject !== remoteStream) {
      callLog.debug("VIDEO", "Setting remote stream to video element");
      video.srcObject = remoteStream;
    }

    // Use ref to track state for interval callback and avoid stale closures
    const currentStateRef = { current: videoState };
    const updateStateRef = (newState: typeof videoState) => {
      currentStateRef.current = newState;
      setVideoState(newState);
    };
    
    // Start in loading state - will transition to playing via events
    updateStateRef('loading');

    // Function to attempt play with proper error handling
    const attemptPlay = async () => {
      if (!video.paused) return;
      
      try {
        callLog.debug("VIDEO", "Attempting to play video");
        await video.play();
        callLog.debug("VIDEO", "Video started playing");
        playAttemptedRef.current = true;
        updateStateRef('playing');
      } catch (error: any) {
        callLog.debug("VIDEO", "Play error", { errorName: error.name });
        
        if (error.name === 'NotAllowedError') {
          // Try playing muted
          video.muted = true;
          try {
            await video.play();
            callLog.debug("VIDEO", "Playing muted - click to unmute");
            updateStateRef('playing');
          } catch (mutedError) {
          callLog.error("VIDEO", "Even muted play failed", mutedError);
          updateStateRef('error');
          }
        } else if (error.name === 'NotSupportedError') {
          callLog.error("VIDEO", "Media format not supported");
          updateStateRef('error');
        }
        // Don't retry on other errors - let events handle it
      }
    };

    // Event listeners - these drive the state, not polling
    const handleLoadedMetadata = () => {
      callLog.debug("VIDEO", "Video metadata loaded");
      updateStateRef('loading');
      attemptPlay();
    };

    const handleLoadedData = () => {
      callLog.debug("VIDEO", "Video data loaded");
      attemptPlay();
    };

    const handleCanPlay = () => {
      callLog.debug("VIDEO", "Video can play");
      attemptPlay();
    };
    
    const handlePlaying = () => {
      callLog.debug("VIDEO", "Video 'playing' event fired");
      updateStateRef('playing');
      playAttemptedRef.current = true;
    };
    
    // Also check on canplaythrough - video is ready to play smoothly
    const handleCanPlayThrough = () => {
      callLog.debug("VIDEO", "Video can play through");
      if (!video.paused) {
        updateStateRef('playing');
      }
    };

    const handleWaiting = () => {
      callLog.debug("VIDEO", "Video 'waiting' event - buffering");
      // Only set to loading if actually paused (not just buffering)
      if (video.paused && currentStateRef.current !== 'error') {
        updateStateRef('loading');
      }
    };

    const handlePause = () => {
      callLog.debug("VIDEO", "Video paused");
      // Don't change state on pause - might be user action or buffering
    };

    const handleError = (e: Event) => {
      const videoEl = e.target as HTMLVideoElement;
      callLog.error("VIDEO", "Video error", videoEl.error);
      updateStateRef('error');
    };

    // Bind to video element events - these are the source of truth
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    // Monitor track unmute events - when tracks unmute, ICE is connected
    // CRITICAL: For WebRTC, tracks can unmute (media flowing) even if readyState is 0
    // So we should mark as "playing" when tracks unmute AND video is not paused
    const tracks = remoteStream.getTracks();
    const trackHandlers = new Map();
    
    // Helper to check if we should mark as playing
    const checkShouldBePlaying = () => {
      const hasUnmutedTracks = tracks.some(t => !t.muted && t.readyState === 'live');
      const isVideoPlaying = !video.paused;
      
      // If tracks are unmuted and video is playing (even if readyState is 0), mark as playing
      if (hasUnmutedTracks && isVideoPlaying) {
        callLog.debug("VIDEO", "Tracks unmuted and video playing - marking as playing");
        updateStateRef('playing');
        return true;
      }
      return false;
    };
    
    tracks.forEach(track => {
      const handleUnmute = () => {
        callLog.debug("VIDEO", "Track unmuted - ICE connected, media flowing", { kind: track.kind });
        // When track unmutes, ICE connection is established - try to play immediately
        if (video.paused) {
          attemptPlay();
        } else {
          // Video is already playing - check if we should mark as playing
          // This handles the case where video.play() succeeded but readyState is still 0
          setTimeout(() => {
            checkShouldBePlaying();
          }, 100);
        }
      };
      
      const handleMute = () => {
        callLog.debug("VIDEO", "Track muted", { kind: track.kind });
        // Don't change state - might be temporary during ICE negotiation
        // Only change to loading if ALL tracks are muted
        const allMuted = tracks.every(t => t.muted);
        if (allMuted && currentStateRef.current === 'playing') {
          callLog.debug("VIDEO", "All tracks muted, setting to loading");
          updateStateRef('loading');
        }
      };
      
      const handleEnded = () => {
        callLog.debug("VIDEO", "Track ended", { kind: track.kind });
      };
      
      track.addEventListener('unmute', handleUnmute);
      track.addEventListener('mute', handleMute);
      track.addEventListener('ended', handleEnded);
      
      trackHandlers.set(track, { handleUnmute, handleMute, handleEnded });
    });
    
    // Also check periodically if video is playing but state is still loading
    // This handles edge cases where events don't fire
    const checkInterval = setInterval(() => {
      // Check if video is actually playing (not paused) and has unmuted tracks
      // but state is still loading
      if (!video.paused) {
        const hasUnmutedTracks = tracks.some(t => !t.muted && t.readyState === 'live');
        if (hasUnmutedTracks && currentStateRef.current === 'loading') {
          callLog.debug("VIDEO", "Video playing with unmuted tracks - updating state");
          updateStateRef('playing');
        }
      }
    }, 500);

    // Initial play attempt
    attemptPlay();

    return () => {
      clearInterval(checkInterval);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
      
      // Clean up track listeners
      trackHandlers.forEach((handlers, track) => {
        track.removeEventListener('unmute', handlers.handleUnmute);
        track.removeEventListener('mute', handlers.handleMute);
        track.removeEventListener('ended', handlers.handleEnded);
      });
    };
  }, [remoteStream, remoteVideoRef]);

  const handleVideoClick = () => {
    if (!remoteVideoRef.current || !remoteVideoRef.current.srcObject) return;
    
    const video = remoteVideoRef.current;
    callLog.debug("VIDEO", "User clicked video area", {
      paused: video.paused,
      muted: video.muted,
      readyState: video.readyState
    });
    
    // If video is muted, unmute it
    if (video.muted) {
      video.muted = false;
      callLog.debug("VIDEO", "Video unmuted by user click");
    }
    
    // If video is paused, try to play
    if (video.paused) {
      video.play()
        .then(() => {
          callLog.debug("VIDEO", "Video started playing after click");
          setVideoState('playing');
        })
        .catch((error) => {
          callLog.error("VIDEO", "Click play failed", error);
          // Try muted as fallback
          video.muted = true;
          video.play().catch(e => callLog.error("VIDEO", "Muted play also failed", e));
        });
    }
  };

  // Determine what message to show
  const getStatusMessage = () => {
    // If no remote stream, show connecting/waiting
    if (!remoteStream) {
      return isConnecting ? "Connecting..." : "Waiting for other person...";
    }
    
    // Always show local preview if available (should be pre-warmed)
    // Remote video state is handled separately
    
    if (videoState === 'error') {
      return "Video error - click to retry";
    }
    
    if (videoState === 'loading') {
      return "Connecting to other side...";
    }
    
    // If video is paused but we have a stream, might need user interaction
    if (remoteVideoRef.current?.paused && videoState !== 'playing') {
      return "Click to start video";
    }
    
    if (remoteVideoRef.current?.muted) {
      return "Video is muted - click to unmute";
    }
    
    return null;
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="fixed inset-0 bg-black" onClick={handleVideoClick}>
      <div className="relative h-full w-full">
        {/* Remote video (full screen) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={false}
          volume={1.0}
          className="w-full h-full object-cover"
          style={{ backgroundColor: '#000' }}
        />

        {/* Connection status overlay */}
        {statusMessage && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/80 cursor-pointer"
            onClick={handleVideoClick}
          >
            <div className="text-center space-y-4">
              <div className="text-6xl">
                {videoState === 'error' ? '❌' : 
                 videoState === 'loading' ? '⏳' : 
                 '📞'}
              </div>
              <p className="text-white text-2xl">{statusMessage}</p>
              {remoteStream && (
                <p className="text-white text-sm opacity-75">
                  {videoState === 'loading' ? 'Establishing connection...' :
                   videoState === 'error' ? 'Check your connection' :
                   'Tap anywhere to interact'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Debug info (remove in production) */}
        {process.env.NODE_ENV === 'development' && remoteStream && (
          <div className="absolute top-20 left-4 bg-black/50 text-white text-xs p-2 rounded">
            <div>State: {videoState}</div>
            <div>ReadyState: {remoteVideoRef.current?.readyState ?? 'N/A'}</div>
            <div>Paused: {remoteVideoRef.current?.paused ? 'Yes' : 'No'}</div>
            <div>Muted: {remoteVideoRef.current?.muted ? 'Yes' : 'No'}</div>
            <div>Tracks: {remoteStream.getTracks().map(t => `${t.kind}:${t.muted?'muted':'unmuted'}`).join(', ')}</div>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        <div className="absolute top-4 right-4 w-48 h-36 rounded-2xl overflow-hidden shadow-xl border-2 border-white">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Controls */}
        <CallControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onToggleMute={onToggleMute}
          onToggleVideo={onToggleVideo}
          onEndCall={onEndCall}
        />
      </div>
    </div>
  );
};

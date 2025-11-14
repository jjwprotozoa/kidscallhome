// src/components/call/VideoCallUI.tsx
// Video call UI layout component

import { useEffect, useRef, useState } from "react";
import { CallControls } from "./CallControls";

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
}: VideoCallUIProps) => {
  const [videoState, setVideoState] = useState<'waiting' | 'loading' | 'playing' | 'error'>('waiting');
  const playAttemptedRef = useRef(false);
  const retryCountRef = useRef(0);

  // CRITICAL FIX: Monitor and fix video playback issues
  useEffect(() => {
    if (!remoteStream || !remoteVideoRef.current) {
      setVideoState('waiting');
      return;
    }

    const video = remoteVideoRef.current;
    const maxRetries = 20; // Try for up to 10 seconds
    
    // CRITICAL: Ensure srcObject is set correctly
    if (video.srcObject !== remoteStream) {
      console.log("🎬 [VIDEO UI] Setting remote stream to video element");
      video.srcObject = remoteStream;
      // Reset the video element to ensure clean state
      video.load();
    }

    setVideoState('loading');

    // Function to check and fix video state
    const checkAndFixVideo = () => {
      const tracks = remoteStream.getTracks();
      const hasActiveTracks = tracks.some(t => t.readyState === 'live' && t.enabled);
      
      console.log("🔍 [VIDEO UI] Checking video state:", {
        readyState: video.readyState,
        paused: video.paused,
        currentTime: video.currentTime,
        hasActiveTracks,
        tracks: tracks.map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState
        }))
      });

      // Fix 1: If video thinks it's playing but readyState is 0, pause and replay
      if (!video.paused && video.readyState === 0 && retryCountRef.current < maxRetries) {
        console.log("⚠️ [VIDEO UI] Video claims to be playing but has no data, resetting...");
        video.pause();
        video.load();
        setTimeout(() => {
          video.play().catch(e => console.log("Retry play error:", e));
        }, 100);
        retryCountRef.current++;
        return;
      }

      // Fix 2: Re-set srcObject if tracks are active but video isn't working
      if (hasActiveTracks && video.readyState === 0 && video.srcObject === remoteStream) {
        console.log("🔧 [VIDEO UI] Re-setting srcObject to force stream refresh");
        video.srcObject = null;
        setTimeout(() => {
          video.srcObject = remoteStream;
          video.load();
          video.play().catch(e => console.log("Play after reset error:", e));
        }, 50);
        retryCountRef.current++;
        return;
      }

      // Fix 3: Try to play if paused
      if (video.paused && hasActiveTracks) {
        attemptPlay();
      }

      // Success check
      if (!video.paused && video.readyState >= 2) {
        setVideoState('playing');
        retryCountRef.current = 0;
        console.log("✅ [VIDEO UI] Video is playing successfully!");
      }
    };

    // Function to attempt play with proper error handling
    const attemptPlay = async () => {
      if (!video.paused) return;
      
      try {
        console.log("🎬 [VIDEO UI] Attempting to play video (readyState:", video.readyState, ")");
        
        // Set muted to true temporarily if autoplay fails
        const originalMuted = video.muted;
        
        await video.play();
        
        // If play succeeds and was originally unmuted, unmute again
        if (!originalMuted && video.muted) {
          video.muted = false;
        }
        
        console.log("✅ [VIDEO UI] Video started playing");
        playAttemptedRef.current = true;
        setVideoState('playing');
      } catch (error: any) {
        console.error("❌ [VIDEO UI] Play error:", error.name, error.message);
        
        if (error.name === 'NotAllowedError') {
          // Try playing muted
          console.log("🔇 [VIDEO UI] Trying to play muted due to autoplay policy");
          video.muted = true;
          try {
            await video.play();
            console.log("✅ [VIDEO UI] Playing muted - click to unmute");
            setVideoState('playing');
          } catch (mutedError) {
            console.error("❌ [VIDEO UI] Even muted play failed:", mutedError);
            setVideoState('error');
          }
        } else if (error.name === 'NotSupportedError') {
          console.error("❌ [VIDEO UI] Media format not supported");
          setVideoState('error');
        } else if (error.name !== 'AbortError') {
          // Retry for other errors
          setTimeout(checkAndFixVideo, 500);
        }
      }
    };

    // Initial attempt
    checkAndFixVideo();

    // Set up interval to monitor and fix issues
    const checkInterval = setInterval(checkAndFixVideo, 500);

    // Event listeners for video state changes
    const handleCanPlay = () => {
      console.log("📹 [VIDEO UI] Video can play");
      attemptPlay();
    };

    const handleLoadedData = () => {
      console.log("📹 [VIDEO UI] Video data loaded");
      attemptPlay();
    };

    const handlePlaying = () => {
      console.log("✅ [VIDEO UI] Video 'playing' event fired");
      setVideoState('playing');
    };

    const handleWaiting = () => {
      console.log("⏳ [VIDEO UI] Video 'waiting' event - buffering");
      setVideoState('loading');
    };

    const handleError = (e: Event) => {
      const videoEl = e.target as HTMLVideoElement;
      console.error("❌ [VIDEO UI] Video error:", videoEl.error);
      setVideoState('error');
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('error', handleError);

    // Monitor track state changes
    const tracks = remoteStream.getTracks();
    const trackHandlers = new Map();
    
    tracks.forEach(track => {
      const handleUnmute = () => {
        console.log("✅ [VIDEO UI] Track unmuted:", track.kind);
        checkAndFixVideo();
      };
      
      const handleMute = () => {
        console.log("⚠️ [VIDEO UI] Track muted:", track.kind);
      };
      
      const handleEnded = () => {
        console.log("🔚 [VIDEO UI] Track ended:", track.kind);
      };
      
      track.addEventListener('unmute', handleUnmute);
      track.addEventListener('mute', handleMute);
      track.addEventListener('ended', handleEnded);
      
      trackHandlers.set(track, { handleUnmute, handleMute, handleEnded });
    });

    return () => {
      clearInterval(checkInterval);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('waiting', handleWaiting);
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
    console.log("👆 [VIDEO UI] User clicked video area", {
      paused: video.paused,
      muted: video.muted,
      readyState: video.readyState
    });
    
    // If video is muted, unmute it
    if (video.muted) {
      video.muted = false;
      console.log("🔊 [VIDEO UI] Video unmuted by user click");
    }
    
    // If video is paused, try to play
    if (video.paused) {
      video.play()
        .then(() => {
          console.log("✅ [VIDEO UI] Video started playing after click");
          setVideoState('playing');
        })
        .catch((error) => {
          console.error("❌ [VIDEO UI] Click play failed:", error);
          // Try muted as fallback
          video.muted = true;
          video.play().catch(e => console.error("Muted play also failed:", e));
        });
    }
  };

  // Determine what message to show
  const getStatusMessage = () => {
    if (!remoteStream) {
      return isConnecting ? "Connecting..." : "Waiting for other person...";
    }
    
    if (videoState === 'error') {
      return "Video error - click to retry";
    }
    
    if (videoState === 'loading') {
      return "Loading video...";
    }
    
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

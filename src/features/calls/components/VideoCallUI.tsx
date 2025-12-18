// src/features/calls/components/VideoCallUI.tsx
// Video call UI layout component with adaptive quality indicator
// Supports all network conditions from 2G to 5G/WiFi
// AUDIO: Only enabled after user clicks Call/Accept, not on page load

import { useEffect, useRef, useState } from "react";
import { CallControls } from "./CallControls";
import { getUserHasStartedCall } from "@/utils/userInteraction";
import { 
  ConnectionQualityIndicator, 
  ConnectionQualityBadge 
} from "./ConnectionQualityIndicator";
import { DiagnosticContainer } from "./DiagnosticPanel";
import { VideoPlaceholder } from "./VideoPlaceholder";
import type { NetworkQualityLevel, ConnectionType, NetworkStats } from "../hooks/useNetworkQuality";

// Network quality props for adaptive streaming
interface NetworkQualityProps {
  qualityLevel: NetworkQualityLevel;
  connectionType: ConnectionType;
  networkStats: NetworkStats;
  isVideoPausedDueToNetwork: boolean;
  forceAudioOnly: () => void;
  enableVideoIfPossible: () => void;
}

interface VideoCallUIProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  remoteStream: MediaStream | null;
  localStream?: MediaStream | null; // Optional: for syncing local video when component mounts
  isConnecting: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  peerConnection?: RTCPeerConnection | null;
  // Optional network quality for adaptive streaming indicator
  networkQuality?: NetworkQualityProps;
}

export const VideoCallUI = ({
  localVideoRef,
  remoteVideoRef,
  remoteStream,
  localStream,
  isConnecting,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  peerConnection,
  networkQuality,
}: VideoCallUIProps) => {
  const [videoState, setVideoState] = useState<
    "waiting" | "loading" | "playing" | "error"
  >("waiting");
  const [isAudioMutedByBrowser, setIsAudioMutedByBrowser] = useState(false);
  // CRITICAL: Control the muted state via React state, not hardcoded prop
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const playAttemptedRef = useRef(false);
  // Track if user has started/accepted call (enables audio)
  const audioEnabledRef = useRef(getUserHasStartedCall());
  // Ref to a hidden audio element for audio-only playback (mobile workaround)
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  // Volume boost state - uses Web Audio API gain node for louder audio
  const [isVolumeBoosted, setIsVolumeBoosted] = useState(false);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioDestinationConnectedRef = useRef(false);

  // Set volume via ref (volume is not a valid HTML prop)
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = 1.0;
      console.warn("🔊 [VIDEO UI] Set video element volume to 1.0");
    }
  }, [remoteVideoRef]);

  // CRITICAL: Sync local stream to video element when component mounts
  // This fixes PIP not showing because initializeConnection runs before VideoCallUI mounts
  // Also re-syncs when video is re-enabled (isVideoOff changes from true to false)
  useEffect(() => {
    // Only sync when video is enabled (not off)
    if (isVideoOff || !localStream) return;

    // Use requestAnimationFrame to ensure the video element is mounted after React renders
    const syncLocalVideo = () => {
      if (localVideoRef.current) {
        if (localVideoRef.current.srcObject !== localStream) {
          console.warn("🎬 [VIDEO UI] Syncing local stream to PIP video element");
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.muted = true; // Prevent echo
          localVideoRef.current.play().catch((error) => {
            console.warn("⚠️ [VIDEO UI] Error playing local video:", error);
          });
        }
      } else {
        // Video element not mounted yet, try again after next frame
        requestAnimationFrame(syncLocalVideo);
      }
    };

    // Start the sync process
    requestAnimationFrame(syncLocalVideo);
  }, [localStream, localVideoRef, isVideoOff]);

  // CRITICAL: Use Web Audio API to analyze actual audio level from remote stream
  // This helps diagnose if audio data is actually being received vs playback issues
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // State for audio warnings - only shown if we've NEVER detected audio
  const [showNoRemoteAudioWarning, setShowNoRemoteAudioWarning] = useState(false);
  const noAudioCountRef = useRef(0);
  const hasEverDetectedAudioRef = useRef(false);  // Once true, never show warning

  // Monitor audio state changes for debugging - including actual audio level
  useEffect(() => {
    if (!remoteStream) return;

    // Reset audio detection state for new stream (new call)
    hasEverDetectedAudioRef.current = false;
    noAudioCountRef.current = 0;
    setShowNoRemoteAudioWarning(false);

    // Create AudioContext and analyser for audio level detection
    const audioTracks = remoteStream.getAudioTracks();
    if (audioTracks.length > 0 && !audioContextRef.current) {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;

        // Create audio source from remote stream
        const source = audioCtx.createMediaStreamSource(remoteStream);
        audioSourceRef.current = source;

        // Create analyser - use larger FFT for better low frequency detection (voice)
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;  // Larger FFT for better voice detection
        analyser.smoothingTimeConstant = 0.3;  // Smoother readings
        analyserRef.current = analyser;

        // Connect source -> analyser (don't connect to destination to avoid double audio)
        source.connect(analyser);

        console.log("🔊 [AUDIO ANALYZER] Created audio analyzer for remote stream");
      } catch (error) {
        console.error("❌ [AUDIO ANALYZER] Failed to create audio analyzer:", error);
      }
    }

    const interval = setInterval(() => {
      const video = remoteVideoRef.current;
      const audio = audioElementRef.current;
      
      if (video && remoteStream) {
        const audioTracks = remoteStream.getAudioTracks();
        
        // Get actual audio level using Web Audio API
        // Use TIME DOMAIN data (waveform) instead of frequency - better for detecting ANY audio
        let audioLevel = 0;
        let peakLevel = 0;
        let hasAudioSignal = false;
        
        if (analyserRef.current) {
          // Time domain analysis - detects actual waveform amplitude
          const timeDomainData = new Uint8Array(analyserRef.current.fftSize);
          analyserRef.current.getByteTimeDomainData(timeDomainData);
          
          // Calculate RMS (root mean square) - standard way to measure audio level
          let sumSquares = 0;
          let maxDeviation = 0;
          for (let i = 0; i < timeDomainData.length; i++) {
            // Values are 0-255, with 128 being silence
            const deviation = Math.abs(timeDomainData[i] - 128);
            sumSquares += deviation * deviation;
            if (deviation > maxDeviation) maxDeviation = deviation;
          }
          const rms = Math.sqrt(sumSquares / timeDomainData.length);
          
          audioLevel = rms;  // RMS level (0-128 scale, silence = 0)
          peakLevel = maxDeviation;  // Peak deviation from center
          
          // Consider audio present if RMS > 0.5 or peak > 2 (very sensitive)
          // This detects even quiet speech
          hasAudioSignal = rms > 0.5 || maxDeviation > 2;
        }
        
        // Only log every 3rd call (9 seconds) to reduce console spam in production
        if (process.env.NODE_ENV === "development") {
          console.log("🎧 [AUDIO DEBUG]", {
            videoMuted: video.muted,
            videoPaused: video.paused,
            audioTrackEnabled: audioTracks[0]?.enabled,
            audioTrackMuted: audioTracks[0]?.muted,
            // Audio levels (RMS-based, more accurate for speech)
            rmsLevel: audioLevel.toFixed(2),
            peakDeviation: peakLevel,
            hasAudioSignal,
            hasEverDetectedAudio: hasEverDetectedAudioRef.current,
          });
        }
        
        // CRITICAL: Track if we've EVER detected audio
        // Once detected, never show the warning (avoids false positives during quiet moments)
        if (hasAudioSignal) {
          if (!hasEverDetectedAudioRef.current) {
            console.log("✅ [AUDIO] First audio detected from remote mic!");
          }
          hasEverDetectedAudioRef.current = true;
          noAudioCountRef.current = 0;
          if (showNoRemoteAudioWarning) {
            setShowNoRemoteAudioWarning(false);
          }
        } else if (!hasEverDetectedAudioRef.current && !audioTracks[0]?.muted) {
          // Only count/warn if we've NEVER detected audio
          noAudioCountRef.current += 1;
          // After 10 samples (30 seconds) with NO audio ever, show warning
          if (noAudioCountRef.current >= 10 && !showNoRemoteAudioWarning) {
            console.warn("⚠️ [AUDIO] No audio ever detected after 30s - remote mic may not be working");
            setShowNoRemoteAudioWarning(true);
          }
        }
        
        // CRITICAL: If we have audio data but video element is muted, log a warning
        if (hasAudioSignal && video.muted) {
          console.warn("⚠️ [AUDIO] Audio data flowing but video is muted! Tap screen to hear.");
        }
      }
    }, 3000); // Log every 3 seconds
    
    return () => {
      clearInterval(interval);
      // Cleanup audio context
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [remoteStream, remoteVideoRef, showNoRemoteAudioWarning]);

  // CRITICAL: Create a hidden audio element as backup for audio playback (mobile workaround)
  // Some mobile browsers don't play audio through video element reliably
  // AUDIO: Only plays if user has clicked Call/Accept, not on page load
  useEffect(() => {
    if (remoteStream && !audioElementRef.current) {
      const audioElement = document.createElement("audio");
      // CRITICAL: Don't set autoplay=true - we control playback based on user interaction
      audioElement.autoplay = false;  // Respect user interaction requirement
      audioElement.playsInline = true;
      audioElement.volume = 1.0;   // Full volume
      audioElement.style.display = "none";
      document.body.appendChild(audioElement);
      audioElementRef.current = audioElement;

      // Create an audio-only stream
      const audioTracks = remoteStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioOnlyStream = new MediaStream(audioTracks);
        audioElement.srcObject = audioOnlyStream;
        
        // Check if user has started/accepted call - only then enable audio
        const userStartedCall = getUserHasStartedCall();
        console.warn("🔊 [VIDEO UI] Created hidden audio element with", audioTracks.length, "audio tracks", {
          userStartedCall,
          willPlayAudio: userStartedCall,
        });
        
        // CRITICAL: Only play audio if user has clicked Call/Accept
        // This respects browser autoplay policies and the stated requirement
        if (userStartedCall) {
          audioElement.muted = false;
          const playAudio = async () => {
            try {
              await audioElement.play();
              console.warn("✅ [VIDEO UI] Hidden audio element playing (user started call)");
            } catch (error) {
              console.warn("⚠️ [VIDEO UI] Hidden audio element play failed:", error);
              // Will be played on user interaction (tap screen)
            }
          };
          playAudio();
        } else {
          // User hasn't started call yet - keep muted, will be unmuted on user interaction
          audioElement.muted = true;
          console.warn("🔇 [VIDEO UI] Hidden audio element muted (user hasn't started call yet)");
        }
      }

      return () => {
        if (audioElementRef.current) {
          audioElementRef.current.pause();
          audioElementRef.current.srcObject = null;
          try {
            document.body.removeChild(audioElementRef.current);
          } catch {
            // Already removed
          }
          audioElementRef.current = null;
        }
      };
    }
  }, [remoteStream]);

  // CRITICAL FIX: Use video element events instead of polling
  // This makes the UI responsive and eliminates "stuck on loading" issues
  // AUDIO: Only plays with audio if user clicked Call/Accept first
  useEffect(() => {
    if (!remoteStream || !remoteVideoRef.current) {
      setVideoState("waiting");
      return;
    }

    const video = remoteVideoRef.current;

    // CRITICAL: Ensure srcObject is set correctly
    if (video.srcObject !== remoteStream) {
      console.warn("🎬 [VIDEO UI] Setting remote stream to video element");
      video.srcObject = remoteStream;
    }

    // Check if user started the call (clicked Call/Accept)
    // This determines if audio should be enabled
    const userStartedCall = getUserHasStartedCall();
    audioEnabledRef.current = userStartedCall;

    console.warn("🔊 [VIDEO UI] Audio check on mount:", {
      userStartedCall,
      audioEnabled: audioEnabledRef.current,
    });

    // Use ref to track state for interval callback and avoid stale closures
    const currentStateRef = { current: videoState };
    const updateStateRef = (newState: typeof videoState) => {
      currentStateRef.current = newState;
      setVideoState(newState);
    };

    // Start in loading state - will transition to playing via events
    updateStateRef("loading");

    // Function to attempt play with proper error handling
    // AUDIO: Only try unmuted if user has started the call
    const attemptPlay = async () => {
      if (!video.paused) return;

      // Check again if user started call (might have changed)
      const canPlayAudio = getUserHasStartedCall();
      audioEnabledRef.current = canPlayAudio;

      console.warn("🎬 [VIDEO UI] Attempting to play video", {
        canPlayAudio,
        audioEnabledRef: audioEnabledRef.current,
      });

      if (canPlayAudio) {
        // User clicked Call/Accept - try to play with audio
        try {
          video.muted = false;
          setIsVideoMuted(false);  // CRITICAL: Update React state
          await video.play();
          console.warn("✅ [VIDEO UI] Video started playing WITH AUDIO");
          playAttemptedRef.current = true;
          setIsAudioMutedByBrowser(false);
          updateStateRef("playing");
          
          // Also try to play hidden audio element
          if (audioElementRef.current) {
            audioElementRef.current.muted = false;
            audioElementRef.current.play().catch((e) => console.warn("Audio element play failed:", e));
          }
          return;
        } catch (error: unknown) {
          const playError = error as { name?: string };
          console.warn("⏳ [VIDEO UI] Play with audio failed:", playError.name);
          
          if (playError.name === "NotAllowedError") {
            // Even with user interaction, browser blocked audio - try muted
            video.muted = true;
            setIsVideoMuted(true);
            setIsAudioMutedByBrowser(true);
          }
        }
      }

      // Fallback: Play muted (no user interaction or browser blocked audio)
      try {
        video.muted = true;
        setIsVideoMuted(true);
        await video.play();
        console.warn("⚠️ [VIDEO UI] Video playing MUTED - tap for audio");
        playAttemptedRef.current = true;
        setIsAudioMutedByBrowser(true);
        updateStateRef("playing");
      } catch (mutedError) {
        console.error("❌ [VIDEO UI] Even muted play failed:", mutedError);
        updateStateRef("error");
      }
    };

    // Event listeners - these drive the state, not polling
    const handleLoadedMetadata = () => {
      console.warn("📹 [VIDEO UI] Video metadata loaded");
      updateStateRef("loading");
      attemptPlay();
    };

    const handleLoadedData = () => {
      console.warn("📹 [VIDEO UI] Video data loaded");
      attemptPlay();
    };

    const handleCanPlay = () => {
      console.warn("📹 [VIDEO UI] Video can play");
      attemptPlay();
    };

    const handlePlaying = () => {
      console.warn("✅ [VIDEO UI] Video 'playing' event fired");
      updateStateRef("playing");
      playAttemptedRef.current = true;
    };

    // Also check on canplaythrough - video is ready to play smoothly
    const handleCanPlayThrough = () => {
      console.warn("📹 [VIDEO UI] Video can play through");
      if (!video.paused) {
        updateStateRef("playing");
      }
    };

    const handleWaiting = () => {
      console.warn("⏳ [VIDEO UI] Video 'waiting' event - buffering");
      // Only set to loading if actually paused (not just buffering)
      if (video.paused && currentStateRef.current !== "error") {
        updateStateRef("loading");
      }
    };

    const handlePause = () => {
      // Don't change state on pause - might be user action or buffering
    };

    const handleError = (e: Event) => {
      const videoEl = e.target as HTMLVideoElement;
      console.error("❌ [VIDEO UI] Video error:", videoEl.error);
      updateStateRef("error");
    };

    // Bind to video element events - these are the source of truth
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("canplaythrough", handleCanPlayThrough);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("pause", handlePause);
    video.addEventListener("error", handleError);

    // Monitor track unmute events - when tracks unmute, ICE is connected
    // CRITICAL: For WebRTC, tracks can unmute (media flowing) even if readyState is 0
    // So we should mark as "playing" when tracks unmute AND video is not paused
    const tracks = remoteStream.getTracks();
    const trackHandlers = new Map();

    // Helper to check if we should mark as playing
    const checkShouldBePlaying = () => {
      const hasUnmutedTracks = tracks.some(
        (t) => !t.muted && t.readyState === "live"
      );
      const isVideoPlaying = !video.paused;

      // If tracks are unmuted and video is playing (even if readyState is 0), mark as playing
      if (hasUnmutedTracks && isVideoPlaying) {
        console.warn(
          "✅ [VIDEO UI] Tracks unmuted and video playing - marking as playing"
        );
        updateStateRef("playing");
        return true;
      }
      return false;
    };

    tracks.forEach((track) => {
      const handleUnmute = () => {
        console.warn(
          "✅ [VIDEO UI] Track unmuted:",
          track.kind,
          "- ICE connected, media flowing"
        );
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
        console.warn("⚠️ [VIDEO UI] Track muted:", track.kind);
        // Don't change state - might be temporary during ICE negotiation
        // Only change to loading if ALL tracks are muted
        const allMuted = tracks.every((t) => t.muted);
        if (allMuted && currentStateRef.current === "playing") {
          console.warn("⚠️ [VIDEO UI] All tracks muted, setting to loading");
          updateStateRef("loading");
        }
      };

      const handleEnded = () => {
        console.warn("🔚 [VIDEO UI] Track ended:", track.kind);
      };

      track.addEventListener("unmute", handleUnmute);
      track.addEventListener("mute", handleMute);
      track.addEventListener("ended", handleEnded);

      trackHandlers.set(track, { handleUnmute, handleMute, handleEnded });
    });

    // Also check periodically if video is playing but state is still loading
    // This handles edge cases where events don't fire
    const checkInterval = setInterval(() => {
      // Check if video is actually playing (not paused) and has unmuted tracks
      // but state is still loading
      if (!video.paused) {
        const hasUnmutedTracks = tracks.some(
          (t) => !t.muted && t.readyState === "live"
        );
        if (hasUnmutedTracks && currentStateRef.current === "loading") {
          console.warn(
            "✅ [VIDEO UI] Video playing with unmuted tracks - updating state"
          );
          updateStateRef("playing");
        }
      }
    }, 2000); // Check every 2 seconds (reduced from 500ms to save resources)

    // Initial play attempt
    attemptPlay();

    return () => {
      clearInterval(checkInterval);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("canplaythrough", handleCanPlayThrough);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("error", handleError);

      // Clean up track listeners
      trackHandlers.forEach((handlers, track) => {
        track.removeEventListener("unmute", handlers.handleUnmute);
        track.removeEventListener("mute", handlers.handleMute);
        track.removeEventListener("ended", handlers.handleEnded);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteStream, remoteVideoRef]);

  // Play a test beep to verify audio output works
  const playTestBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.frequency.value = 440; // A4 note
      oscillator.type = "sine";
      gainNode.gain.value = 0.1; // Low volume
      
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 200); // 200ms beep
      
      console.warn("🔔 [VIDEO UI] Test beep played");
    } catch (e) {
      console.warn("⚠️ [VIDEO UI] Test beep failed:", e);
    }
  };

  // Force audio to play - called on user interaction
  const forceAudioPlayback = async () => {
    console.warn("🔊 [VIDEO UI] Forcing audio playback...");
    
    // NOTE: Test beep disabled as it was distracting during calls
    // playTestBeep();
    
    const video = remoteVideoRef.current;
    const audio = audioElementRef.current;
    
    // 1. Ensure video element audio
    if (video) {
      video.muted = false;
      video.volume = 1.0;
      setIsVideoMuted(false);
      
      // Re-load and play the video if needed
      if (video.paused) {
        try {
          await video.play();
          console.warn("✅ [VIDEO UI] Video element playing");
        } catch (e) {
          console.warn("⚠️ [VIDEO UI] Video play failed:", e);
        }
      }
    }
    
    // 2. Ensure hidden audio element
    if (audio) {
      audio.muted = false;
      audio.volume = 1.0;
      
      if (audio.paused) {
        try {
          await audio.play();
          console.warn("✅ [VIDEO UI] Audio element playing");
        } catch (e) {
          console.warn("⚠️ [VIDEO UI] Audio play failed:", e);
        }
      }
    }
    
    // 3. Ensure all audio tracks in the stream are enabled
    if (remoteStream) {
      const audioTracks = remoteStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = true;
        console.warn("🔊 [VIDEO UI] Force enabled audio track:", {
          id: track.id,
          muted: track.muted,
          readyState: track.readyState,
        });
      });
      
      // 4. Update hidden audio element's stream if tracks changed
      if (audio && audioTracks.length > 0) {
        const audioOnlyStream = new MediaStream(audioTracks);
        if (audio.srcObject !== audioOnlyStream) {
          audio.srcObject = audioOnlyStream;
          console.warn("🔊 [VIDEO UI] Updated audio element srcObject");
        }
      }
      
      // 5. Ensure video element has the correct stream
      if (video && video.srcObject !== remoteStream) {
        video.srcObject = remoteStream;
        console.warn("🔊 [VIDEO UI] Updated video element srcObject");
      }
    }
    
    setIsAudioMutedByBrowser(false);
    
    // 6. CRITICAL: Route audio directly through Web Audio API to speakers
    // This bypasses video/audio element playback entirely
    // Use current boost state
    routeAudioViaWebAudioAPI(isVolumeBoosted);
  };

  // CRITICAL: Route remote audio directly through Web Audio API to speakers
  // This bypasses video/audio element playback entirely
  // Supports volume boost via gain node
  const routeAudioViaWebAudioAPI = (boost: boolean = isVolumeBoosted) => {
    if (!remoteStream) {
      console.error("❌ [AUDIO] No remote stream to route");
      return;
    }

    const audioTracks = remoteStream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.error("❌ [AUDIO] No audio tracks in remote stream");
      return;
    }

    try {
      // Use existing context or create new one
      let audioCtx = audioContextRef.current;
      if (!audioCtx || audioCtx.state === "closed") {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
      }
      
      // Resume AudioContext if suspended
      if (audioCtx.state === "suspended") {
        audioCtx.resume().then(() => {
          console.warn("🔊 [AUDIO] AudioContext resumed");
        });
      }
      
      // If already connected, just update gain
      if (audioDestinationConnectedRef.current && gainNodeRef.current) {
        const gainValue = boost ? 3.0 : 1.0; // 3x boost when enabled
        gainNodeRef.current.gain.setValueAtTime(gainValue, audioCtx.currentTime);
        console.warn(`🔊 [AUDIO] Updated gain to ${gainValue}x (boost: ${boost})`);
        return;
      }
      
      // Disconnect old source if exists
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }
      
      // Create source from remote stream and connect directly to speakers
      const source = audioCtx.createMediaStreamSource(remoteStream);
      audioSourceRef.current = source;
      
      // Create gain node for volume control
      const gainNode = audioCtx.createGain();
      const gainValue = boost ? 3.0 : 1.0; // 3x boost when enabled
      gainNode.gain.value = gainValue;
      gainNodeRef.current = gainNode;
      
      // Connect: source -> gain -> analyser (for monitoring) -> destination
      source.connect(gainNode);
      
      // Reconnect analyser in the chain if it exists
      if (analyserRef.current) {
        gainNode.connect(analyserRef.current);
        analyserRef.current.connect(audioCtx.destination);
      } else {
        gainNode.connect(audioCtx.destination);
      }
      
      audioDestinationConnectedRef.current = true;
      
      console.warn(`🔊 [AUDIO] Routed remote audio through Web Audio API (gain: ${gainValue}x)!`);
      console.warn("🔊 [AUDIO] AudioContext state:", audioCtx.state, "Sample rate:", audioCtx.sampleRate);
      
      // Check audio level to verify data is flowing
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avgLevel = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const peakLevel = Math.max(...dataArray);
        console.log("📊 [WEB AUDIO] Audio level after routing:", { avg: avgLevel.toFixed(2), peak: peakLevel });
        
        if (avgLevel < 1 && peakLevel < 5) {
          console.warn("⚠️ [WEB AUDIO] No audio data detected - remote microphone may be muted or not working!");
        }
      }
      
    } catch (error) {
      console.error("❌ [AUDIO] Failed to route via Web Audio API:", error);
    }
  };

  // Toggle volume boost - increases audio gain for louder playback
  const toggleVolumeBoost = () => {
    const newBoostState = !isVolumeBoosted;
    setIsVolumeBoosted(newBoostState);
    
    console.warn(`🔊 [VOLUME] ${newBoostState ? "Boosting" : "Normalizing"} volume`);
    
    // Update gain node if already routing
    if (gainNodeRef.current && audioContextRef.current) {
      const gainValue = newBoostState ? 3.0 : 1.0;
      gainNodeRef.current.gain.setValueAtTime(gainValue, audioContextRef.current.currentTime);
    }
    
    // Also update video/audio element volumes
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = newBoostState ? 1.0 : 1.0; // Max out video volume
    }
    if (audioElementRef.current) {
      audioElementRef.current.volume = newBoostState ? 1.0 : 1.0; // Max out audio volume
    }
    
    // If not yet routing through Web Audio API, start now
    if (!audioDestinationConnectedRef.current && remoteStream) {
      routeAudioViaWebAudioAPI(newBoostState);
    }
  };

  const handleVideoClick = () => {
    if (!remoteVideoRef.current || !remoteVideoRef.current.srcObject) return;

    const video = remoteVideoRef.current;
    console.warn("👆 [VIDEO UI] User clicked video area", {
      paused: video.paused,
      muted: video.muted,
      readyState: video.readyState,
      volume: video.volume,
      isAudioMutedByBrowser,
      audioEnabled: audioEnabledRef.current,
      audioElPaused: audioElementRef.current?.paused,
    });

    // User clicking the video is explicit interaction - enable audio
    audioEnabledRef.current = true;

    // CRITICAL: Force audio playback on any click
    forceAudioPlayback();

    // If video is paused, try to play with audio
    if (video.paused) {
      video.muted = false;
      setIsVideoMuted(false);
      video
        .play()
        .then(() => {
          console.warn("✅ [VIDEO UI] Video started playing with audio after click");
          setVideoState("playing");
          setIsAudioMutedByBrowser(false);
        })
        .catch((error) => {
          console.error("❌ [VIDEO UI] Click play failed:", error);
          // User clicked but browser still blocked - this is rare
          if (error.name === "NotAllowedError") {
            video.muted = true;
            setIsVideoMuted(true);
            setIsAudioMutedByBrowser(true);
            video
              .play()
              .catch((e) => console.error("Muted play also failed:", e));
          }
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

    if (videoState === "error") {
      return "Video error - click to retry";
    }

    if (videoState === "loading") {
      return "Connecting to other side...";
    }

    // If video is paused but we have a stream, might need user interaction
    if (remoteVideoRef.current?.paused && videoState !== "playing") {
      return "Click to start video";
    }

    // Don't show regular muted message if playing - we have separate audio indicator
    return null;
  };

  const statusMessage = getStatusMessage();

  // CRITICAL: Show audio muted indicator prominently when audio is not playing
  const showAudioMutedIndicator = isAudioMutedByBrowser || isVideoMuted;
  
  // Show "tap for audio" button for first 10 seconds of call as a hint
  const [showAudioHint, setShowAudioHint] = useState(true);
  useEffect(() => {
    if (videoState === "playing") {
      const timer = setTimeout(() => setShowAudioHint(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [videoState]);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" onClick={handleVideoClick}>
      <div className="relative h-full w-full">
        {/* Remote video (full screen) - audio plays through this element */}
        {/* AUDIO: Starts muted, only unmuted after user clicks Call/Accept or taps video */}
        {/* CRITICAL: Use React state for muted prop - hardcoded muted={true} prevents programmatic unmute */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={isVideoMuted}  // CONTROLLED: React state controls muted
          className="w-full h-full object-cover"
          style={{ backgroundColor: "#000" }}
          onLoadedMetadata={() => {
            // Enable audio tracks and potentially unmute video if user started call
            if (remoteVideoRef.current && remoteStream) {
              const video = remoteVideoRef.current;
              const audioTracks = remoteStream.getAudioTracks();
              const canPlayAudio = getUserHasStartedCall();
              
              console.warn("🎬 [VIDEO UI] onLoadedMetadata fired", {
                audioTracks: audioTracks.length,
                videoMuted: video.muted,
                canPlayAudio,
                audioEnabled: audioEnabledRef.current,
              });
              
              // Enable all audio tracks (they need to be enabled for audio to work)
              audioTracks.forEach((track) => {
                track.enabled = true;
                console.warn("🔊 [VIDEO UI] Enabled audio track in stream:", track.id);
              });
              
              // Only unmute video element if user clicked Call/Accept
              if (canPlayAudio) {
                video.muted = false;
                setIsVideoMuted(false);
                setIsAudioMutedByBrowser(false);
                console.warn("🔊 [VIDEO UI] Unmuted video (user had started call)");
                
                // Also unmute hidden audio element
                if (audioElementRef.current) {
                  audioElementRef.current.muted = false;
                  audioElementRef.current.play().catch(() => {});
                }
              } else {
                setIsAudioMutedByBrowser(true);
              }
            }
          }}
          onPlay={() => {
            // When video starts playing, check if we should unmute
            if (remoteVideoRef.current) {
              const video = remoteVideoRef.current;
              const canPlayAudio = getUserHasStartedCall() || audioEnabledRef.current;
              
              if (canPlayAudio && video.muted) {
                video.muted = false;
                setIsVideoMuted(false);
                setIsAudioMutedByBrowser(false);
                console.warn("🔊 [VIDEO UI] Unmuted video on play event");
                
                // Also unmute hidden audio element
                if (audioElementRef.current) {
                  audioElementRef.current.muted = false;
                  audioElementRef.current.play().catch(() => {});
                }
              } else if (video.muted) {
                setIsAudioMutedByBrowser(true);
              }
            }
          }}
        />

        {/* Video placeholder - shown when video is disabled due to poor network */}
        {/* Kid-friendly animated placeholder instead of frozen video frame */}
        {networkQuality?.isVideoPausedDueToNetwork && (
          <div className="absolute inset-0 z-10">
            <VideoPlaceholder
              type="remote"
              reason="network"
              name={undefined} // TODO: Pass remote user's name if available
            />
          </div>
        )}

        {/* Connecting placeholder - shown when no remote stream yet */}
        {!remoteStream && isConnecting && (
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
            {/* Animated background rings */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
              <div 
                className="absolute w-[300px] h-[300px] rounded-full border border-white/10 animate-ping"
                style={{ animationDuration: "3s" }}
              />
              <div 
                className="absolute w-[200px] h-[200px] rounded-full border border-white/15 animate-ping"
                style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}
              />
            </div>
            {/* Connecting content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
                  <span className="text-5xl animate-pulse">📞</span>
                </div>
                <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 animate-bounce">
                  <div className="w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Connecting...</h2>
              <p className="text-white/60 text-sm">Setting up your video call</p>
              {/* Loading dots */}
              <div className="flex gap-2 mt-6">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {/* CRITICAL: Audio muted indicator - shown prominently when browser blocked audio */}
        {/* Positioned below the PIP video */}
        {showAudioMutedIndicator && videoState === "playing" && (
          <div 
            className="absolute top-44 left-1/2 -translate-x-1/2 z-50"
            onClick={handleVideoClick}
          >
            <button className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-6 py-3 rounded-2xl shadow-xl shadow-red-500/30 flex items-center gap-3 cursor-pointer animate-pulse hover:scale-105 transition-transform active:scale-95">
              <div className="bg-white/20 rounded-full p-2">
                <span className="text-xl">🔇</span>
              </div>
              <span className="font-bold text-lg">TAP FOR AUDIO</span>
            </button>
          </div>
        )}

        {/* Audio hint button - shown for first 10 seconds in case audio doesn't work */}
        {showAudioHint && videoState === "playing" && !showAudioMutedIndicator && (
          <div 
            className="absolute top-44 left-1/2 -translate-x-1/2 z-50"
            onClick={() => {
              forceAudioPlayback();
              setShowAudioHint(false);
            }}
          >
            <button className="bg-white/10 backdrop-blur-sm text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 cursor-pointer text-sm hover:bg-white/20 transition-colors border border-white/20">
              <span>🔊</span>
              <span>No audio? Tap here</span>
            </button>
          </div>
        )}

        {/* Warning when no audio data ever received - only shows if we've NEVER detected audio */}
        {showNoRemoteAudioWarning && videoState === "playing" && !showAudioMutedIndicator && (
          <div 
            className="absolute top-56 left-1/2 -translate-x-1/2 z-50 max-w-[90%] cursor-pointer"
            onClick={() => setShowNoRemoteAudioWarning(false)}  
          >
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-5 py-3 rounded-2xl shadow-xl shadow-orange-500/30 text-sm text-center">
              <div className="font-bold mb-1 flex items-center justify-center gap-2">
                <span>⚠️</span> Checking audio...
              </div>
              <div className="text-xs opacity-90">
                If you can hear audio, tap to dismiss
              </div>
            </div>
          </div>
        )}

        {/* Connection status overlay - z-20 to stay below controls (z-50) */}
        {statusMessage && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-b from-slate-900/95 via-slate-800/95 to-slate-900/95 cursor-pointer"
            onClick={handleVideoClick}
          >
            <div className="text-center space-y-6 px-8">
              {/* Status icon with animated background */}
              <div className="relative inline-flex items-center justify-center">
                <div 
                  className={`absolute w-28 h-28 rounded-full ${
                    videoState === "error" ? "bg-red-500/20" : "bg-blue-500/20"
                  } animate-ping`}
                  style={{ animationDuration: "2s" }}
                />
                <div 
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl ${
                    videoState === "error" 
                      ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30" 
                      : "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30"
                  }`}
                >
                  <span className="text-5xl">
                    {videoState === "error"
                      ? "❌"
                      : videoState === "loading"
                      ? "⏳"
                      : "📞"}
                  </span>
                </div>
              </div>
              {/* Status text */}
              <div className="space-y-2">
                <p className="text-white text-2xl font-bold">{statusMessage}</p>
                {remoteStream && (
                  <p className="text-white/60 text-sm">
                    {videoState === "loading"
                      ? "Establishing connection..."
                      : videoState === "error"
                      ? "Check your connection"
                      : "Tap anywhere to interact"}
                  </p>
                )}
              </div>
              {/* Loading indicator for non-error states */}
              {videoState === "loading" && (
                <div className="flex gap-2 justify-center">
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
              {/* Retry button for errors */}
              {videoState === "error" && (
                <button className="mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl shadow-lg hover:scale-105 transition-transform active:scale-95">
                  Tap to retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Local video (picture-in-picture) - high z-index to stay above placeholders */}
        <div className="absolute top-4 right-4 z-30">
          <div className="relative">
            {/* Glowing border effect */}
            <div className="absolute -inset-1 bg-gradient-to-br from-blue-500/50 to-purple-500/50 rounded-2xl blur-sm" />
            {/* Video container */}
            <div className="relative w-32 h-24 sm:w-40 sm:h-30 md:w-48 md:h-36 rounded-xl overflow-hidden shadow-2xl border-2 border-white/30 bg-slate-900">
              {/* Show placeholder when video is off or paused due to network */}
              {(isVideoOff || networkQuality?.isVideoPausedDueToNetwork) ? (
                <VideoPlaceholder
                  type="local"
                  reason={networkQuality?.isVideoPausedDueToNetwork ? "network" : "disabled"}
                />
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}
              {/* "You" label */}
              <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md">
                <span className="text-white text-xs font-medium">You</span>
              </div>
              {/* Muted indicator on PIP */}
              {isMuted && (
                <div className="absolute top-1 right-1 bg-red-500/80 rounded-full p-1">
                  <span className="text-xs">🔇</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Network Quality Indicator - shows connection quality for adaptive streaming */}
        {/* Supports all network conditions from 2G to 5G/WiFi - collapsed by default, click to expand */}
        {networkQuality ? (
          <div className="absolute top-4 left-4 z-40">
            <ConnectionQualityIndicator
              qualityLevel={networkQuality.qualityLevel}
              connectionType={networkQuality.connectionType}
              networkStats={networkQuality.networkStats}
              isVideoPausedDueToNetwork={networkQuality.isVideoPausedDueToNetwork}
              showDetails={true}
              defaultExpanded={false}
            />
          </div>
        ) : (
          // Fallback when networkQuality is not yet available (initializing)
          <div className="absolute top-4 left-4 z-40">
            <div className="flex items-center gap-2 px-2 py-1 rounded-lg backdrop-blur-sm bg-gray-500/20 text-gray-400">
              <span className="text-xs">📶</span>
              <span className="text-xs font-medium">Checking...</span>
            </div>
          </div>
        )}

        {/* Diagnostic panels - positioned in bottom-left corner to avoid overlaps */}
        {/* Help icon (?) allows users to access debugging info when troubleshooting */}
        {remoteStream && (
          <DiagnosticContainer
            videoRef={remoteVideoRef}
            videoState={videoState}
            isAudioMutedByBrowser={isAudioMutedByBrowser}
            audioElementRef={audioElementRef}
            remoteStream={remoteStream}
            className="absolute bottom-24 left-4 z-50"
          />
        )}

        {/* Video paused due to poor network - kid-friendly indicator */}
        {networkQuality?.isVideoPausedDueToNetwork && (
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-50">
            <button 
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-4 rounded-2xl shadow-xl shadow-orange-500/30 flex items-center gap-4 hover:scale-105 transition-transform active:scale-95 border border-white/20"
              onClick={() => networkQuality.enableVideoIfPossible()}
            >
              <div className="bg-white/20 rounded-full p-3">
                <span className="text-2xl">📞</span>
              </div>
              <div className="text-left">
                <span className="block text-base font-bold">Audio Call Mode</span>
                <span className="block text-xs opacity-80">Connection is slow • Tap to try video</span>
              </div>
            </button>
          </div>
        )}

        {/* Controls */}
        <CallControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onToggleMute={onToggleMute}
          onToggleVideo={onToggleVideo}
          onEndCall={onEndCall}
          isVolumeBoosted={isVolumeBoosted}
          onToggleVolume={toggleVolumeBoost}
        />
      </div>
    </div>
  );
};

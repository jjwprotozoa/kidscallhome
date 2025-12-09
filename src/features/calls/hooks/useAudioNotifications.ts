// src/features/calls/hooks/useAudioNotifications.ts
// Audio notification management for calls (ringtones, call ended sounds, etc.)

import { useRef, useEffect, useCallback } from "react";
import { safeLog } from "@/utils/security";

export type SoundType = "ringtone" | "call-ended" | "call-answered";

interface UseAudioNotificationsOptions {
  enabled?: boolean;
  volume?: number; // 0.0 to 1.0
}

export const useAudioNotifications = (options: UseAudioNotificationsOptions = {}) => {
  const { enabled = true, volume = 0.7 } = options;
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef<{ [key in SoundType]?: boolean }>({});
  const resumeListenersRef = useRef<Array<{ event: string; handler: () => void }>>([]);

  // Cleanup on unmount - only clean up if audio was actually used
  useEffect(() => {
    return () => {
      if (isPlayingRef.current.ringtone) {
        isPlayingRef.current.ringtone = false;
      }
      if (ringtoneIntervalRef.current) {
        clearInterval(ringtoneIntervalRef.current);
        ringtoneIntervalRef.current = null;
      }
      // Only try to stop vibration if it was actually started
      const hadVibration = vibrationIntervalRef.current !== null;
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
      // Stop vibration only if it was actually running (avoids browser warnings)
      if (hadVibration && "vibrate" in navigator) {
        try {
          navigator.vibrate(0); // Stop any ongoing vibration
        } catch (error) {
          // Vibration requires user interaction - silently ignore in cleanup
          // This is expected during HMR or if user hasn't interacted yet
        }
      }
      // Remove event listeners
      resumeListenersRef.current.forEach(({ event, handler }) => {
        document.removeEventListener(event, handler);
      });
      resumeListenersRef.current = [];
      if (audioContextRef.current) {
        audioContextRef.current.close().catch((err) => safeLog.error("Error:", err));
        audioContextRef.current = null;
      }
    };
  }, []);

  // Ensure audio context is resumed before playing
  // AudioContext is created lazily only when audio needs to play (when a call starts)
  const ensureAudioContextReady = useCallback(async (): Promise<AudioContext | null> => {
    if (!enabled) return null;

    // Create AudioContext lazily only when needed (when a call starts)
    if (!audioContextRef.current) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
        safeLog.log("🔊 [AUDIO] AudioContext created (lazy init), initial state:", audioContextRef.current.state);

        // Set up resume listeners when AudioContext is first created
        const resumeAudio = async () => {
          if (audioContextRef.current && audioContextRef.current.state === "suspended") {
            try {
              await audioContextRef.current.resume();
              safeLog.log("🔊 [AUDIO] AudioContext resumed via user interaction");
            } catch (error) {
              safeLog.error("❌ [AUDIO] Failed to resume AudioContext:", error);
            }
          }
        };

        // Listen for user interactions to resume AudioContext (required by browser autoplay policy)
        const events = ["click", "touchstart", "keydown", "mousedown"];
        events.forEach((event) => {
          document.addEventListener(event, resumeAudio, { passive: true });
          resumeListenersRef.current.push({ event, handler: resumeAudio });
        });
      } catch (error) {
        safeLog.error("❌ [AUDIO] Failed to create AudioContext:", error);
        return null;
      }
    }

    // Resume if suspended - try multiple times if needed
    if (audioContextRef.current.state === "suspended") {
      try {
        // Only log in dev mode to reduce console noise
        if (import.meta.env.DEV) {
          safeLog.log("🔊 [AUDIO] AudioContext is suspended, attempting to resume...");
        }
        await audioContextRef.current.resume();
        if (import.meta.env.DEV) {
          safeLog.log("🔊 [AUDIO] AudioContext resumed successfully, state:", audioContextRef.current.state);
        }
      } catch (error) {
        // AudioContext autoplay restrictions are expected - don't log as error
        // Browser will show its own warning, we just handle it gracefully
        if (import.meta.env.DEV) {
          safeLog.debug("🔊 [AUDIO] AudioContext resume blocked by autoplay policy (expected without user gesture)");
        }
        // Try one more time after a short delay
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (audioContextRef.current && audioContextRef.current.state === "suspended") {
            await audioContextRef.current.resume();
            if (import.meta.env.DEV) {
              safeLog.log("🔊 [AUDIO] AudioContext resumed on retry, state:", audioContextRef.current.state);
            }
          }
        } catch (retryError) {
          // Autoplay restrictions are expected - don't log as error
          if (import.meta.env.DEV) {
            safeLog.debug("🔊 [AUDIO] AudioContext requires user interaction (expected browser behavior)");
          }
          return null;
        }
      }
    }

    return audioContextRef.current;
  }, [enabled]);

  // Start vibration pattern (for mobile devices)
  const startVibration = useCallback(() => {
    if (!enabled || !("vibrate" in navigator)) {
      return;
    }

    try {
      // Vibration pattern: vibrate, pause, vibrate (like phone ringing)
      const vibratePattern = () => {
        if (isPlayingRef.current.ringtone && "vibrate" in navigator) {
          try {
            navigator.vibrate([200, 100, 200]);
          } catch (error) {
            // Vibration requires user interaction - silently ignore
            // It will work once user has interacted with the page
          }
        }
      };

      // Start vibration immediately (may fail if no user interaction yet)
      vibratePattern();

      // Repeat vibration pattern every 2 seconds (matching ringtone pattern)
      vibrationIntervalRef.current = setInterval(() => {
        if (isPlayingRef.current.ringtone) {
          vibratePattern();
        }
      }, 2000);

      safeLog.log("📳 [AUDIO] Vibration started");
    } catch (error) {
      // Vibration may fail if no user interaction yet - this is expected
      safeLog.debug("📳 [AUDIO] Vibration not available yet (requires user interaction)");
    }
  }, [enabled]);

  // Play ringtone (looping)
  const playRingtone = useCallback(async () => {
    if (!enabled) {
      safeLog.log("🔔 [AUDIO] Audio notifications disabled");
      return;
    }
    
    if (isPlayingRef.current.ringtone) {
      safeLog.log("🔔 [AUDIO] Ringtone already playing");
      return;
    }

    const audioContext = await ensureAudioContextReady();
    if (!audioContext) {
      safeLog.error("❌ [AUDIO] Cannot play ringtone - AudioContext not available");
      return;
    }

    try {
      isPlayingRef.current.ringtone = true;
      safeLog.log("🔔 [AUDIO] Ringtone started, AudioContext state:", audioContext.state);

      const playTone = () => {
        if (!isPlayingRef.current.ringtone || !audioContextRef.current) return;
        
        try {
          const oscillator = audioContextRef.current.createOscillator();
          const gainNode = audioContextRef.current.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContextRef.current.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = "sine";
          
          const now = audioContextRef.current.currentTime;
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(volume * 0.4, now + 0.05);
          gainNode.gain.linearRampToValueAtTime(volume * 0.4, now + 0.2);
          gainNode.gain.linearRampToValueAtTime(0, now + 0.25);
          
          oscillator.start(now);
          oscillator.stop(now + 0.25);
        } catch (error) {
          safeLog.error("❌ [AUDIO] Error playing tone:", error);
        }
      };

      // Play immediately
      playTone();
      
      // Start vibration
      startVibration();
      
      // Then repeat every 500ms (ring-ring pattern)
      ringtoneIntervalRef.current = setInterval(() => {
        if (isPlayingRef.current.ringtone) {
          playTone();
          // Small delay before second ring
          setTimeout(() => {
            if (isPlayingRef.current.ringtone) {
              playTone();
            }
          }, 250);
        }
      }, 2000); // Repeat pattern every 2 seconds
      
    } catch (error) {
      safeLog.error("❌ [AUDIO] Error playing ringtone:", error);
      isPlayingRef.current.ringtone = false;
    }
  }, [enabled, volume, ensureAudioContextReady, startVibration]);

  // Stop vibration
  const stopVibration = useCallback(() => {
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(0); // Stop any ongoing vibration
      } catch (error) {
        // Vibration requires user interaction - silently ignore
      }
    }
    safeLog.log("📳 [AUDIO] Vibration stopped");
  }, []);

  // Stop ringtone
  const stopRingtone = useCallback(() => {
    if (isPlayingRef.current.ringtone) {
      isPlayingRef.current.ringtone = false;
      if (ringtoneIntervalRef.current) {
        clearInterval(ringtoneIntervalRef.current);
        ringtoneIntervalRef.current = null;
      }
      stopVibration();
      safeLog.log("🔇 [AUDIO] Ringtone stopped");
    }
  }, [stopVibration]);

  // Play call ended sound
  const playCallEnded = useCallback(async () => {
    if (!enabled) return;
    
    const audioContext = await ensureAudioContextReady();
    if (!audioContext) return;
    
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 400;
      oscillator.type = "sine";
      
      const now = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume * 0.3, now + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
      
      oscillator.start(now);
      oscillator.stop(now + 0.2);
      
      safeLog.log("🔔 [AUDIO] Call ended sound played");
    } catch (error) {
      safeLog.error("❌ [AUDIO] Error playing call ended sound:", error);
    }
  }, [enabled, volume, ensureAudioContextReady]);

  // Play call answered sound
  const playCallAnswered = useCallback(async () => {
    if (!enabled) return;
    
    const audioContext = await ensureAudioContextReady();
    if (!audioContext) return;
    
    try {
      // Two-tone chime
      [600, 800].forEach((freq, index) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.value = freq;
        osc.type = "sine";
        
        const startTime = audioContext.currentTime + index * 0.1;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, startTime + 0.15);
        
        osc.start(startTime);
        osc.stop(startTime + 0.15);
      });
      
      safeLog.log("🔔 [AUDIO] Call answered sound played");
    } catch (error) {
      safeLog.error("❌ [AUDIO] Error playing call answered sound:", error);
    }
  }, [enabled, volume, ensureAudioContextReady]);

  // Generic stop sound function
  const stopSound = useCallback((soundType: SoundType) => {
    if (soundType === "ringtone") {
      stopRingtone();
    }
    // Other sounds are one-shot, so no need to stop them
  }, [stopRingtone]);

  return {
    playRingtone,
    stopRingtone,
    startVibration,
    stopVibration,
    playCallEnded,
    playCallAnswered,
    stopSound,
    isPlaying: isPlayingRef.current,
  };
};


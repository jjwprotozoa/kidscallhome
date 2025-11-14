// src/hooks/useAudioNotifications.ts
// Audio notification management for calls (ringtones, call ended sounds, etc.)

import { useRef, useEffect, useCallback } from "react";

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

  // Initialize audio context
  useEffect(() => {
    if (!enabled) return;

    // Create a single AudioContext that we'll reuse
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      console.log("🔊 [AUDIO] AudioContext created, state:", audioContextRef.current.state);
    } catch (error) {
      console.error("❌ [AUDIO] Failed to create AudioContext:", error);
    }

    // Resume audio context on user interaction (required by browser autoplay policy)
    const resumeAudio = async () => {
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        try {
          await audioContextRef.current.resume();
          console.log("🔊 [AUDIO] AudioContext resumed via user interaction");
        } catch (error) {
          console.error("❌ [AUDIO] Failed to resume AudioContext:", error);
        }
      }
    };

    // Try to resume on any user interaction (listen to all interactions, not just once)
    const events = ["click", "touchstart", "keydown", "mousedown"];
    events.forEach((event) => {
      document.addEventListener(event, resumeAudio, { passive: true });
      resumeListenersRef.current.push({ event, handler: resumeAudio });
    });

    // Also try to resume immediately if possible (some browsers allow this)
    resumeAudio();

    // Cleanup on unmount
    return () => {
      if (isPlayingRef.current.ringtone) {
        isPlayingRef.current.ringtone = false;
      }
      if (ringtoneIntervalRef.current) {
        clearInterval(ringtoneIntervalRef.current);
        ringtoneIntervalRef.current = null;
      }
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
      // Stop vibration if supported (may fail if no user interaction yet)
      if ("vibrate" in navigator) {
        try {
          navigator.vibrate(0); // Stop any ongoing vibration
        } catch (error) {
          // Vibration requires user interaction - silently ignore in cleanup
        }
      }
      // Remove event listeners
      resumeListenersRef.current.forEach(({ event, handler }) => {
        document.removeEventListener(event, handler);
      });
      resumeListenersRef.current = [];
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
    };
  }, [enabled]);

  // Ensure audio context is resumed before playing
  const ensureAudioContextReady = useCallback(async (): Promise<AudioContext | null> => {
    if (!audioContextRef.current) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
        console.log("🔊 [AUDIO] AudioContext created, initial state:", audioContextRef.current.state);
      } catch (error) {
        console.error("❌ [AUDIO] Failed to create AudioContext:", error);
        return null;
      }
    }

    // Resume if suspended - try multiple times if needed
    if (audioContextRef.current.state === "suspended") {
      try {
        console.log("🔊 [AUDIO] AudioContext is suspended, attempting to resume...");
        await audioContextRef.current.resume();
        console.log("🔊 [AUDIO] AudioContext resumed successfully, state:", audioContextRef.current.state);
      } catch (error) {
        console.error("❌ [AUDIO] Failed to resume AudioContext:", error);
        // Try one more time after a short delay
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (audioContextRef.current.state === "suspended") {
            await audioContextRef.current.resume();
            console.log("🔊 [AUDIO] AudioContext resumed on retry, state:", audioContextRef.current.state);
          }
        } catch (retryError) {
          console.error("❌ [AUDIO] Failed to resume AudioContext on retry:", retryError);
          // If resume fails, the AudioContext might need user interaction
          // Log a helpful message
          console.warn("⚠️ [AUDIO] AudioContext requires user interaction. Ringtone may not play until user interacts with page.");
          return null;
        }
      }
    }

    return audioContextRef.current;
  }, []);

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

      console.log("📳 [AUDIO] Vibration started");
    } catch (error) {
      // Vibration may fail if no user interaction yet - this is expected
      console.debug("📳 [AUDIO] Vibration not available yet (requires user interaction)");
    }
  }, [enabled]);

  // Play ringtone (looping)
  const playRingtone = useCallback(async () => {
    if (!enabled) {
      console.log("🔔 [AUDIO] Audio notifications disabled");
      return;
    }
    
    if (isPlayingRef.current.ringtone) {
      console.log("🔔 [AUDIO] Ringtone already playing");
      return;
    }

    const audioContext = await ensureAudioContextReady();
    if (!audioContext) {
      console.error("❌ [AUDIO] Cannot play ringtone - AudioContext not available");
      return;
    }

    try {
      isPlayingRef.current.ringtone = true;
      console.log("🔔 [AUDIO] Ringtone started, AudioContext state:", audioContext.state);

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
          console.error("❌ [AUDIO] Error playing tone:", error);
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
      console.error("❌ [AUDIO] Error playing ringtone:", error);
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
    console.log("📳 [AUDIO] Vibration stopped");
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
      console.log("🔇 [AUDIO] Ringtone stopped");
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
      
      console.log("🔔 [AUDIO] Call ended sound played");
    } catch (error) {
      console.error("❌ [AUDIO] Error playing call ended sound:", error);
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
      
      console.log("🔔 [AUDIO] Call answered sound played");
    } catch (error) {
      console.error("❌ [AUDIO] Error playing call answered sound:", error);
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


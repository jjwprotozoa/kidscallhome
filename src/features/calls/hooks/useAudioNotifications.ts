// src/features/calls/hooks/useAudioNotifications.ts
// Audio notification management for calls (ringtones, call ended sounds, etc.)

import { useRef, useEffect, useCallback } from "react";
import { safeLog } from "@/utils/security";

export type SoundType = "ringtone" | "outgoing-ringtone" | "call-ended" | "call-answered";

interface UseAudioNotificationsOptions {
  enabled?: boolean;
  volume?: number; // 0.0 to 1.0
}

export const useAudioNotifications = (options: UseAudioNotificationsOptions = {}) => {
  const { enabled = true, volume = 0.7 } = options;
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const outgoingRingtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef<{ [key in SoundType]?: boolean }>({});
  const resumeListenersRef = useRef<Array<{ event: string; handler: () => void }>>([]);

  // Cleanup on unmount - only clean up if audio was actually used
  useEffect(() => {
    return () => {
      if (isPlayingRef.current.ringtone) {
        isPlayingRef.current.ringtone = false;
      }
      if (isPlayingRef.current["outgoing-ringtone"]) {
        isPlayingRef.current["outgoing-ringtone"] = false;
      }
      if (ringtoneIntervalRef.current) {
        clearInterval(ringtoneIntervalRef.current);
        ringtoneIntervalRef.current = null;
      }
      if (outgoingRingtoneIntervalRef.current) {
        clearInterval(outgoingRingtoneIntervalRef.current);
        outgoingRingtoneIntervalRef.current = null;
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

  // Play ringtone (looping) - Kid-friendly xylophone melody!
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
      safeLog.log("🔔 [AUDIO] Ringtone started (kid-friendly melody), AudioContext state:", audioContext.state);

      // Kid-friendly xylophone melody notes (C major pentatonic scale - happy & playful)
      // Notes: C5, E5, G5, A5, C6 (frequencies in Hz)
      const melodyNotes = [
        { freq: 523.25, duration: 0.15 },  // C5
        { freq: 659.25, duration: 0.15 },  // E5
        { freq: 783.99, duration: 0.15 },  // G5
        { freq: 880.00, duration: 0.2 },   // A5 (held slightly longer)
        { freq: 783.99, duration: 0.15 },  // G5
        { freq: 659.25, duration: 0.15 },  // E5
        { freq: 523.25, duration: 0.3 },   // C5 (ending note, held longer)
      ];

      const playMelody = () => {
        if (!isPlayingRef.current.ringtone || !audioContextRef.current) return;
        
        let noteStartTime = audioContextRef.current.currentTime;
        
        melodyNotes.forEach((note) => {
          if (!audioContextRef.current) return;
          
          try {
            // Create xylophone-like sound with harmonics
            const oscillator = audioContextRef.current.createOscillator();
            const harmonic = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();
            const harmonicGain = audioContextRef.current.createGain();
            
            oscillator.connect(gainNode);
            harmonic.connect(harmonicGain);
            gainNode.connect(audioContextRef.current.destination);
            harmonicGain.connect(audioContextRef.current.destination);
            
            // Main tone - triangle wave for softer, xylophone-like sound
            oscillator.frequency.value = note.freq;
            oscillator.type = "triangle";
            
            // Add subtle harmonic for brightness (2x frequency, much quieter)
            harmonic.frequency.value = note.freq * 2;
            harmonic.type = "sine";
            
            // Xylophone-style envelope: quick attack, natural decay
            gainNode.gain.setValueAtTime(0, noteStartTime);
            gainNode.gain.linearRampToValueAtTime(volume * 0.5, noteStartTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(volume * 0.1, noteStartTime + note.duration * 0.5);
            gainNode.gain.linearRampToValueAtTime(0.001, noteStartTime + note.duration);
            
            // Harmonic envelope (quieter, faster decay)
            harmonicGain.gain.setValueAtTime(0, noteStartTime);
            harmonicGain.gain.linearRampToValueAtTime(volume * 0.15, noteStartTime + 0.01);
            harmonicGain.gain.exponentialRampToValueAtTime(0.001, noteStartTime + note.duration * 0.3);
            
            oscillator.start(noteStartTime);
            oscillator.stop(noteStartTime + note.duration);
            harmonic.start(noteStartTime);
            harmonic.stop(noteStartTime + note.duration * 0.3);
            
            noteStartTime += note.duration + 0.02; // Small gap between notes
          } catch (error) {
            safeLog.error("❌ [AUDIO] Error playing note:", error);
          }
        });
      };

      // Play immediately
      playMelody();
      
      // Start vibration
      startVibration();
      
      // Repeat melody every 2.5 seconds
      ringtoneIntervalRef.current = setInterval(() => {
        if (isPlayingRef.current.ringtone) {
          playMelody();
        }
      }, 2500);
      
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

  // Play outgoing ringtone (for caller waiting for answer) - Soft "ding-dong" waiting tone
  const playOutgoingRingtone = useCallback(async () => {
    if (!enabled) {
      safeLog.log("🔔 [AUDIO] Audio notifications disabled");
      return;
    }
    
    if (isPlayingRef.current["outgoing-ringtone"]) {
      safeLog.log("🔔 [AUDIO] Outgoing ringtone already playing");
      return;
    }

    const audioContext = await ensureAudioContextReady();
    if (!audioContext) {
      safeLog.error("❌ [AUDIO] Cannot play outgoing ringtone - AudioContext not available");
      return;
    }

    try {
      isPlayingRef.current["outgoing-ringtone"] = true;
      safeLog.log("🔔 [AUDIO] Outgoing ringtone started (waiting tone), AudioContext state:", audioContext.state);

      // Soft "ding-dong" pattern - like a doorbell, indicating "waiting"
      // G5 -> E5 (classic doorbell interval - a minor third down)
      const waitingTone = [
        { freq: 783.99, duration: 0.35 },  // G5 (ding)
        { freq: 659.25, duration: 0.5 },   // E5 (dong - held longer)
      ];

      const playWaitingChime = () => {
        if (!isPlayingRef.current["outgoing-ringtone"] || !audioContextRef.current) return;
        
        let noteStartTime = audioContextRef.current.currentTime;
        
        waitingTone.forEach((note, index) => {
          if (!audioContextRef.current) return;
          
          try {
            // Create soft bell-like tone
            const oscillator = audioContextRef.current.createOscillator();
            const harmonic = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();
            const harmonicGain = audioContextRef.current.createGain();
            
            oscillator.connect(gainNode);
            harmonic.connect(harmonicGain);
            gainNode.connect(audioContextRef.current.destination);
            harmonicGain.connect(audioContextRef.current.destination);
            
            // Soft sine wave for main tone (gentler than incoming)
            oscillator.frequency.value = note.freq;
            oscillator.type = "sine";
            
            // Subtle harmonic for shimmer
            harmonic.frequency.value = note.freq * 3; // Third harmonic for bell quality
            harmonic.type = "sine";
            
            // Soft bell envelope - longer decay for "waiting" feel
            gainNode.gain.setValueAtTime(0, noteStartTime);
            gainNode.gain.linearRampToValueAtTime(volume * 0.35, noteStartTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(volume * 0.08, noteStartTime + note.duration * 0.4);
            gainNode.gain.exponentialRampToValueAtTime(0.001, noteStartTime + note.duration);
            
            // Harmonic envelope (very subtle)
            harmonicGain.gain.setValueAtTime(0, noteStartTime);
            harmonicGain.gain.linearRampToValueAtTime(volume * 0.06, noteStartTime + 0.02);
            harmonicGain.gain.exponentialRampToValueAtTime(0.001, noteStartTime + note.duration * 0.25);
            
            oscillator.start(noteStartTime);
            oscillator.stop(noteStartTime + note.duration);
            harmonic.start(noteStartTime);
            harmonic.stop(noteStartTime + note.duration * 0.25);
            
            noteStartTime += note.duration + (index === 0 ? 0.08 : 0); // Small gap after first note
          } catch (error) {
            safeLog.error("❌ [AUDIO] Error playing waiting tone:", error);
          }
        });
      };

      // Play immediately
      playWaitingChime();
      
      // Repeat every 3 seconds (slower than incoming - more relaxed "waiting" feel)
      outgoingRingtoneIntervalRef.current = setInterval(() => {
        if (isPlayingRef.current["outgoing-ringtone"]) {
          playWaitingChime();
        }
      }, 3000);
      
    } catch (error) {
      safeLog.error("❌ [AUDIO] Error playing outgoing ringtone:", error);
      isPlayingRef.current["outgoing-ringtone"] = false;
    }
  }, [enabled, volume, ensureAudioContextReady]);

  // Stop outgoing ringtone
  const stopOutgoingRingtone = useCallback(() => {
    if (isPlayingRef.current["outgoing-ringtone"]) {
      isPlayingRef.current["outgoing-ringtone"] = false;
      if (outgoingRingtoneIntervalRef.current) {
        clearInterval(outgoingRingtoneIntervalRef.current);
        outgoingRingtoneIntervalRef.current = null;
      }
      safeLog.log("🔇 [AUDIO] Outgoing ringtone stopped");
    }
  }, []);

  // Play call ended sound - Soft descending tone (gentle goodbye)
  const playCallEnded = useCallback(async () => {
    if (!enabled) return;
    
    const audioContext = await ensureAudioContextReady();
    if (!audioContext) return;
    
    try {
      // Gentle descending two-note: G4 -> C4 (soft, not jarring)
      const endNotes = [392.00, 261.63]; // G4, C4
      
      endNotes.forEach((freq, index) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.value = freq;
        osc.type = "triangle";
        
        const startTime = audioContext.currentTime + index * 0.15;
        const duration = 0.25;
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume * 0.3, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      });
      
      safeLog.log("🔔 [AUDIO] Call ended sound played (gentle goodbye)");
    } catch (error) {
      safeLog.error("❌ [AUDIO] Error playing call ended sound:", error);
    }
  }, [enabled, volume, ensureAudioContextReady]);

  // Play call answered sound - Cheerful ascending chime!
  const playCallAnswered = useCallback(async () => {
    if (!enabled) return;
    
    const audioContext = await ensureAudioContextReady();
    if (!audioContext) return;
    
    try {
      // Happy ascending chime: C5 -> E5 -> G5 (major triad = happy sound!)
      const chimeNotes = [523.25, 659.25, 783.99];
      
      chimeNotes.forEach((freq, index) => {
        const osc = audioContext.createOscillator();
        const harmonic = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const harmonicGain = audioContext.createGain();
        
        osc.connect(gain);
        harmonic.connect(harmonicGain);
        gain.connect(audioContext.destination);
        harmonicGain.connect(audioContext.destination);
        
        osc.frequency.value = freq;
        osc.type = "triangle";
        
        harmonic.frequency.value = freq * 2;
        harmonic.type = "sine";
        
        const startTime = audioContext.currentTime + index * 0.12;
        const duration = index === 2 ? 0.4 : 0.2; // Last note rings longer
        
        // Soft, bell-like envelope
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume * 0.45, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        harmonicGain.gain.setValueAtTime(0, startTime);
        harmonicGain.gain.linearRampToValueAtTime(volume * 0.12, startTime + 0.02);
        harmonicGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.5);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
        harmonic.start(startTime);
        harmonic.stop(startTime + duration * 0.5);
      });
      
      safeLog.log("🔔 [AUDIO] Call answered sound played (happy chime)");
    } catch (error) {
      safeLog.error("❌ [AUDIO] Error playing call answered sound:", error);
    }
  }, [enabled, volume, ensureAudioContextReady]);

  // Generic stop sound function
  const stopSound = useCallback((soundType: SoundType) => {
    if (soundType === "ringtone") {
      stopRingtone();
    } else if (soundType === "outgoing-ringtone") {
      stopOutgoingRingtone();
    }
    // Other sounds are one-shot, so no need to stop them
  }, [stopRingtone, stopOutgoingRingtone]);

  return {
    playRingtone,
    stopRingtone,
    playOutgoingRingtone,
    stopOutgoingRingtone,
    startVibration,
    stopVibration,
    playCallEnded,
    playCallAnswered,
    stopSound,
    isPlaying: isPlayingRef.current,
  };
};


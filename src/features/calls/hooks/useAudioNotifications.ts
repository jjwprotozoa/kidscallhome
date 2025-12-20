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
  // Matches the melodic rhythm of the ringtone: 6 notes over ~1.2s
  const startVibration = useCallback(() => {
    if (!enabled || !("vibrate" in navigator)) {
      return;
    }

    try {
      // Vibration pattern matching the melody rhythm:
      // C-E-G-A-G-E (6 notes) with short pulses on each note
      // Pattern: [vibrate, pause, vibrate, pause, vibrate, pause, vibrate, pause, vibrate, pause, vibrate]
      // Each note gets ~120-180ms, with ~30ms gaps = ~1.2s total
      const vibratePattern = () => {
        if (isPlayingRef.current.ringtone && "vibrate" in navigator) {
          try {
            // Pulse pattern matching the 6-note melody:
            // Short pulses (80-100ms) with brief pauses (20-30ms) between notes
            // Creates a rhythmic "tap-tap-tap-tap-tap-tap" that matches the xylophone melody
            navigator.vibrate([
              90, 25,  // C4
              90, 25,  // E4
              90, 25,  // G4
              120, 30, // A4 (slightly longer - held note)
              90, 25,  // G4
              150      // E4 (ending note, longer pulse)
            ]);
          } catch (error) {
            // Vibration requires user interaction - silently ignore
            // It will work once user has interacted with the page
          }
        }
      };

      // Start vibration immediately (may fail if no user interaction yet)
      vibratePattern();

      // Repeat vibration pattern every 2.2 seconds (matching ringtone repeat interval)
      // This gives ~1s rest between melodic phrases, matching the audio
      vibrationIntervalRef.current = setInterval(() => {
        if (isPlayingRef.current.ringtone) {
          vibratePattern();
        }
      }, 2200);

      safeLog.log("📳 [AUDIO] Vibration started (melodic rhythm pattern)");
    } catch (error) {
      // Vibration may fail if no user interaction yet - this is expected
      safeLog.debug("📳 [AUDIO] Vibration not available yet (requires user interaction)");
    }
  }, [enabled]);

  // Play ringtone (looping) - Kid-friendly xylophone melody!
  // CRITICAL: ringtoneAbortedRef is used to prevent race conditions
  // If stopRingtone is called while playRingtone is awaiting AudioContext,
  // the aborted flag prevents the ringtone from starting after the await
  const ringtoneAbortedRef = useRef(false);
  
  const playRingtone = useCallback(async () => {
    if (!enabled) {
      safeLog.log("🔔 [AUDIO] Audio notifications disabled");
      return;
    }
    
    if (isPlayingRef.current.ringtone) {
      safeLog.log("🔔 [AUDIO] Ringtone already playing");
      return;
    }

    // Clear the aborted flag when starting a new ringtone attempt
    ringtoneAbortedRef.current = false;

    const audioContext = await ensureAudioContextReady();
    
    // CRITICAL: Check if ringtone was cancelled during the await
    // This prevents the race condition where stopRingtone is called
    // while we were waiting for AudioContext to be ready
    if (ringtoneAbortedRef.current) {
      safeLog.log("🔔 [AUDIO] Ringtone was cancelled while waiting for AudioContext");
      return;
    }
    
    if (!audioContext) {
      safeLog.error("❌ [AUDIO] Cannot play ringtone - AudioContext not available");
      return;
    }

    try {
      isPlayingRef.current.ringtone = true;
      safeLog.log("🔔 [AUDIO] Ringtone started (kid-friendly melody), AudioContext state:", audioContext.state);

      // Kid-friendly xylophone melody - LOWER REGISTER (C4-A4) for less shrillness
      // Shorter phrase (~1.2s) with clear rest before repeat
      // C major pentatonic scale - universally pleasant for young kids
      const melodyNotes = [
        { freq: 261.63, duration: 0.12 },  // C4 (one octave lower - warmer)
        { freq: 329.63, duration: 0.12 },  // E4
        { freq: 392.00, duration: 0.12 },  // G4
        { freq: 440.00, duration: 0.18 },  // A4 (held slightly longer)
        { freq: 392.00, duration: 0.12 },  // G4
        { freq: 329.63, duration: 0.25 },  // E4 (ending note, gentle resolution)
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
            
            // Main tone - triangle wave for softer, bell-like sound
            oscillator.frequency.value = note.freq;
            oscillator.type = "triangle";
            
            // Add subtle odd harmonic (3x) for brightness without harshness
            harmonic.frequency.value = note.freq * 3;
            harmonic.type = "sine";
            
            // GENTLE envelope: slower attack (0.04s) to avoid transients
            // Smooth exponential decay for natural bell-like sound
            gainNode.gain.setValueAtTime(0, noteStartTime);
            gainNode.gain.linearRampToValueAtTime(volume * 0.4, noteStartTime + 0.04);
            gainNode.gain.exponentialRampToValueAtTime(volume * 0.12, noteStartTime + note.duration * 0.5);
            gainNode.gain.exponentialRampToValueAtTime(0.001, noteStartTime + note.duration);
            
            // Harmonic envelope (quieter, faster decay for shimmer only)
            harmonicGain.gain.setValueAtTime(0, noteStartTime);
            harmonicGain.gain.linearRampToValueAtTime(volume * 0.08, noteStartTime + 0.04);
            harmonicGain.gain.exponentialRampToValueAtTime(0.001, noteStartTime + note.duration * 0.35);
            
            oscillator.start(noteStartTime);
            oscillator.stop(noteStartTime + note.duration + 0.1);
            harmonic.start(noteStartTime);
            harmonic.stop(noteStartTime + note.duration * 0.35);
            
            noteStartTime += note.duration + 0.03; // Small gap between notes
          } catch (error) {
            safeLog.error("❌ [AUDIO] Error playing note:", error);
          }
        });
      };

      // Play immediately
      playMelody();
      
      // Start vibration
      startVibration();
      
      // Repeat melody every 2.2 seconds (1.2s phrase + 1s rest)
      // This gives a clear "breath" before repeating - less continuous feel
      ringtoneIntervalRef.current = setInterval(() => {
        if (isPlayingRef.current.ringtone) {
          playMelody();
        }
      }, 2200);
      
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

  // Stop ringtone - ALWAYS attempt to stop regardless of tracking state
  // This ensures ringtone stops even if there's a state mismatch
  const stopRingtone = useCallback(() => {
    const wasPlaying = isPlayingRef.current.ringtone;
    isPlayingRef.current.ringtone = false;
    
    // CRITICAL: Set abort flag to prevent any pending playRingtone calls
    // This handles the race condition where playRingtone was called but is
    // still awaiting AudioContext (due to the 100ms retry delay)
    ringtoneAbortedRef.current = true;
    
    // Always clear interval if it exists
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    
    // Always stop vibration
    stopVibration();
    
    safeLog.log("🔇 [AUDIO] Ringtone stopped", { wasPlaying, abortedPending: true });
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

      // Soft "ding-dong" pattern - LOWER REGISTER (G4 -> E4) for warmth
      // Classic doorbell interval (minor third down) - universally recognized
      const waitingTone = [
        { freq: 392.00, duration: 0.3 },   // G4 (ding - warmer)
        { freq: 329.63, duration: 0.45 },  // E4 (dong - held longer)
      ];

      const playWaitingChime = () => {
        if (!isPlayingRef.current["outgoing-ringtone"] || !audioContextRef.current) return;
        
        let noteStartTime = audioContextRef.current.currentTime;
        
        waitingTone.forEach((note, index) => {
          if (!audioContextRef.current) return;
          
          try {
            // Create soft bell-like tone using triangle (consistent timbre with ringtone)
            const oscillator = audioContextRef.current.createOscillator();
            const harmonic = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();
            const harmonicGain = audioContextRef.current.createGain();
            
            oscillator.connect(gainNode);
            harmonic.connect(harmonicGain);
            gainNode.connect(audioContextRef.current.destination);
            harmonicGain.connect(audioContextRef.current.destination);
            
            // Triangle wave for consistency with other sounds
            oscillator.frequency.value = note.freq;
            oscillator.type = "triangle";
            
            // Subtle third harmonic for bell shimmer
            harmonic.frequency.value = note.freq * 3;
            harmonic.type = "sine";
            
            // VERY gentle envelope - slow attack (0.05s) for non-startling
            gainNode.gain.setValueAtTime(0, noteStartTime);
            gainNode.gain.linearRampToValueAtTime(volume * 0.3, noteStartTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(volume * 0.08, noteStartTime + note.duration * 0.4);
            gainNode.gain.exponentialRampToValueAtTime(0.001, noteStartTime + note.duration);
            
            // Harmonic envelope (very subtle shimmer)
            harmonicGain.gain.setValueAtTime(0, noteStartTime);
            harmonicGain.gain.linearRampToValueAtTime(volume * 0.05, noteStartTime + 0.05);
            harmonicGain.gain.exponentialRampToValueAtTime(0.001, noteStartTime + note.duration * 0.3);
            
            oscillator.start(noteStartTime);
            oscillator.stop(noteStartTime + note.duration + 0.1);
            harmonic.start(noteStartTime);
            harmonic.stop(noteStartTime + note.duration * 0.3);
            
            noteStartTime += note.duration + (index === 0 ? 0.1 : 0); // Clear gap after first note
          } catch (error) {
            safeLog.error("❌ [AUDIO] Error playing waiting tone:", error);
          }
        });
      };

      // Play immediately
      playWaitingChime();
      
      // Repeat every 2.8 seconds (~0.85s chime + 2s rest)
      // Longer rest between chimes for relaxed "waiting" feel
      outgoingRingtoneIntervalRef.current = setInterval(() => {
        if (isPlayingRef.current["outgoing-ringtone"]) {
          playWaitingChime();
        }
      }, 2800);
      
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

  // Play call ended sound - Soft descending contour (G4 -> E4 -> C4)
  // Same C major scale and register for consistent sound-world
  // Three notes for gentle "winding down" closure
  const playCallEnded = useCallback(async () => {
    if (!enabled) return;
    
    const audioContext = await ensureAudioContextReady();
    if (!audioContext) return;
    
    try {
      // Gentle descending: G4 -> E4 -> C4 (inverse of "answered" - closure contour)
      const endNotes = [392.00, 329.63, 261.63]; // G4, E4, C4
      
      endNotes.forEach((freq, index) => {
        const osc = audioContext.createOscillator();
        const harmonic = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const harmonicGain = audioContext.createGain();
        
        osc.connect(gain);
        harmonic.connect(harmonicGain);
        gain.connect(audioContext.destination);
        harmonicGain.connect(audioContext.destination);
        
        // Triangle wave - consistent timbre
        osc.frequency.value = freq;
        osc.type = "triangle";
        
        // Subtle harmonic for warmth
        harmonic.frequency.value = freq * 3;
        harmonic.type = "sine";
        
        const startTime = audioContext.currentTime + index * 0.18;
        const duration = index === 2 ? 0.4 : 0.2; // Last note slightly longer for resolution
        
        // Very gentle envelope - softer than other sounds (it's a goodbye)
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume * 0.28, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        harmonicGain.gain.setValueAtTime(0, startTime);
        harmonicGain.gain.linearRampToValueAtTime(volume * 0.05, startTime + 0.05);
        harmonicGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.35);
        
        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);
        harmonic.start(startTime);
        harmonic.stop(startTime + duration * 0.35);
      });
      
      safeLog.log("🔔 [AUDIO] Call ended sound played (gentle goodbye)");
    } catch (error) {
      safeLog.error("❌ [AUDIO] Error playing call ended sound:", error);
    }
  }, [enabled, volume, ensureAudioContextReady]);

  // Play call answered sound - Cheerful ascending major triad (C4-E4-G4)
  // Same register as ringtone for consistent "sound world"
  const playCallAnswered = useCallback(async () => {
    if (!enabled) return;
    
    const audioContext = await ensureAudioContextReady();
    if (!audioContext) return;
    
    try {
      // Happy ascending chime: C4 -> E4 -> G4 (major triad = universally happy!)
      // Lower register matches ringtone - kids will associate this sound-world with the app
      const chimeNotes = [261.63, 329.63, 392.00]; // C4, E4, G4
      
      chimeNotes.forEach((freq, index) => {
        const osc = audioContext.createOscillator();
        const harmonic = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const harmonicGain = audioContext.createGain();
        
        osc.connect(gain);
        harmonic.connect(harmonicGain);
        gain.connect(audioContext.destination);
        harmonicGain.connect(audioContext.destination);
        
        // Triangle wave - consistent with other sounds
        osc.frequency.value = freq;
        osc.type = "triangle";
        
        // Third harmonic for bell-like brightness
        harmonic.frequency.value = freq * 3;
        harmonic.type = "sine";
        
        const startTime = audioContext.currentTime + index * 0.14;
        const duration = index === 2 ? 0.5 : 0.18; // Last note rings longer (celebratory)
        
        // Gentle attack (0.04s) - non-startling positive cue
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        harmonicGain.gain.setValueAtTime(0, startTime);
        harmonicGain.gain.linearRampToValueAtTime(volume * 0.08, startTime + 0.04);
        harmonicGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.4);
        
        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);
        harmonic.start(startTime);
        harmonic.stop(startTime + duration * 0.4);
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


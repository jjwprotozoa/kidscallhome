// src/features/calls/hooks/usePictureInPicture.ts
// Picture-in-Picture (PiP) support for video calls
// Keeps the call visible and active when switching between apps

import { useEffect, useRef, useState, useCallback } from "react";
import { safeLog } from "@/utils/security";

export interface UsePictureInPictureReturn {
  isPictureInPictureActive: boolean;
  isPictureInPictureSupported: boolean;
  enterPictureInPicture: () => Promise<void>;
  exitPictureInPicture: () => Promise<void>;
  togglePictureInPicture: () => Promise<void>;
}

/**
 * Hook to manage Picture-in-Picture for video elements
 * This keeps the call visible and active when switching between apps
 */
export function usePictureInPicture(
  videoElementRef: React.RefObject<HTMLVideoElement>
): UsePictureInPictureReturn {
  const [isPictureInPictureActive, setIsPictureInPictureActive] = useState(false);
  const [isPictureInPictureSupported, setIsPictureInPictureSupported] = useState(false);
  const pipWindowRef = useRef<PictureInPictureWindow | null>(null);

  // Check if PiP is supported (works on desktop and mobile)
  useEffect(() => {
    const checkSupport = () => {
      if (videoElementRef.current) {
        const isSupported = 
          document.pictureInPictureEnabled !== false &&
          videoElementRef.current.requestPictureInPicture !== undefined;
        setIsPictureInPictureSupported(isSupported);
        
        if (isSupported) {
          safeLog.log("📺 [PiP] Picture-in-Picture is supported on this device");
        } else {
          safeLog.log("⚠️ [PiP] Picture-in-Picture is not supported on this device");
        }
      }
    };

    // Check immediately
    checkSupport();

    // Also check when video element becomes available
    const video = videoElementRef.current;
    if (video) {
      const handleLoadedMetadata = () => checkSupport();
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      return () => video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    }
    return undefined;
  }, [videoElementRef]);

  // Monitor PiP state changes
  useEffect(() => {
    if (!isPictureInPictureSupported) return;

    const handleEnterPiP = () => {
      setIsPictureInPictureActive(true);
      safeLog.log("📺 [PiP] Entered Picture-in-Picture mode");
    };

    const handleLeavePiP = () => {
      setIsPictureInPictureActive(false);
      pipWindowRef.current = null;
      safeLog.log("📺 [PiP] Exited Picture-in-Picture mode");
    };

    // Listen for PiP events
    document.addEventListener("enterpictureinpicture", handleEnterPiP);
    document.addEventListener("leavepictureinpicture", handleLeavePiP);

    // Check initial state
    if (document.pictureInPictureElement === videoElementRef.current) {
      setIsPictureInPictureActive(true);
    }

    return () => {
      document.removeEventListener("enterpictureinpicture", handleEnterPiP);
      document.removeEventListener("leavepictureinpicture", handleLeavePiP);
    };
  }, [isPictureInPictureSupported, videoElementRef]);

  // Enter Picture-in-Picture
  const enterPictureInPicture = useCallback(async () => {
    const video = videoElementRef.current;
    
    if (!video || !isPictureInPictureSupported) {
      safeLog.warn("⚠️ [PiP] Cannot enter PiP: not supported or video element not available");
      return;
    }

    // Ensure video is ready and playing before entering PiP
    // This is especially important on desktop where video might not be playing yet
    if (video.paused || video.readyState < 2) {
      safeLog.log("⏳ [PiP] Video not ready, waiting for video to be ready...");
      
      // Wait for video to be ready
      const waitForReady = () => {
        return new Promise<void>((resolve) => {
          if (video.readyState >= 2 && !video.paused) {
            resolve();
            return;
          }

          const onCanPlay = () => {
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("playing", onPlaying);
            if (!video.paused) {
              resolve();
            } else {
              // Try to play
              video.play().then(() => resolve()).catch(() => resolve());
            }
          };

          const onPlaying = () => {
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("playing", onPlaying);
            resolve();
          };

          video.addEventListener("canplay", onCanPlay);
          video.addEventListener("playing", onPlaying);

          // If video is paused, try to play it
          if (video.paused) {
            video.play().catch(() => {
              // If play fails, still try to enter PiP
              resolve();
            });
          }

          // Timeout after 2 seconds
          setTimeout(() => {
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("playing", onPlaying);
            resolve();
          }, 2000);
        });
      };

      await waitForReady();
    }

    try {
      // Request Picture-in-Picture
      // On desktop, this creates a floating window that stays on top
      // On mobile, this creates a PiP overlay
      const pipWindow = await video.requestPictureInPicture();
      pipWindowRef.current = pipWindow;
      setIsPictureInPictureActive(true);
      safeLog.log("✅ [PiP] Successfully entered Picture-in-Picture", {
        width: pipWindow.width,
        height: pipWindow.height,
      });
    } catch (error) {
      const err = error as Error;
      // Don't log errors for user cancellation
      if (
        !err.message.includes("user gesture") &&
        !err.message.includes("NotAllowedError") &&
        !err.message.includes("AbortError")
      ) {
        safeLog.warn("⚠️ [PiP] Failed to enter Picture-in-Picture:", err.message);
      }
    }
  }, [videoElementRef, isPictureInPictureSupported]);

  // Exit Picture-in-Picture
  const exitPictureInPicture = useCallback(async () => {
    if (!document.pictureInPictureElement) {
      return;
    }

    try {
      await document.exitPictureInPicture();
      setIsPictureInPictureActive(false);
      pipWindowRef.current = null;
      safeLog.log("✅ [PiP] Successfully exited Picture-in-Picture");
    } catch (error) {
      const err = error as Error;
      safeLog.warn("⚠️ [PiP] Failed to exit Picture-in-Picture:", err.message);
    }
  }, []);

  // Toggle Picture-in-Picture
  const togglePictureInPicture = useCallback(async () => {
    if (isPictureInPictureActive) {
      await exitPictureInPicture();
    } else {
      await enterPictureInPicture();
    }
  }, [isPictureInPictureActive, enterPictureInPicture, exitPictureInPicture]);

  return {
    isPictureInPictureActive,
    isPictureInPictureSupported,
    enterPictureInPicture,
    exitPictureInPicture,
    togglePictureInPicture,
  };
}


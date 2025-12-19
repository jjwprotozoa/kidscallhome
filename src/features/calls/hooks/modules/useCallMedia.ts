// src/features/calls/hooks/modules/useCallMedia.ts
// Media controls (mute, video toggle) for call engine

import { useCallback, useState } from "react";

export interface UseCallMediaReturn {
  isMuted: boolean;
  isVideoOff: boolean;
  toggleMute: () => void;
  toggleVideo: () => void;
}

export const useCallMedia = (
  localStream: MediaStream | null
): UseCallMediaReturn => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const toggleMute = useCallback(() => {
    console.log("🎤 [MEDIA CONTROLS] toggleMute called", {
      hasLocalStream: !!localStream,
      audioTracks: localStream?.getAudioTracks().length ?? 0,
    });

    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.warn("⚠️ [MEDIA CONTROLS] No audio tracks to toggle!");
        return;
      }

      // Use functional update to avoid stale closure issues
      setIsMuted((prevMuted) => {
        const newMutedState = !prevMuted;
        audioTracks.forEach((track) => {
          track.enabled = !newMutedState;
          console.log("🎤 [MEDIA CONTROLS] Audio track toggled:", {
            trackId: track.id,
            enabled: track.enabled,
            newMutedState,
            wasMuted: prevMuted,
          });
        });
        return newMutedState;
      });
    } else {
      console.warn("⚠️ [MEDIA CONTROLS] Cannot toggle mute - no local stream!");
    }
  }, [localStream]); // Removed isMuted from dependencies - using functional update instead

  const toggleVideo = useCallback(() => {
    console.log("📹 [MEDIA CONTROLS] toggleVideo called", {
      hasLocalStream: !!localStream,
      videoTracks: localStream?.getVideoTracks().length ?? 0,
    });

    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length === 0) {
        console.warn("⚠️ [MEDIA CONTROLS] No video tracks to toggle!");
        return;
      }

      // Use functional update to avoid stale closure issues
      setIsVideoOff((prevVideoOff) => {
        const newVideoOffState = !prevVideoOff;
        videoTracks.forEach((track) => {
          track.enabled = !newVideoOffState;
          console.log("📹 [MEDIA CONTROLS] Video track toggled:", {
            trackId: track.id,
            enabled: track.enabled,
            newVideoOffState,
            wasVideoOff: prevVideoOff,
          });
        });
        return newVideoOffState;
      });
    } else {
      console.warn(
        "⚠️ [MEDIA CONTROLS] Cannot toggle video - no local stream!"
      );
    }
  }, [localStream]); // Removed isVideoOff from dependencies - using functional update instead

  return {
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
  };
};


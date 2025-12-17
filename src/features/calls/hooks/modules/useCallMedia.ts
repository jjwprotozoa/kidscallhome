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
    if (localStream) {
      const newMutedState = !isMuted;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !newMutedState;
      });
      setIsMuted(newMutedState);
    }
  }, [localStream, isMuted]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const newVideoOffState = !isVideoOff;
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !newVideoOffState;
      });
      setIsVideoOff(newVideoOffState);
    }
  }, [localStream, isVideoOff]);

  return {
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
  };
};


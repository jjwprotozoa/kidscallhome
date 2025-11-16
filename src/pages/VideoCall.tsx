// src/pages/VideoCall.tsx
// Main video call page component - orchestrates video call UI and logic

import { VideoCallUI } from "@/features/calls/components/VideoCallUI";
import { useVideoCall } from "@/features/calls/hooks/useVideoCall";

const VideoCall = () => {
  const {
    localVideoRef,
    remoteVideoRef,
    remoteStream,
    isConnecting,
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
    endCall,
  } = useVideoCall();

  return (
    <VideoCallUI
      localVideoRef={localVideoRef}
      remoteVideoRef={remoteVideoRef}
      remoteStream={remoteStream}
      isConnecting={isConnecting}
      isMuted={isMuted}
      isVideoOff={isVideoOff}
      onToggleMute={toggleMute}
      onToggleVideo={toggleVideo}
      onEndCall={endCall}
    />
  );
};

export default VideoCall;

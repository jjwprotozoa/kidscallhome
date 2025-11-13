// src/components/call/VideoCallUI.tsx
// Video call UI layout component

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
  const handleVideoClick = () => {
    // User interaction - try to play video if it's not playing
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      if (remoteVideoRef.current.paused) {
        remoteVideoRef.current.play().catch((error) => {
          console.error("Error playing video on click:", error);
        });
      }
    }
  };

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
          onClick={handleVideoClick}
          style={{ backgroundColor: '#000' }}
          onLoadedMetadata={(e) => {
            // Video metadata loaded - try to play (user interaction should have happened by now)
            const video = e.currentTarget;
            console.log("📹 [VIDEO STREAM] Remote video metadata loaded:", {
              readyState: video.readyState,
              paused: video.paused,
              muted: video.muted,
              hasSrcObject: !!video.srcObject,
              timestamp: new Date().toISOString(),
            });
            if (video.srcObject) {
              video.play().catch((error) => {
                console.error("❌ [VIDEO STREAM] Error playing remote video on metadata load:", error);
                // If autoplay fails, it's likely because we need user interaction
                // The playRemoteVideo function will be called after user clicks answer
              });
            }
          }}
          onCanPlay={(e) => {
            // Video can play - try to play (user interaction should have happened by now)
            const video = e.currentTarget;
            console.log("📹 [VIDEO STREAM] Remote video can play:", {
              readyState: video.readyState,
              paused: video.paused,
              muted: video.muted,
              hasSrcObject: !!video.srcObject,
              timestamp: new Date().toISOString(),
            });
            if (video.srcObject) {
              video.play().catch((error) => {
                console.error("❌ [VIDEO STREAM] Error playing remote video on canplay:", error);
                // If autoplay fails, it's likely because we need user interaction
                // The playRemoteVideo function will be called after user clicks answer
              });
            }
          }}
          onPlay={() => {
            const video = remoteVideoRef.current;
            const stream = video?.srcObject as MediaStream | null;
            console.log("✅ [VIDEO STREAM] Remote video started playing", {
              timestamp: new Date().toISOString(),
              readyState: video?.readyState,
              paused: video?.paused,
              muted: video?.muted,
              volume: video?.volume,
              hasStream: !!stream,
              audioTracks: stream?.getAudioTracks().map(t => ({
                id: t.id,
                enabled: t.enabled,
                muted: t.muted,
                readyState: t.readyState,
              })),
              videoTracks: stream?.getVideoTracks().map(t => ({
                id: t.id,
                enabled: t.enabled,
                muted: t.muted,
                readyState: t.readyState,
              })),
            });
            
            // Check if tracks are muted
            if (stream) {
              stream.getAudioTracks().forEach(track => {
                if (track.muted) {
                  console.error("❌ [VIDEO STREAM] Audio track is muted in playing video!");
                }
              });
              stream.getVideoTracks().forEach(track => {
                if (track.muted) {
                  console.error("❌ [VIDEO STREAM] Video track is muted in playing video!");
                }
              });
            }
          }}
          onPause={() => {
            console.log("⏸️ [VIDEO STREAM] Remote video paused", {
              timestamp: new Date().toISOString(),
            });
          }}
          onError={(e) => {
            const video = e.currentTarget;
            console.error("❌ [VIDEO STREAM] Remote video error:", {
              error: video.error,
              errorCode: video.error?.code,
              errorMessage: video.error?.message,
              readyState: video.readyState,
              timestamp: new Date().toISOString(),
            });
          }}
        />

        {/* Connection status */}
        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center space-y-4">
              <div className="text-6xl">📞</div>
              <p className="text-white text-2xl">
                {isConnecting ? "Connecting..." : "Waiting for other person..."}
              </p>
            </div>
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
            onLoadedMetadata={(e) => {
              // Ensure local video plays when metadata is loaded
              const video = e.currentTarget;
              if (video.paused) {
                video.play().catch((error) => {
                  console.error("Error playing local video on metadata load:", error);
                });
              }
            }}
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


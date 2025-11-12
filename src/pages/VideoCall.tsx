import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";

const VideoCall = () => {
  const [isChild, setIsChild] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const childSession = localStorage.getItem("childSession");
    setIsChild(!!childSession);
    initializeMedia();

    return () => {
      cleanup();
    };
  }, []);

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      toast({
        title: "Camera/Mic Error",
        description: "Please allow camera and microphone access",
        variant: "destructive",
      });
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    cleanup();
    navigate(isChild ? "/child/dashboard" : "/parent/dashboard");
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  return (
    <div className="fixed inset-0 bg-black">
      <div className="relative h-full w-full">
        {/* Remote video (full screen) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
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
          />
        </div>

        {/* Controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
          <Button
            onClick={toggleMute}
            size="lg"
            variant={isMuted ? "destructive" : "secondary"}
            className="rounded-full w-16 h-16"
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>

          <Button
            onClick={toggleVideo}
            size="lg"
            variant={isVideoOff ? "destructive" : "secondary"}
            className="rounded-full w-16 h-16"
          >
            {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>

          <Button
            onClick={endCall}
            size="lg"
            variant="destructive"
            className="rounded-full w-16 h-16"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;

// src/components/call/CallControls.tsx
// Call control buttons component

import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";

interface CallControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

export const CallControls = ({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
}: CallControlsProps) => {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
      <Button
        onClick={onToggleMute}
        size="lg"
        variant={isMuted ? "destructive" : "secondary"}
        className="rounded-full w-16 h-16"
      >
        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </Button>

      <Button
        onClick={onToggleVideo}
        size="lg"
        variant={isVideoOff ? "destructive" : "secondary"}
        className="rounded-full w-16 h-16"
      >
        {isVideoOff ? (
          <VideoOff className="h-6 w-6" />
        ) : (
          <Video className="h-6 w-6" />
        )}
      </Button>

      <Button
        onClick={onEndCall}
        size="lg"
        variant="destructive"
        className="rounded-full w-16 h-16"
      >
        <PhoneOff className="h-6 w-6" />
      </Button>
    </div>
  );
};


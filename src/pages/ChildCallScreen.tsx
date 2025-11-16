// src/pages/ChildCallScreen.tsx
// Child Call Screen (parentId)

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VideoCallUI } from "@/features/calls/components/VideoCallUI";
import { useCallEngine } from "@/features/calls/hooks/useCallEngine";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone } from "lucide-react";

const ChildCallScreen = () => {
  const { parentId } = useParams<{ parentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [childId, setChildId] = useState<string | null>(null);
  const [parentName, setParentName] = useState<string>("Parent");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const initialize = async () => {
      // Get child ID from session
      const sessionData = localStorage.getItem("childSession");
      if (!sessionData) {
        navigate("/child/login");
        return;
      }
      const child = JSON.parse(sessionData);
      setChildId(child.id);

      // Get parent name
      if (parentId) {
        const { data: parent } = await supabase
          .from("parents")
          .select("name")
          .eq("id", parentId)
          .single();
        if (parent?.name) {
          setParentName(parent.name);
        }
      }
    };
    initialize();
  }, [parentId, navigate]);

  const callEngine = useCallEngine({
    role: "child",
    localProfileId: childId || "",
    remoteProfileId: parentId || "",
    localVideoRef,
    remoteVideoRef,
  });

  const handleStartCall = () => {
    if (callEngine.state === "idle" && childId && parentId) {
      callEngine.startOutgoingCall(parentId).catch((error) => {
        console.error("Failed to start call:", error);
        toast({
          title: "Call Failed",
          description: "Failed to start call",
          variant: "destructive",
        });
      });
    }
  };

  // Handle ended state redirect
  useEffect(() => {
    if (callEngine.state === "ended") {
      // Redirect handled by useCallEngine hook
    }
  }, [callEngine.state]);

  if (!childId || !parentId) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  // Show call UI based on state
  if (callEngine.state === "idle") {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Card className="p-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold">Call {parentName}</h2>
            <Button onClick={handleStartCall} size="lg">
              <Phone className="mr-2 h-5 w-5" />
              Start Call
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (callEngine.state === "calling") {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Card className="p-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold">Calling {parentName}...</h2>
            <p className="text-muted-foreground">Waiting for answer</p>
          </div>
        </Card>
      </div>
    );
  }

  if (callEngine.state === "incoming") {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Card className="p-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold">Incoming Call</h2>
            <p className="text-muted-foreground">From {parentName}</p>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() =>
                  callEngine.callId &&
                  callEngine.acceptIncomingCall(callEngine.callId)
                }
              >
                Accept
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  callEngine.callId &&
                  callEngine.rejectIncomingCall(callEngine.callId)
                }
              >
                Reject
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Show VideoCallUI for connecting and in_call states
  // connecting: local preview visible, remote showing "Connecting..."
  // in_call: both streams visible
  return (
    <VideoCallUI
      localVideoRef={localVideoRef}
      remoteVideoRef={remoteVideoRef}
      remoteStream={callEngine.remoteStream}
      isConnecting={callEngine.state === "calling" || callEngine.state === "connecting"}
      isMuted={callEngine.isMuted}
      isVideoOff={callEngine.isVideoOff}
      onToggleMute={callEngine.toggleMute}
      onToggleVideo={callEngine.toggleVideo}
      onEndCall={callEngine.endCall}
    />
  );
};

export default ChildCallScreen;


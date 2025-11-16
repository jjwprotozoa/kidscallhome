// src/pages/ParentCallScreen.tsx
// Parent Call Screen (childId)

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VideoCallUI } from "@/features/calls/components/VideoCallUI";
import { useCallEngine } from "@/features/calls/hooks/useCallEngine";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone } from "lucide-react";

const ParentCallScreen = () => {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [parentId, setParentId] = useState<string | null>(null);
  const [childName, setChildName] = useState<string>("");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const initialize = async () => {
      // Get parent ID from auth session
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/parent/auth");
        return;
      }
      setParentId(user.id);

      // Get child name
      if (childId) {
        const { data: child } = await supabase
          .from("children")
          .select("name")
          .eq("id", childId)
          .single();
        if (child) {
          setChildName(child.name);
        }
      }
    };
    initialize();
  }, [childId, navigate]);

  const callEngine = useCallEngine({
    role: "parent",
    localProfileId: parentId || "",
    remoteProfileId: childId || "",
    localVideoRef,
    remoteVideoRef,
  });

  const handleStartCall = () => {
    if (callEngine.state === "idle" && parentId && childId) {
      callEngine.startOutgoingCall(childId).catch((error) => {
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

  if (!parentId || !childId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  // Show call UI based on state
  if (callEngine.state === "idle") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold">Call {childName}</h2>
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold">Calling {childName}...</h2>
            <p className="text-muted-foreground">Waiting for answer</p>
          </div>
        </Card>
      </div>
    );
  }

  if (callEngine.state === "incoming") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold">Incoming Call</h2>
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

export default ParentCallScreen;


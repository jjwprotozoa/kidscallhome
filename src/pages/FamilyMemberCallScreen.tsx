// src/pages/FamilyMemberCallScreen.tsx
// Family Member Call Screen (childId)

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VideoCallUI } from "@/features/calls/components/VideoCallUI";
import { useCallEngine } from "@/features/calls/hooks/useCallEngine";
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const FamilyMemberCallScreen = () => {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [childName, setChildName] = useState<string>("");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const initialize = async () => {
      // Get family member ID from auth session
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/family-member/auth");
        return;
      }
      setFamilyMemberId(user.id);

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

  const { stopIncomingCall } = useIncomingCallNotifications();
  const callEngine = useCallEngine({
    role: "family_member",
    localProfileId: familyMemberId || "",
    remoteProfileId: childId || "",
    localVideoRef,
    remoteVideoRef,
  });

  // Automatically start call when component mounts
  useEffect(() => {
    if (callEngine.state === "idle" && familyMemberId && childId) {
      callEngine.startOutgoingCall(childId).catch((error) => {
        console.error("Failed to start call:", error);
        toast({
          title: "Call Failed",
          description: "Failed to start call",
          variant: "destructive",
        });
      });
    }
  }, [callEngine.state, familyMemberId, childId, callEngine, toast]);

  // Handle ended state redirect
  useEffect(() => {
    if (callEngine.state === "ended") {
      // Redirect handled by useCallEngine hook
    }
  }, [callEngine.state]);

  if (!familyMemberId || !childId) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (callEngine.state === "calling") {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
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
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Card className="p-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold">Incoming Call</h2>
            <p className="text-muted-foreground">From {childName}</p>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => {
                  if (callEngine.callId) {
                    stopIncomingCall(callEngine.callId);
                    callEngine.acceptIncomingCall(callEngine.callId);
                  }
                }}
              >
                Accept
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (callEngine.callId) {
                    stopIncomingCall(callEngine.callId);
                    callEngine.rejectIncomingCall(callEngine.callId);
                  }
                }}
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

export default FamilyMemberCallScreen;


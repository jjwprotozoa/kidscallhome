// src/pages/ParentCallScreen.tsx
// Parent Call Screen (childId)

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VideoCallUI } from "@/features/calls/components/VideoCallUI";
import { OutgoingCallUI } from "@/features/calls/components/OutgoingCallUI";
import { IncomingCallUI } from "@/components/GlobalIncomingCall/IncomingCallUI";
import { useCallEngine } from "@/features/calls/hooks/useCallEngine";
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { setUserStartedCall } from "@/utils/userInteraction";
import { useFamilyMemberRedirect } from "@/hooks/useFamilyMemberRedirect";

const ParentCallScreen = () => {
  // Redirect family members away from parent routes
  useFamilyMemberRedirect();
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [parentId, setParentId] = useState<string | null>(null);
  const [childName, setChildName] = useState<string>("");
  const [childAvatarColor, setChildAvatarColor] = useState<string>("#3B82F6");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const isAnsweringRef = useRef(false);
  // Track if call failed to prevent infinite retry loop
  const [callFailed, setCallFailed] = useState(false);
  // Track if call was started to prevent re-triggering
  const callStartedRef = useRef(false);

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

      // Get child name and avatar color
      if (childId) {
        const { data: child } = await supabase
          .from("children")
          .select("name, avatar_color")
          .eq("id", childId)
          .single();
        if (child) {
          setChildName(child.name);
          if (child.avatar_color) {
            setChildAvatarColor(child.avatar_color);
          }
        }
      }
    };
    initialize();
  }, [childId, navigate]);

  const { stopIncomingCall } = useIncomingCallNotifications();
  const callEngine = useCallEngine({
    role: "parent",
    localProfileId: parentId || "",
    remoteProfileId: childId || "",
    localVideoRef,
    remoteVideoRef,
  });

  // Automatically start call when component mounts (no extra "Start Call" step)
  useEffect(() => {
    // Prevent re-triggering if already started or if previous attempt failed
    if (callStartedRef.current || callFailed) {
      return;
    }
    
    if (callEngine.state === "idle" && parentId && childId) {
      callStartedRef.current = true;
      // CRITICAL: User navigated to call screen - enable audio
      setUserStartedCall();
      
      callEngine.startOutgoingCall(childId).catch((error) => {
        console.error("Failed to start call:", error);
        setCallFailed(true);
        toast({
          title: "Call Failed",
          description: error instanceof Error ? error.message : "Failed to start call. Please check camera/microphone permissions.",
          variant: "destructive",
        });
      });
    }
  }, [callEngine.state, parentId, childId, callEngine, callFailed, toast]);

  // Handle ended state redirect
  useEffect(() => {
    if (callEngine.state === "ended") {
      // Redirect handled by useCallEngine hook
    }
  }, [callEngine.state]);

  if (!parentId || !childId) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  // Show error state with back button when call failed
  if (callFailed) {
    return (
      <div className="fixed inset-0 z-[100] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-xl shadow-red-500/30">
            <span className="text-5xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Call Failed</h1>
          <p className="text-white/60 max-w-sm">
            Unable to access camera or microphone. Please check your permissions and try again.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full max-w-sm py-4 px-8 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3 transition-all duration-200 active:scale-95 hover:scale-[1.02]"
          >
            <span className="text-xl font-semibold">Go Back</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCallFailed(false);
              callStartedRef.current = false;
            }}
            className="text-white/50 hover:text-white/80 text-sm underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (callEngine.state === "calling") {
    return (
      <OutgoingCallUI
        calleeName={childName || "Child"}
        calleeAvatarColor={childAvatarColor}
        onEndCall={() => {
          callEngine.endCall().catch((error) => {
            console.error("Failed to end call:", error);
            toast({
              title: "Error",
              description: "Failed to end call",
              variant: "destructive",
            });
          });
        }}
      />
    );
  }

  if (callEngine.state === "incoming") {
    return (
      <IncomingCallUI
        incomingCall={{
          id: callEngine.callId || "",
          child_id: childId || "",
          child_name: childName,
          child_avatar_color: childAvatarColor,
        }}
        isAnsweringRef={isAnsweringRef}
        onAnswer={() => {
          if (callEngine.callId) {
            // CRITICAL: User clicked Accept - enable audio
            setUserStartedCall();
            // CRITICAL: Stop incoming call ringtone immediately when Accept is clicked
            stopIncomingCall(callEngine.callId);
            callEngine.acceptIncomingCall(callEngine.callId);
          }
        }}
        onDecline={() => {
          if (callEngine.callId) {
            // CRITICAL: Stop incoming call ringtone immediately when Reject is clicked
            stopIncomingCall(callEngine.callId);
            callEngine.rejectIncomingCall(callEngine.callId);
          }
        }}
      />
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
      localStream={callEngine.localStream}
      isConnecting={callEngine.state === "calling" || callEngine.state === "connecting"}
      isMuted={callEngine.isMuted}
      isVideoOff={callEngine.isVideoOff}
      onToggleMute={callEngine.toggleMute}
      onToggleVideo={callEngine.toggleVideo}
      onEndCall={callEngine.endCall}
      networkQuality={callEngine.networkQuality}
    />
  );
};

export default ParentCallScreen;


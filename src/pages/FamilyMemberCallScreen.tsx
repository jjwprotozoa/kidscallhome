// src/pages/FamilyMemberCallScreen.tsx
// Family Member Call Screen (childId)

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { VideoCallUI } from "@/features/calls/components/VideoCallUI";
import { OutgoingCallUI } from "@/features/calls/components/OutgoingCallUI";
import { useCallEngine } from "@/features/calls/hooks/useCallEngine";
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { setUserStartedCall } from "@/utils/userInteraction";

const FamilyMemberCallScreen = () => {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [familyMemberId, setFamilyMemberId] = useState<string | null>(null);
  const [childName, setChildName] = useState<string>("");
  const [childAvatarColor, setChildAvatarColor] = useState<string>("#8B5CF6");
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

      // Get child name and avatar color - try children table first, then child_profiles
      if (childId) {
        let foundChildName: string | null = null;
        let foundAvatarColor: string | null = null;
        
        // Try children table (legacy)
        const { data: child } = await supabase
          .from("children")
          .select("name, avatar_color")
          .eq("id", childId)
          .maybeSingle();
        
        if (child?.name) {
          foundChildName = child.name;
          foundAvatarColor = child.avatar_color;
        } else {
          // Fallback to child_profiles
          const { data: childProfile } = await supabase
            .from("child_profiles")
            .select("name")
            .eq("id", childId)
            .maybeSingle();
          
          if (childProfile?.name) {
            foundChildName = childProfile.name;
          }
        }
        
        if (foundChildName) {
          setChildName(foundChildName);
        }
        if (foundAvatarColor) {
          setChildAvatarColor(foundAvatarColor);
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

  const autoAcceptAttemptedRef = useRef<string | null>(null);
  const [searchParams] = useSearchParams();

  // Auto-accept incoming call when navigating with callId in URL
  // This handles both cases: state is "incoming" or state is "idle" (will transition to "incoming" first)
  useEffect(() => {
    const urlCallId = searchParams.get("callId");
    if (!urlCallId || !familyMemberId || !childId) return;

    // Prevent duplicate acceptance attempts
    if (autoAcceptAttemptedRef.current === urlCallId) {
      return;
    }

    // Only auto-accept when state becomes "incoming" - wait for useCallEngine to detect the call first
    // This prevents the "not a valid incoming call" error when localProfileId is empty
    if (callEngine.state === "incoming" && callEngine.callId === urlCallId) {
      console.log("📞 [FAMILY MEMBER CALL SCREEN] Auto-accepting incoming call from URL:", {
        urlCallId,
        state: callEngine.state,
        callId: callEngine.callId,
      });
      
      // CRITICAL: Mark user as having started the call (enables audio)
      setUserStartedCall();
      
      autoAcceptAttemptedRef.current = urlCallId;
      stopIncomingCall(urlCallId);
      
      // Accept the call - state is already "incoming" so this should work
      callEngine.acceptIncomingCall(urlCallId).catch((error) => {
        console.error("Failed to accept call:", error);
        // Reset ref on error so we can retry
        autoAcceptAttemptedRef.current = null;
        toast({
          title: "Call Failed",
          description: "Failed to accept call",
          variant: "destructive",
        });
      });
    }
  }, [callEngine.state, callEngine.callId, familyMemberId, childId, callEngine, stopIncomingCall, toast]);

  // Automatically start call when component mounts (only if not answering incoming call)
  useEffect(() => {
    const urlCallId = searchParams.get("callId");
    const isAnsweringIncomingCall = !!urlCallId;
    
    // Don't auto-start if answering an incoming call - let useCallEngine handle it
    if (!isAnsweringIncomingCall && callEngine.state === "idle" && familyMemberId && childId) {
      // CRITICAL: User navigated to call screen - enable audio
      setUserStartedCall();
      
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

  // Handle ended state redirect - IMMEDIATE redirect (no delay)
  useEffect(() => {
    if (callEngine.state === "ended") {
      // Redirect immediately to avoid showing calling screen
      navigate("/family-member/dashboard", { replace: true });
    }
  }, [callEngine.state, navigate]);

  if (!familyMemberId || !childId) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  // Don't render calling screen if state is ended (redirect will happen)
  if (callEngine.state === "ended") {
    return null; // Redirect is happening
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

  // Don't show incoming call UI here - GlobalIncomingCall handles it
  // This prevents double "Accept" buttons
  // The auto-accept logic will handle accepting when navigating with callId

  // Show VideoCallUI for connecting and in_call states
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

export default FamilyMemberCallScreen;


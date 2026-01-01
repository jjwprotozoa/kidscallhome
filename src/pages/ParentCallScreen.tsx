// src/pages/ParentCallScreen.tsx
// Parent Call Screen (childId)

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { VideoCallUI } from "@/features/calls/components/VideoCallUI";
import { OutgoingCallUI } from "@/features/calls/components/OutgoingCallUI";
import { useCallEngine } from "@/features/calls/hooks/useCallEngine";
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { setUserStartedCall } from "@/utils/userInteraction";
import { useFamilyMemberRedirect } from "@/hooks/useFamilyMemberRedirect";
import {
  trackCallStarted,
  trackCallCompleted,
  trackCallFailed,
} from "@/utils/analytics";

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
  // Track if call failed to prevent infinite retry loop
  const [callFailed, setCallFailed] = useState(false);
  // Track if call was started to prevent re-triggering
  const callStartedRef = useRef(false);
  // Track call start time for duration analytics
  const callStartTimeRef = useRef<number | null>(null);

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

  const autoAcceptAttemptedRef = useRef<string | null>(null);
  const [searchParams] = useSearchParams();

  // Auto-accept incoming call when navigating with callId in URL
  // This handles both cases: state is "incoming" or state is "idle" (will transition to "incoming" first)
  useEffect(() => {
    const urlCallId = searchParams.get("callId");
    if (!urlCallId || !parentId || !childId) {
      if (urlCallId) {
        console.log("📞 [PARENT CALL SCREEN] Waiting for parentId/childId:", {
          urlCallId,
          hasParentId: !!parentId,
          hasChildId: !!childId,
        });
      }
      return;
    }

    // Prevent duplicate acceptance attempts
    if (autoAcceptAttemptedRef.current === urlCallId) {
      console.log("📞 [PARENT CALL SCREEN] Already attempted to accept:", urlCallId);
      return;
    }

    // Log state transitions to help debug iPhone issues
    console.log("📞 [PARENT CALL SCREEN] Monitoring for auto-accept:", {
      urlCallId,
      currentState: callEngine.state,
      currentCallId: callEngine.callId,
      waitingForIncoming: callEngine.state !== "incoming" || callEngine.callId !== urlCallId,
    });

    // Only auto-accept when state becomes "incoming" - wait for useCallEngine to detect the call first
    // This prevents the "not a valid incoming call" error when localProfileId is empty
    if (callEngine.state === "incoming" && callEngine.callId === urlCallId) {
      console.log("📞 [PARENT CALL SCREEN] Auto-accepting incoming call from URL:", {
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
  }, [callEngine.state, callEngine.callId, parentId, childId, callEngine, stopIncomingCall, toast]);

  // Automatically start call when component mounts (only if not answering incoming call)
  useEffect(() => {
    // Check if we're answering an incoming call (has callId in URL)
    const urlCallId = searchParams.get("callId");
    if (urlCallId) {
      // Don't start outgoing call if we're answering an incoming call
      return;
    }

    // Prevent re-triggering if already started or if previous attempt failed
    if (callStartedRef.current || callFailed) {
      return;
    }
    
    if (callEngine.state === "idle" && parentId && childId) {
      callStartedRef.current = true;
      // CRITICAL: User navigated to call screen - enable audio
      setUserStartedCall();
      
      // Track analytics: call started
      trackCallStarted("video", "parent");
      callStartTimeRef.current = Date.now();
      
      callEngine.startOutgoingCall(childId).catch((error) => {
        console.error("Failed to start call:", error);
        setCallFailed(true);
        // Track analytics: call failed
        trackCallFailed(error instanceof Error ? error.message : "unknown_error", "video");
        toast({
          title: "Call Failed",
          description: error instanceof Error ? error.message : "Failed to start call. Please check camera/microphone permissions.",
          variant: "destructive",
        });
      });
    }
  }, [callEngine.state, parentId, childId, callEngine, callFailed, toast, searchParams]);

  // Handle ended state redirect and track call completion
  useEffect(() => {
    if (callEngine.state === "ended") {
      // Track analytics: call completed
      if (callStartTimeRef.current) {
        const durationSeconds = Math.round((Date.now() - callStartTimeRef.current) / 1000);
        trackCallCompleted(durationSeconds, "video");
        callStartTimeRef.current = null;
      }
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

  // Don't render ended state - redirect will happen
  if (callEngine.state === "ended") {
    return null;
  }

  // Don't show incoming call UI here - IncomingCallDialog on dashboard handles it
  // This prevents double "Accept" buttons and matches ChildCallScreen behavior
  // The auto-accept logic will handle accepting when navigating with callId

  // Show VideoCallUI for incoming, connecting, and in_call states
  // incoming/connecting: local preview visible, remote showing "Connecting..."
  // in_call: both streams visible
  return (
    <VideoCallUI
      localVideoRef={localVideoRef}
      remoteVideoRef={remoteVideoRef}
      remoteStream={callEngine.remoteStream}
      localStream={callEngine.localStream}
      isConnecting={callEngine.state === "calling" || callEngine.state === "connecting" || callEngine.state === "incoming"}
      isMuted={callEngine.isMuted}
      isVideoOff={callEngine.isVideoOff}
      onToggleMute={callEngine.toggleMute}
      onToggleVideo={callEngine.toggleVideo}
      onEndCall={callEngine.endCall}
      networkQuality={callEngine.networkQuality}
      batteryStatus={callEngine.batteryStatus}
    />
  );
};

export default ParentCallScreen;


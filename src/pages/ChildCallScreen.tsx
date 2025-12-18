// src/pages/ChildCallScreen.tsx
// Child Call Screen (parentId)

import { ChildOutgoingCallUI } from "@/features/calls/components/ChildOutgoingCallUI";
import { VideoCallUI } from "@/features/calls/components/VideoCallUI";
import { useCallEngine } from "@/features/calls/hooks/useCallEngine";
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { setUserStartedCall } from "@/utils/userInteraction";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

const ChildCallScreen = () => {
  const { parentId } = useParams<{ parentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [childId, setChildId] = useState<string | null>(null);
  const [parentName, setParentName] = useState<string>("Parent");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const autoAcceptAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Get child ID from session using the proper helper function
        const { getChildSessionLegacy } = await import("@/lib/childSession");
        const childData = getChildSessionLegacy();

        if (!childData || !childData.id) {
          console.error("❌ [CHILD CALL SCREEN] No valid child session found");
          navigate("/child/login");
          return;
        }

        console.warn("✅ [CHILD CALL SCREEN] Child session loaded:", {
          childId: childData.id,
        });
        setChildId(childData.id);

        // Get parent/family member name
        if (parentId) {
          console.warn("🔍 [CHILD CALL SCREEN] Fetching name for:", parentId);

          // Check if it's a family member or parent
          const participantType = localStorage.getItem(
            "selectedParticipantType"
          ) as "parent" | "family_member" | null;

          if (participantType === "family_member") {
            // Try to get family member name from adult_profiles
            // adult_profiles table exists but is not in generated Supabase types
            const { data: adultProfile, error: profileError } =
              (await // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (supabase as any)
                .from("adult_profiles")
                .select("name")
                .eq("user_id", parentId)
                .eq("role", "family_member")
                .maybeSingle()) as {
                data: { name: string } | null;
                error: unknown;
              };

            if (!profileError && adultProfile?.name) {
              setParentName(adultProfile.name);
              console.warn(
                "✅ [CHILD CALL SCREEN] Family member name loaded:",
                adultProfile.name
              );
            } else {
              // Fallback: try family_members table
              const { data: familyMember, error: fmError } = await supabase
                .from("family_members")
                .select("name")
                .eq("id", parentId)
                .maybeSingle();

              if (!fmError && familyMember?.name) {
                setParentName(familyMember.name);
                console.warn(
                  "✅ [CHILD CALL SCREEN] Family member name loaded:",
                  familyMember.name
                );
              } else {
                setParentName("Family Member");
                console.warn(
                  "⚠️ [CHILD CALL SCREEN] Could not fetch family member name, using fallback"
                );
              }
            }
          } else {
            // Try parent first
            const { data: parent, error: parentError } = await supabase
              .from("parents")
              .select("name")
              .eq("id", parentId)
              .maybeSingle();

            if (!parentError && parent?.name) {
              setParentName(parent.name);
              console.warn(
                "✅ [CHILD CALL SCREEN] Parent name loaded:",
                parent.name
              );
            } else {
              // Fallback: try adult_profiles
              // adult_profiles table exists but is not in generated Supabase types
              const { data: adultProfile, error: profileError } =
                (await // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (supabase as any)
                  .from("adult_profiles")
                  .select("name")
                  .eq("user_id", parentId)
                  .eq("role", "parent")
                  .maybeSingle()) as {
                  data: { name: string } | null;
                  error: unknown;
                };

              if (!profileError && adultProfile?.name) {
                setParentName(adultProfile.name);
                console.warn(
                  "✅ [CHILD CALL SCREEN] Parent name loaded from adult_profiles:",
                  adultProfile.name
                );
              } else {
                setParentName("Parent");
                console.warn(
                  "⚠️ [CHILD CALL SCREEN] Could not fetch parent name, using fallback"
                );
              }
            }
          }
        } else {
          console.warn("⚠️ [CHILD CALL SCREEN] No parentId in URL params");
        }
      } catch (error) {
        console.error("❌ [CHILD CALL SCREEN] Error initializing:", error);
        navigate("/child/login");
      }
    };
    initialize();
  }, [parentId, navigate]);

  const { stopIncomingCall } = useIncomingCallNotifications();

  // CRITICAL: Determine if we're calling a parent or family member
  const participantType = localStorage.getItem("selectedParticipantType") as
    | "parent"
    | "family_member"
    | null;
  const actualRecipientId = parentId || "";

  // CRITICAL: Verify the stored participantId matches the URL param
  // If they don't match, use the URL param (it's the source of truth)
  const storedParticipantId = localStorage.getItem("selectedParentId");
  if (storedParticipantId && storedParticipantId !== parentId) {
    console.warn(
      "⚠️ [CHILD CALL SCREEN] Mismatch between stored and URL participantId:",
      {
        storedParticipantId,
        urlParentId: parentId,
        usingUrlParam: true,
      }
    );
    // Update localStorage to match URL (URL is source of truth)
    localStorage.setItem("selectedParentId", parentId || "");
  }

  console.warn("🔍 [CHILD CALL SCREEN] Call initialization:", {
    childId,
    parentId: actualRecipientId,
    participantType,
    routeParam: parentId,
    storedParticipantId: localStorage.getItem("selectedParentId"),
    storedType: localStorage.getItem("selectedParticipantType"),
    usingRecipientId: actualRecipientId,
  });

  const callEngine = useCallEngine({
    role: "child",
    localProfileId: childId || "",
    remoteProfileId: actualRecipientId,
    localVideoRef,
    remoteVideoRef,
  });

  // Auto-accept incoming call when navigating with callId in URL
  // This handles both cases: state is "incoming" or state is "idle" (will transition to "incoming" first)
  useEffect(() => {
    const urlCallId = searchParams.get("callId");
    if (!urlCallId || !childId) return;

    // Prevent duplicate acceptance attempts
    if (autoAcceptAttemptedRef.current === urlCallId) {
      return;
    }

    // Only auto-accept when state becomes "incoming" - wait for useCallEngine to detect the call first
    // This prevents the "not a valid incoming call" error when localProfileId is empty
    if (callEngine.state === "incoming" && callEngine.callId === urlCallId) {
      console.warn(
        "📞 [CHILD CALL SCREEN] Auto-accepting incoming call from URL:",
        {
          urlCallId,
          state: callEngine.state,
          callId: callEngine.callId,
        }
      );

      // CRITICAL: Mark user as having started the call (enables audio)
      // This is called when accepting via URL navigation from GlobalIncomingCall
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
  }, [
    callEngine.state,
    callEngine.callId,
    searchParams,
    childId,
    callEngine,
    stopIncomingCall,
    toast,
  ]);

  // Track the last parentId we called to detect changes
  const lastCalledParentIdRef = useRef<string | null>(null);

  // Only auto-start outgoing call if there's no callId query param (not answering incoming call)
  useEffect(() => {
    const urlCallId = searchParams.get("callId");
    const isAnsweringIncomingCall = !!urlCallId;

    // CRITICAL: If parentId changed, we need to end any existing call first
    if (
      lastCalledParentIdRef.current !== null &&
      lastCalledParentIdRef.current !== parentId &&
      callEngine.state !== "idle" &&
      callEngine.state !== "ended"
    ) {
      console.warn(
        "📞 [CHILD CALL SCREEN] ParentId changed, ending previous call:",
        {
          previousParentId: lastCalledParentIdRef.current,
          newParentId: parentId,
          currentState: callEngine.state,
        }
      );
      callEngine.endCall().catch((error) => {
        console.error("Failed to end previous call:", error);
      });
      // Reset the ref and wait for state to become idle
      lastCalledParentIdRef.current = null;
      return;
    }

    // Don't auto-start if answering an incoming call - let useCallEngine handle it
    if (
      !isAnsweringIncomingCall &&
      callEngine.state === "idle" &&
      childId &&
      parentId &&
      lastCalledParentIdRef.current !== parentId // Only start if this is a new call
    ) {
      console.warn("📞 [CHILD CALL SCREEN] Starting outgoing call:", {
        recipientId: parentId,
        recipientType: participantType,
        childId,
        timestamp: new Date().toISOString(),
      });

      // CRITICAL: User navigated to call screen (from dashboard call button) - enable audio
      // Note: setUserStartedCall is also called in ChildDashboard.handleCall, but we call it again
      // here to ensure it's set even if the user refreshes or navigates directly
      setUserStartedCall();

      // Update the ref to track this call
      lastCalledParentIdRef.current = parentId;

      callEngine.startOutgoingCall(parentId).catch((error) => {
        console.error("❌ [CHILD CALL SCREEN] Failed to start call:", error);
        // Reset ref on error so we can retry
        lastCalledParentIdRef.current = null;
        toast({
          title: "Call Failed",
          description: "Failed to start call",
          variant: "destructive",
        });
      });
    }
  }, [
    callEngine.state,
    childId,
    parentId,
    callEngine,
    searchParams,
    participantType,
    toast,
  ]);

  // Reset the ref when call ends
  useEffect(() => {
    if (callEngine.state === "ended") {
      lastCalledParentIdRef.current = null;
    }
  }, [callEngine.state]);

  // Handle ended state redirect - IMMEDIATE redirect (no delay)
  useEffect(() => {
    if (callEngine.state === "ended") {
      // Redirect immediately to avoid showing calling screen
      navigate("/child/dashboard", { replace: true });
    }
  }, [callEngine.state, navigate]);

  if (!childId || !parentId) {
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
      <ChildOutgoingCallUI
        calleeName={parentName || "Parent"}
        calleeAvatarColor="#8B5CF6" // Purple for parents/family members (kid-friendly)
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
  // connecting: local preview visible, remote showing "Connecting..."
  // in_call: both streams visible
  return (
    <VideoCallUI
      localVideoRef={localVideoRef}
      remoteVideoRef={remoteVideoRef}
      remoteStream={callEngine.remoteStream}
      localStream={callEngine.localStream}
      isConnecting={
        callEngine.state === "connecting" || callEngine.state === "incoming"
      }
      isMuted={callEngine.isMuted}
      isVideoOff={callEngine.isVideoOff}
      onToggleMute={callEngine.toggleMute}
      onToggleVideo={callEngine.toggleVideo}
      onEndCall={callEngine.endCall}
      networkQuality={callEngine.networkQuality}
    />
  );
};

export default ChildCallScreen;

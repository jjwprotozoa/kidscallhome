// src/pages/ChildDashboard/ChildDashboard.tsx
// Purpose: Main page orchestrator for child dashboard (max 250 lines)

import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { endCall as endCallUtil } from "@/features/calls/utils/callEnding";
import { stopAllActiveStreams } from "@/features/calls/utils/mediaCleanup";
import { useMissedBadgeForChild, useUnreadBadgeForChild } from "@/stores/badgeStore";
import Navigation from "@/components/Navigation";
import { OnboardingTour } from "@/features/onboarding/OnboardingTour";
import { HelpBubble } from "@/features/onboarding/HelpBubble";
import { usePresence } from "@/features/presence/usePresence";
import { useParentPresence } from "@/features/presence/useParentPresence";
import { useDashboardData } from "./useDashboardData";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardWidgets } from "./DashboardWidgets";
import { IncomingCallDialog } from "./IncomingCallDialog";
import { setUserStartedCall } from "@/utils/userInteraction";

const ChildDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isAnsweringRef = useRef(false);
  const { child, incomingCall, setIncomingCall, parentName, selectedParentId, stopIncomingCall } = useDashboardData();

  const missedCallCount = useMissedBadgeForChild(child?.id || null);
  const unreadMessageCount = useUnreadBadgeForChild(child?.id || null);

  usePresence({
    userId: child?.id || "",
    userType: "child",
    name: child?.name,
    enabled: !!child,
  });

  const { isOnline: isParentOnline } = useParentPresence({
    parentId: selectedParentId || child?.parent_id || "",
    enabled: !!(selectedParentId || child?.parent_id),
  });

  const handleCall = () => {
    if (child && selectedParentId) {
      // CRITICAL: User clicked Call - enable audio for the call
      setUserStartedCall();
      
      // Navigate IMMEDIATELY - don't wait for async operations
      navigate(`/child/call/${selectedParentId}`);
      
      // Acknowledge missed calls in background (don't block navigation)
      (async () => {
        try {
          const { acknowledgeMissedCalls } = await import("@/utils/acknowledgeMissedCalls");
          await acknowledgeMissedCalls(child.id, "parent");
        } catch (error) {
          console.error("Error acknowledging missed calls:", error);
        }
      })();
    } else if (!selectedParentId) {
      navigate("/child/parents");
    }
  };

  const handleChat = () => {
    if (child && selectedParentId) {
      navigate(`/chat/${child.id}`);
    } else if (!selectedParentId) {
      navigate("/child/parents");
    }
  };

  const handleAnswerCall = () => {
    if (incomingCall && child && incomingCall.parent_id) {
      // CRITICAL: User clicked Accept - enable audio for the call
      setUserStartedCall();
      
      stopIncomingCall(incomingCall.id);
      isAnsweringRef.current = true;
      const callId = incomingCall.id;
      setIncomingCall(null);
      // Navigate to child call screen with parentId (not childId)
      navigate(`/child/call/${incomingCall.parent_id}?callId=${callId}`);
      setTimeout(() => {
        isAnsweringRef.current = false;
      }, 2000);
    }
  };

  const handleDeclineCall = async () => {
    // CRITICAL: Don't block decline if answer was attempted - user should always be able to decline
    if (incomingCall) {
      try {
        await endCallUtil({
          callId: incomingCall.id,
          by: "child",
          reason: "declined",
        });
      } catch (error: unknown) {
        console.error("❌ [USER ACTION] Error declining call:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        toast({
          title: "Error",
          description: "Failed to decline call: " + errorMessage,
          variant: "destructive",
        });
      }
      // CRITICAL: Safety measure - stop any active media streams
      stopAllActiveStreams();
      
      stopIncomingCall(incomingCall.id);
      setIncomingCall(null);
      isAnsweringRef.current = false; // Reset in case it was stuck
    }
  };

  if (!child) return null;

  return (
    <div className="min-h-[100dvh] bg-primary/5">
      <Navigation />
      <OnboardingTour role="child" pageKey="child_dashboard" />
      <HelpBubble role="child" pageKey="child_dashboard" />
      <div className="p-4" style={{ paddingTop: 'calc(1rem + 64px + var(--safe-area-inset-top) * 0.15)' }}>
        <div className="max-w-2xl mx-auto space-y-6">
          <DashboardHeader
            child={child}
            parentName={parentName}
            selectedParentId={selectedParentId}
            isParentOnline={isParentOnline}
          />

          <DashboardWidgets
            child={child}
            parentName={parentName}
            selectedParentId={selectedParentId}
            isParentOnline={isParentOnline}
            missedCallCount={missedCallCount}
            unreadMessageCount={unreadMessageCount}
            onCall={handleCall}
            onChat={handleChat}
            onSelectParent={() => navigate("/child/parents")}
          />
        </div>
      </div>

      <IncomingCallDialog
        incomingCall={incomingCall}
        child={child}
        parentName={parentName}
        isAnsweringRef={isAnsweringRef}
        onAnswer={handleAnswerCall}
        onDecline={handleDeclineCall}
      />
    </div>
  );
};

export default ChildDashboard;









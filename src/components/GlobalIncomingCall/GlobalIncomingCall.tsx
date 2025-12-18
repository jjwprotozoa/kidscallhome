// src/components/GlobalIncomingCall/GlobalIncomingCall.tsx
// Purpose: Main orchestrator component for global incoming calls (max 250 lines)
// CRITICAL: Preserves all WebRTC functionality - do not modify call handling logic

import { useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { endCall as endCallUtil } from "@/features/calls/utils/callEnding";
import { stopAllActiveStreams } from "@/features/calls/utils/mediaCleanup";
import { AndroidIncomingCall } from "@/components/native/AndroidIncomingCall";
import { isNativeAndroid } from "@/utils/nativeAndroid";
import { useIncomingCallState } from "./useIncomingCallState";
import { IncomingCallUI } from "./IncomingCallUI";
import { ChildIncomingCallUI } from "./ChildIncomingCallUI";
import { IncomingCall } from "./types";
import { setUserStartedCall } from "@/utils/userInteraction";

export const GlobalIncomingCall = () => {
  const { incomingCall, setIncomingCall, stopIncomingCall } = useIncomingCallState();
  const isAnsweringRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleAnswerCall = async () => {
    if (incomingCall && !isAnsweringRef.current) {
      // CRITICAL: User clicked Accept - enable audio for the call
      setUserStartedCall();
      
      // Prevent double-clicks
      isAnsweringRef.current = true;
      
      try {
        stopIncomingCall(incomingCall.id);
        const callId = incomingCall.id;
        
        // Determine user role to route correctly
        const { data: { session } } = await supabase.auth.getSession();
        const childSession = localStorage.getItem("childSession");
        const isChild = !session && !!childSession;
        
        let isFamilyMember = false;
        if (session?.user?.id) {
          try {
            const { getUserRole } = await import("@/utils/userRole");
            const userRole = await getUserRole(session.user.id);
            isFamilyMember = userRole === "family_member";
            console.log("🔍 [GLOBAL INCOMING CALL] User role detection:", {
              userId: session.user.id,
              userRole,
              isFamilyMember,
            });
          } catch (roleError) {
            console.error("Error getting user role, defaulting to parent:", roleError);
            // Default to parent if role check fails
            isFamilyMember = false;
          }
        }
        
        console.log("🔍 [GLOBAL INCOMING CALL] Routing decision:", {
          isChild,
          isFamilyMember,
          hasChildId: !!incomingCall.child_id,
          hasParentId: !!incomingCall.parent_id,
          callId,
        });
        
        // Clear the incoming call state BEFORE navigation to ensure UI updates
        setIncomingCall(null);
        
        if (incomingCall.child_id) {
          // Adult (parent or family member) answering child's call
          if (isFamilyMember) {
            console.log("✅ [GLOBAL INCOMING CALL] Routing family member to:", `/family-member/call/${incomingCall.child_id}?callId=${callId}`);
            navigate(`/family-member/call/${incomingCall.child_id}?callId=${callId}`);
          } else {
            // Parent answering child's call - use /parent/call/ route which uses useCallEngine with role="parent"
            console.log("✅ [GLOBAL INCOMING CALL] Routing parent to:", `/parent/call/${incomingCall.child_id}?callId=${callId}`);
            navigate(`/parent/call/${incomingCall.child_id}?callId=${callId}`);
          }
        } else if (incomingCall.parent_id) {
          // Child answering parent's or family member's call - navigate to child call route
          console.log("✅ [GLOBAL INCOMING CALL] Routing child to:", `/child/call/${incomingCall.parent_id}?callId=${callId}`);
          navigate(`/child/call/${incomingCall.parent_id}?callId=${callId}`);
        } else {
          console.error("❌ [GLOBAL INCOMING CALL] No child_id or parent_id in incoming call:", incomingCall);
        }
      } catch (error) {
        console.error("❌ [GLOBAL INCOMING CALL] Error handling answer:", error);
        // Reset the ref on error so user can try again
        isAnsweringRef.current = false;
      }
      
      // Reset after navigation attempt
      setTimeout(() => {
        isAnsweringRef.current = false;
      }, 3000); // Reduced from 5000 to allow faster retry
    }
  };

  const handleDeclineCall = async () => {
    // CRITICAL: Always allow decline regardless of isAnsweringRef state
    if (incomingCall) {
      const { data: { session } } = await supabase.auth.getSession();
      const childSession = localStorage.getItem("childSession");
      const isChild = !session && !!childSession;
      
      // Determine who is declining
      let by: "child" | "parent" | "family_member" = "parent";
      if (isChild) {
        by = "child";
      } else if (session?.user?.id) {
        try {
          const { getUserRole } = await import("@/utils/userRole");
          const userRole = await getUserRole(session.user.id);
          if (userRole === "family_member") {
            by = "family_member";
          }
        } catch (roleError) {
          console.error("Error getting user role for decline:", roleError);
        }
      }

      try {
        await endCallUtil({ callId: incomingCall.id, by, reason: 'declined' });
      } catch (error) {
        console.error("Error declining call:", error);
      }

      // CRITICAL: Safety measure - stop any active media streams
      // In case camera was started (e.g., from a previous call or pre-warm)
      stopAllActiveStreams();

      stopIncomingCall(incomingCall.id);
      setIncomingCall(null);
      isAnsweringRef.current = false; // Reset in case it was stuck from answer attempt
    }
  };

  if (!incomingCall) return null;

  // Check if user is a child
  const childSession = localStorage.getItem("childSession");
  const isChild = !!childSession;
  
  // CRITICAL: Only suppress GlobalIncomingCall on ChildDashboard which has its own kid-friendly IncomingCallDialog
  // Other child pages (like /child/parents) will use the ChildIncomingCallUI below
  const isOnChildDashboard = location.pathname === "/child/dashboard";
  
  if (isChild && isOnChildDashboard) {
    // ChildDashboard has its own incoming call UI - don't show GlobalIncomingCall
    return null;
  }

  return (
    <>
      {/* Native Android incoming call enhancement */}
      {isNativeAndroid() && (
        <AndroidIncomingCall
          callId={incomingCall.id}
          callerName={incomingCall.child_name || incomingCall.parent_name || "Caller"}
          callerId={incomingCall.child_id || incomingCall.parent_id || ""}
          onAccept={handleAnswerCall}
          onDecline={handleDeclineCall}
          isActive={!!incomingCall}
        />
      )}
      {/* Use kid-friendly UI for children, adult UI for parents/family members */}
      {isChild ? (
        <ChildIncomingCallUI
          incomingCall={incomingCall}
          isAnsweringRef={isAnsweringRef}
          onAnswer={handleAnswerCall}
          onDecline={handleDeclineCall}
        />
      ) : (
        <IncomingCallUI
          incomingCall={incomingCall}
          isAnsweringRef={isAnsweringRef}
          onAnswer={handleAnswerCall}
          onDecline={handleDeclineCall}
        />
      )}
    </>
  );
};


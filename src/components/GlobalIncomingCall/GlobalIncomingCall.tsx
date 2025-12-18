// src/components/GlobalIncomingCall/GlobalIncomingCall.tsx
// Purpose: Main orchestrator component for global incoming calls (max 250 lines)
// CRITICAL: Preserves all WebRTC functionality - do not modify call handling logic

import { useRef, useEffect } from "react";
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
  
  // CRITICAL: Store a stable reference to the incoming call
  // This prevents race conditions where realtime updates clear incomingCall
  // before the click handler can process it
  const incomingCallRef = useRef<IncomingCall | null>(null);
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const handleAnswerCall = async () => {
    // CRITICAL: Use ref instead of state to avoid race conditions
    // The realtime subscription might clear incomingCall before this handler runs
    const currentCall = incomingCallRef.current || incomingCall;
    
    if (currentCall && !isAnsweringRef.current) {
      // CRITICAL: User clicked Accept - enable audio for the call
      setUserStartedCall();
      
      // Prevent double-clicks
      isAnsweringRef.current = true;
      
      // CRITICAL: Store call data locally BEFORE any async operations
      // This prevents data loss if realtime updates clear the state
      const callId = currentCall.id;
      const childId = currentCall.child_id;
      const parentId = currentCall.parent_id;
      const familyMemberId = currentCall.family_member_id;
      
      console.log("📞 [GLOBAL INCOMING CALL] Answer button clicked:", {
        callId,
        childId,
        parentId,
        familyMemberId,
        timestamp: new Date().toISOString(),
      });
      
      // CRITICAL: Stop ringtone IMMEDIATELY before any async operations
      // This matches the child dashboard pattern and ensures ringtone stops even if navigation fails
      stopIncomingCall(callId);
      
      try {
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
          hasChildId: !!childId,
          hasParentId: !!parentId,
          callId,
        });
        
        // Clear the incoming call state BEFORE navigation to ensure UI updates
        setIncomingCall(null);
        incomingCallRef.current = null;
        
        if (childId) {
          // Adult (parent or family member) answering child's call
          if (isFamilyMember) {
            console.log("✅ [GLOBAL INCOMING CALL] Routing family member to:", `/family-member/call/${childId}?callId=${callId}`);
            navigate(`/family-member/call/${childId}?callId=${callId}`);
          } else {
            // Parent answering child's call - use /parent/call/ route which uses useCallEngine with role="parent"
            console.log("✅ [GLOBAL INCOMING CALL] Routing parent to:", `/parent/call/${childId}?callId=${callId}`);
            navigate(`/parent/call/${childId}?callId=${callId}`);
          }
        } else if (parentId || familyMemberId) {
          // Child answering parent's or family member's call - navigate to child call route
          const targetId = parentId || familyMemberId;
          console.log("✅ [GLOBAL INCOMING CALL] Routing child to:", `/child/call/${targetId}?callId=${callId}`);
          navigate(`/child/call/${targetId}?callId=${callId}`);
        } else {
          console.error("❌ [GLOBAL INCOMING CALL] No child_id, parent_id, or family_member_id in incoming call:", currentCall);
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
    // CRITICAL: Use ref to get the call data, as state might be cleared by realtime updates
    const currentCall = incomingCallRef.current || incomingCall;
    
    // CRITICAL: Always allow decline regardless of isAnsweringRef state
    if (currentCall) {
      // Store call ID locally before any async operations
      const callId = currentCall.id;
      
      console.log("📞 [GLOBAL INCOMING CALL] Decline button clicked:", {
        callId,
        timestamp: new Date().toISOString(),
      });
      
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
        await endCallUtil({ callId, by, reason: 'declined' });
      } catch (error) {
        console.error("Error declining call:", error);
      }

      // CRITICAL: Safety measure - stop any active media streams
      // In case camera was started (e.g., from a previous call or pre-warm)
      stopAllActiveStreams();

      stopIncomingCall(callId);
      setIncomingCall(null);
      incomingCallRef.current = null;
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


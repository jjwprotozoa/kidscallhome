// src/components/GlobalIncomingCall/GlobalIncomingCall.tsx
// Purpose: Main orchestrator component for global incoming calls (max 250 lines)
// CRITICAL: Preserves all WebRTC functionality - do not modify call handling logic

import { useRef, useEffect, useState } from "react";
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

// Wrapper component to safely use router hooks
// This prevents errors when the Router context isn't fully initialized during lazy loading
const GlobalIncomingCallInner = () => {
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
      
      if (import.meta.env.DEV) {
        console.log("📞 [GLOBAL INCOMING CALL] Answer button clicked:", {
          callId,
          childId,
          parentId,
          familyMemberId,
          timestamp: new Date().toISOString(),
        });
      }
      
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
            if (import.meta.env.DEV) {
              console.log("🔍 [GLOBAL INCOMING CALL] User role detection:", {
                userId: session.user.id,
                userRole,
                isFamilyMember,
              });
            }
          } catch (roleError) {
            console.error("Error getting user role, defaulting to parent:", roleError);
            // Default to parent if role check fails
            isFamilyMember = false;
          }
        }
        
        if (import.meta.env.DEV) {
          console.log("🔍 [GLOBAL INCOMING CALL] Routing decision:", {
            isChild,
            isFamilyMember,
            hasChildId: !!childId,
            hasParentId: !!parentId,
            callId,
          });
        }
        
        // Clear the incoming call state BEFORE navigation to ensure UI updates
        setIncomingCall(null);
        incomingCallRef.current = null;
        
        if (childId) {
          // Adult (parent or family member) answering child's call
          if (isFamilyMember) {
            if (import.meta.env.DEV) {
              console.log("✅ [GLOBAL INCOMING CALL] Routing family member to:", `/family-member/call/${childId}?callId=${callId}`);
            }
            navigate(`/family-member/call/${childId}?callId=${callId}`);
          } else {
            // Parent answering child's call - use /parent/call/ route which uses useCallEngine with role="parent"
            if (import.meta.env.DEV) {
              console.log("✅ [GLOBAL INCOMING CALL] Routing parent to:", `/parent/call/${childId}?callId=${callId}`);
            }
            navigate(`/parent/call/${childId}?callId=${callId}`);
          }
        } else if (parentId || familyMemberId) {
          // Child answering parent's or family member's call - navigate to child call route
          const targetId = parentId || familyMemberId;
          if (import.meta.env.DEV) {
            console.log("✅ [GLOBAL INCOMING CALL] Routing child to:", `/child/call/${targetId}?callId=${callId}`);
          }
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
      
      if (import.meta.env.DEV) {
        console.log("📞 [GLOBAL INCOMING CALL] Decline button clicked:", {
          callId,
          timestamp: new Date().toISOString(),
        });
      }
      
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
  const isOnChildDashboard = location.pathname === "/child/parent";
  
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

// Outer component that safely renders after Router context is initialized
// This prevents "Cannot destructure property 'basename'" errors during lazy loading
// The issue occurs when lazy-loaded components try to use router hooks before
// the Router context is fully initialized during the lazy loading process
// On slower devices (like Samsung A31), Router context initialization takes longer
export const GlobalIncomingCall = () => {
  const [isReady, setIsReady] = useState(false);

  // Delay rendering until Router context is fully initialized
  // This is necessary because lazy-loaded components can render before Router context is available
  // Production builds may have different timing, so we use a longer delay
  // On slower devices (like Samsung A31), we need significantly more time for Router context to initialize
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    
    // Use a more reliable initialization strategy for slower devices
    const initialize = () => {
      if (!mounted) return;
      
      // Strategy: Wait for multiple conditions to be met
      // 1. Document must be ready
      // 2. Window and location must be available
      // 3. Body must have content (indicating React has rendered)
      // 4. Additional delay to ensure Router context is fully initialized
      
      const checkReady = () => {
        return (
          typeof window !== 'undefined' &&
          window.location &&
          document.readyState === 'complete' &&
          document.body &&
          document.body.children.length > 0
        );
      };
      
      // If already ready, wait additional time for Router context
      if (checkReady()) {
        // Use a longer delay for slower devices - Router context needs time to initialize
        // Samsung A31 and similar devices may need up to 1.5 seconds
        timeoutId = setTimeout(() => {
          if (mounted) {
            setIsReady(true);
          }
        }, 1500); // Increased from 500ms to 1500ms for slower devices
        return;
      }
      
      // Wait for document to be ready first
      if (document.readyState === 'loading') {
        const onDOMContentLoaded = () => {
          document.removeEventListener('DOMContentLoaded', onDOMContentLoaded);
          // After DOM is ready, wait for Router context
          timeoutId = setTimeout(() => {
            if (mounted && checkReady()) {
              // Additional delay to ensure Router context is fully initialized
              setTimeout(() => {
                if (mounted) {
                  setIsReady(true);
                }
              }, 1000); // Additional 1 second delay for Router context
            } else if (mounted) {
              // If still not ready, set ready anyway after max wait
              setTimeout(() => {
                if (mounted) {
                  setIsReady(true);
                }
              }, 2000);
            }
          }, 500);
        };
        document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
        return;
      }
      
      // Document is ready, but check if Router context is ready
      // Use a polling approach with a maximum wait time
      let pollCount = 0;
      const maxPolls = 15; // 15 * 200ms = 3 seconds max
      
      const pollInterval = setInterval(() => {
        pollCount++;
        if (mounted && checkReady()) {
          clearInterval(pollInterval);
          // Additional delay to ensure Router context is fully initialized
          timeoutId = setTimeout(() => {
            if (mounted) {
              setIsReady(true);
            }
          }, 1000); // 1 second delay for Router context initialization
        } else if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          // Maximum wait reached, render anyway
          if (mounted) {
            setIsReady(true);
          }
        }
      }, 200);
      
      // Fallback: ensure we render eventually
      timeoutId = setTimeout(() => {
        clearInterval(pollInterval);
        if (mounted) {
          setIsReady(true);
        }
      }, 3000); // Maximum 3 second wait
    };
    
    // Start initialization after a short delay to let the app start loading
    timeoutId = setTimeout(initialize, 200);
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // Only render when Router context is confirmed ready
  // This prevents the "Cannot destructure property 'basename'" error
  if (!isReady) {
    return null;
  }

  return <GlobalIncomingCallInner />;
};


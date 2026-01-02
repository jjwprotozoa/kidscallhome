// src/components/GlobalIncomingCall/GlobalIncomingCall.tsx
// Purpose: Main orchestrator component for global incoming calls (max 250 lines)
// CRITICAL: Preserves all WebRTC functionality - do not modify call handling logic

import React, { useRef, useEffect, useState } from "react";
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
// The outer component ensures Router context is ready before rendering this component
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

  // Safe navigation helper that retries if Router context isn't ready
  // This is critical for slower devices like Samsung A31 where Router context
  // initialization can take longer than expected
  const safeNavigate = (path: string, maxRetries = 3, retryDelay = 200) => {
    const attemptNavigate = (attempt: number): void => {
      try {
        // Check if navigate function is available and callable
        if (typeof navigate === 'function') {
          navigate(path);
        } else {
          throw new Error('Navigate function not available');
        }
      } catch (error: any) {
        // Check if it's the Router context error
        const isRouterContextError = 
          error?.message?.includes('basename') ||
          error?.message?.includes('useContext') ||
          error?.message?.includes('Router');
        
        if (isRouterContextError && attempt < maxRetries) {
          // Router context not ready yet, retry after delay
          if (import.meta.env.DEV) {
            console.warn(`⚠️ [GLOBAL INCOMING CALL] Router context not ready, retrying navigation (attempt ${attempt + 1}/${maxRetries})...`);
          }
          setTimeout(() => attemptNavigate(attempt + 1), retryDelay * (attempt + 1));
        } else {
          // Max retries reached or different error
          console.error("❌ [GLOBAL INCOMING CALL] Navigation failed after retries:", error);
          throw error;
        }
      }
    };
    
    attemptNavigate(0);
  };

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
        
        // Use safe navigation with retry logic for slower devices
        if (childId) {
          // Adult (parent or family member) answering child's call
          if (isFamilyMember) {
            if (import.meta.env.DEV) {
              console.log("✅ [GLOBAL INCOMING CALL] Routing family member to:", `/family-member/call/${childId}?callId=${callId}`);
            }
            safeNavigate(`/family-member/call/${childId}?callId=${callId}`);
          } else {
            // Parent answering child's call - use /parent/call/ route which uses useCallEngine with role="parent"
            if (import.meta.env.DEV) {
              console.log("✅ [GLOBAL INCOMING CALL] Routing parent to:", `/parent/call/${childId}?callId=${callId}`);
            }
            safeNavigate(`/parent/call/${childId}?callId=${callId}`);
          }
        } else if (parentId || familyMemberId) {
          // Child answering parent's or family member's call - navigate to child call route
          const targetId = parentId || familyMemberId;
          if (import.meta.env.DEV) {
            console.log("✅ [GLOBAL INCOMING CALL] Routing child to:", `/child/call/${targetId}?callId=${callId}`);
          }
          safeNavigate(`/child/call/${targetId}?callId=${callId}`);
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
  // Other child pages (like /child/family) will use the ChildIncomingCallUI below
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

// Error boundary component to catch Router context errors
class RouterContextErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; retryCount: number }
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    // Check if this is the Router context error
    const isRouterContextError =
      error.message?.includes("basename") ||
      error.message?.includes("useContext") ||
      error.message?.includes("Router") ||
      error.message?.includes("Cannot destructure");
    
    if (isRouterContextError) {
      return { hasError: true };
    }
    // Let other errors propagate
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.warn("⚠️ [GLOBAL INCOMING CALL] Router context error caught, will retry:", {
        error: error.message,
        retryCount: this.state.retryCount,
      });
    }
  }

  componentDidUpdate(prevProps: { children: React.ReactNode }, prevState: { hasError: boolean; retryCount: number }) {
    // Auto-retry after a delay if we caught a Router context error
    if (this.state.hasError && this.state.retryCount < 5 && this.state.retryCount !== prevState.retryCount) {
      // Clear any existing timeout
      if (this.retryTimeoutId) {
        clearTimeout(this.retryTimeoutId);
      }
      
      // Progressive retry delay: 500ms, 1s, 2s, 3s, 5s
      const retryDelays = [500, 1000, 2000, 3000, 5000];
      const retryDelay = retryDelays[this.state.retryCount] || 5000;
      
      this.retryTimeoutId = setTimeout(() => {
        this.setState({ hasError: false, retryCount: this.state.retryCount + 1 });
      }, retryDelay);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // Return null while retrying - don't show error UI for Router context errors
      return null;
    }

    return this.props.children;
  }
}

// Outer component that renders after Router context is initialized
// This component is rendered by DeferredGlobalComponents which already waits for Router context
// The deferral in App.tsx (500ms on mobile, 200ms on desktop) ensures Router is ready
// Simplified from complex polling logic that was unreliable on mobile devices
export const GlobalIncomingCall = () => {
  // Wrap in error boundary to catch any unexpected errors
  // The Router context should already be available since we're rendered inside BrowserRouter
  // and DeferredGlobalComponents has already waited for the appropriate delay
  return (
    <RouterContextErrorBoundary>
      <GlobalIncomingCallInner />
    </RouterContextErrorBoundary>
  );
};


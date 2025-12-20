// src/pages/ParentDashboard/useIncomingCallHandlers.ts
// Purpose: Incoming call handlers

import { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { endCall as endCallUtil } from "@/features/calls/utils/callEnding";
import { stopAllActiveStreams } from "@/features/calls/utils/mediaCleanup";
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";
import { setUserStartedCall } from "@/utils/userInteraction";
import { IncomingCall } from "./types";

export const useIncomingCallHandlers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isAnsweringRef = useRef(false);
  const { stopIncomingCall } = useIncomingCallNotifications({
    enabled: true,
    volume: 0.7,
  });

  const handleAnswer = useCallback((incomingCall: IncomingCall, setIncomingCall: (call: IncomingCall | null) => void) => {
    // CRITICAL: User clicked Accept - enable audio for the call
    setUserStartedCall();
    
    stopIncomingCall(incomingCall.id);
    isAnsweringRef.current = true;
    const childId = incomingCall.child_id;
    const callId = incomingCall.id;
    setIncomingCall(null);
    // CRITICAL: Use /parent/call/ route which uses useCallEngine with role="parent"
    // Using /call/ route would use the old VideoCall component with useVideoCall hook
    navigate(`/parent/call/${childId}?callId=${callId}`);
    setTimeout(() => {
      isAnsweringRef.current = false;
    }, 2000);
  }, [navigate, stopIncomingCall]);

  const handleDecline = useCallback(async (incomingCall: IncomingCall, setIncomingCall: (call: IncomingCall | null) => void) => {
    // CRITICAL: Don't block decline if answer was attempted - user should always be able to decline
    try {
      await endCallUtil({
        callId: incomingCall.id,
        by: "parent",
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
  }, [toast, stopIncomingCall]);

  return {
    isAnsweringRef,
    handleAnswer,
    handleDecline,
  };
};










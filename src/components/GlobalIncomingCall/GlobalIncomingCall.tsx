// src/components/GlobalIncomingCall/GlobalIncomingCall.tsx
// Purpose: Main orchestrator component for global incoming calls (max 250 lines)
// CRITICAL: Preserves all WebRTC functionality - do not modify call handling logic

import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { endCall as endCallUtil } from "@/features/calls/utils/callEnding";
import { AndroidIncomingCall } from "@/components/native/AndroidIncomingCall";
import { isNativeAndroid } from "@/utils/nativeAndroid";
import { useIncomingCallState } from "./useIncomingCallState";
import { IncomingCallUI } from "./IncomingCallUI";
import { IncomingCall } from "./types";

export const GlobalIncomingCall = () => {
  const { incomingCall, setIncomingCall, stopIncomingCall } = useIncomingCallState();
  const isAnsweringRef = useRef(false);
  const navigate = useNavigate();

  const handleAnswerCall = () => {
    if (incomingCall) {
      stopIncomingCall(incomingCall.id);
      isAnsweringRef.current = true;
      const callId = incomingCall.id;
      
      if (incomingCall.child_id) {
        // Parent answering child's call
        navigate(`/call/${incomingCall.child_id}?callId=${callId}`);
      } else if (incomingCall.parent_id) {
        // Child answering parent's call - need child ID from session
        if (typeof window !== 'undefined' && window.localStorage) {
          const childSession = localStorage.getItem("childSession");
          if (childSession) {
            try {
              const childData = JSON.parse(childSession);
              if (childData?.id) {
                navigate(`/call/${childData.id}?callId=${callId}`);
              }
            } catch (error) {
              console.error("❌ [GLOBAL INCOMING CALL] Invalid child session data in handleAnswerCall:", error);
            }
          }
        }
      }
      
      setIncomingCall(null);
      setTimeout(() => {
        isAnsweringRef.current = false;
      }, 2000);
    }
  };

  const handleDeclineCall = async () => {
    if (incomingCall) {
      const { data: { session } } = await supabase.auth.getSession();
      const childSession = localStorage.getItem("childSession");
      const isChild = !session && !!childSession;
      const by = isChild ? 'child' : 'parent';

      try {
        await endCallUtil({ callId: incomingCall.id, by, reason: 'declined' });
      } catch (error) {
        console.error("Error declining call:", error);
      }

      stopIncomingCall(incomingCall.id);
      setIncomingCall(null);
    }
  };

  if (!incomingCall) return null;

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
      <IncomingCallUI
        incomingCall={incomingCall}
        isAnsweringRef={isAnsweringRef}
        onAnswer={handleAnswerCall}
        onDecline={handleDeclineCall}
      />
    </>
  );
};


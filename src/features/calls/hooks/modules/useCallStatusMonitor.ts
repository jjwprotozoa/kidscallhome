// src/features/calls/hooks/modules/useCallStatusMonitor.ts
// Monitor call status changes via Supabase Realtime
// Handles call termination and status updates

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { isCallTerminal } from "../../utils/callEnding";
import type { CallState } from "./useCallStateMachine";

export interface UseCallStatusMonitorParams {
  callId: string | null;
  terminationChannelRef: React.MutableRefObject<RealtimeChannel | null>;
  setStateWithLogging: (
    newState: CallState,
    reason: string,
    context?: Record<string, unknown>
  ) => void;
}

export const useCallStatusMonitor = ({
  callId,
  terminationChannelRef,
  setStateWithLogging,
}: UseCallStatusMonitorParams) => {
  useEffect(() => {
    if (!callId) return;

    const channel = supabase
      .channel(`call-status:${callId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${callId}`,
        },
        async (payload) => {
          const updatedCall = payload.new as {
            id: string;
            status: string;
          };

          // Handle call termination
          if (isCallTerminal(updatedCall.status)) {
            setStateWithLogging("ended", "Call ended remotely", {
              callId: updatedCall.id,
              status: updatedCall.status,
            });
          }
        }
      )
      .subscribe();

    terminationChannelRef.current = channel;

    return () => {
      if (terminationChannelRef.current) {
        supabase.removeChannel(terminationChannelRef.current);
        terminationChannelRef.current = null;
      }
    };
  }, [callId, terminationChannelRef, setStateWithLogging]);
};


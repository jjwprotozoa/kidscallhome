// src/features/calls/hooks/modules/useCallStateMachine.ts
// State machine management for call engine

import { useCallback, useEffect, useRef, useState } from "react";

export type CallState =
  | "idle"
  | "calling"
  | "incoming"
  | "connecting"
  | "in_call"
  | "ended";

export interface UseCallStateMachineReturn {
  state: CallState;
  stateRef: React.MutableRefObject<CallState>;
  setStateWithLogging: (
    newState: CallState,
    reason: string,
    context?: Record<string, unknown>
  ) => void;
}

export const useCallStateMachine = (
  role: "parent" | "child" | "family_member",
  callId: string | null
): UseCallStateMachineReturn => {
  const [state, setState] = useState<CallState>("idle");
  const stateRef = useRef<CallState>(state);

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // DIAGNOSTIC: Log important state transitions (dev mode only)
  // Only log transitions to/from key states to reduce console noise
  const logStateTransition = useCallback(
    (
      newState: CallState,
      reason: string,
      context?: Record<string, unknown>
    ) => {
      if (import.meta.env.DEV) {
        // Only log transitions to/from important states (not every transition)
        const importantStates = ["calling", "in_call", "ended", "idle"];
        const isImportantTransition = 
          importantStates.includes(state) || importantStates.includes(newState);
        
        if (isImportantTransition) {
          // eslint-disable-next-line no-console
          console.log("[CALL STATE] State transition:", {
            from: state,
            to: newState,
            callId: callId || "none",
            role,
            reason,
            ...context,
          });
        }
      }
    },
    [state, callId, role]
  );

  // Wrapper for setState that logs transitions
  const setStateWithLogging = useCallback(
    (
      newState: CallState,
      reason: string,
      context?: Record<string, unknown>
    ) => {
      if (state !== newState) {
        logStateTransition(newState, reason, context);
        setState(newState);
      }
    },
    [state, logStateTransition]
  );

  return {
    state,
    stateRef,
    setStateWithLogging,
  };
};


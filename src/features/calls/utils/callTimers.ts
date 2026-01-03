// src/features/calls/utils/callTimers.ts
// Call flow timers for WhatsApp-like smooth experience
// Implements: ring timeout (30s), connect timeout (15s), ICE restart window (5-8s)

import { endCall, type EndCallBy, type EndCallReason } from "./callEnding";

export interface CallTimerConfig {
  callId: string;
  role: "parent" | "child" | "family_member";
  onRingTimeout?: () => void;
  onConnectTimeout?: () => void;
  onIceRestartTimeout?: () => void;
}

export class CallTimers {
  private ringTimeout: NodeJS.Timeout | null = null;
  private connectTimeout: NodeJS.Timeout | null = null;
  private iceRestartTimeout: NodeJS.Timeout | null = null;
  private config: CallTimerConfig | null = null;

  /**
   * Start ring timeout (30s) - caller waiting for answer
   * If no answer within 30s, end call with reason="no_answer"
   */
  startRingTimeout(config: CallTimerConfig): void {
    this.clearRingTimeout();
    this.config = config;

    this.ringTimeout = setTimeout(async () => {
      console.warn("⏰ [CALL TIMERS] Ring timeout (30s) - no answer received", {
        callId: config.callId,
        role: config.role,
      });

      // End call with no_answer reason
      await endCall({
        callId: config.callId,
        by: config.role,
        reason: "no_answer",
      });

      // Call callback if provided
      if (config.onRingTimeout) {
        config.onRingTimeout();
      }
    }, 30000); // 30 seconds
  }

  /**
   * Start connect timeout (15s) - WebRTC negotiation timeout
   * If connection not established within 15s, end call with reason="failed"
   */
  startConnectTimeout(config: CallTimerConfig): void {
    this.clearConnectTimeout();
    this.config = config;

    this.connectTimeout = setTimeout(async () => {
      console.warn(
        "⏰ [CALL TIMERS] Connect timeout (15s) - WebRTC negotiation failed",
        {
          callId: config.callId,
          role: config.role,
        }
      );

      // End call with failed reason
      await endCall({
        callId: config.callId,
        by: config.role,
        reason: "failed",
      });

      // Call callback if provided
      if (config.onConnectTimeout) {
        config.onConnectTimeout();
      }
    }, 15000); // 15 seconds
  }

  /**
   * Start ICE restart window (5-8s) - attempt recovery after disconnect
   * If recovery fails within window, end call with reason="network_lost"
   */
  startIceRestartWindow(config: CallTimerConfig): void {
    this.clearIceRestartTimeout();
    this.config = config;

    // Randomize between 5-8s to avoid thundering herd
    const timeoutMs = 5000 + Math.random() * 3000;

    this.iceRestartTimeout = setTimeout(async () => {
      console.warn(
        "⏰ [CALL TIMERS] ICE restart window expired - network recovery failed",
        {
          callId: config.callId,
          role: config.role,
          timeoutMs: Math.round(timeoutMs),
        }
      );

      // End call with network_lost reason
      await endCall({
        callId: config.callId,
        by: config.role,
        reason: "network_lost",
      });

      // Call callback if provided
      if (config.onIceRestartTimeout) {
        config.onIceRestartTimeout();
      }
    }, timeoutMs);
  }

  /**
   * Clear ring timeout (call was answered or ended)
   */
  clearRingTimeout(): void {
    if (this.ringTimeout) {
      clearTimeout(this.ringTimeout);
      this.ringTimeout = null;
    }
  }

  /**
   * Clear connect timeout (connection established or call ended)
   */
  clearConnectTimeout(): void {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
  }

  /**
   * Clear ICE restart timeout (recovery succeeded or call ended)
   */
  clearIceRestartTimeout(): void {
    if (this.iceRestartTimeout) {
      clearTimeout(this.iceRestartTimeout);
      this.iceRestartTimeout = null;
    }
  }

  /**
   * Clear all timers
   */
  clearAll(): void {
    this.clearRingTimeout();
    this.clearConnectTimeout();
    this.clearIceRestartTimeout();
    this.config = null;
  }
}

// Singleton instance for global timer management
export const callTimers = new CallTimers();







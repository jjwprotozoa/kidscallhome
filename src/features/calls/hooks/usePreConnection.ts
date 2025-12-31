// src/features/calls/hooks/usePreConnection.ts
// Pre-connection hook that initializes media (camera/mic) when incoming call notification appears
// This makes call acceptance instant by having media permissions already granted
// Note: Full peer connection setup happens in the call screen component

import { useRef, useCallback, useEffect, useState } from "react";
import { mediaAccessLock } from "../utils/mediaAccessLock";

interface UsePreConnectionOptions {
  enabled?: boolean;
  onPreConnectionReady?: () => void;
  onPreConnectionError?: (error: Error) => void;
}

interface UsePreConnectionReturn {
  preInitializeMedia: (callId: string) => Promise<void>;
  cleanupPreConnection: () => void;
  isPreConnecting: boolean;
  preConnectionCallId: string | null;
  preConnectionStream: MediaStream | null;
}

// Global storage for pre-connection state (shared across components)
const preConnectionState = {
  stream: null as MediaStream | null,
  callId: null as string | null,
  isConnecting: false,
};

export const usePreConnection = ({
  enabled = true,
  onPreConnectionReady,
  onPreConnectionError,
}: UsePreConnectionOptions): UsePreConnectionReturn => {
  // Use refs instead of state to avoid hook order issues
  // The global state is the source of truth
  const isPreConnectingRef = useRef(false);
  const cleanupExecutedRef = useRef(false);

  const preInitializeMedia = useCallback(
    async (callId: string) => {
      if (!enabled) return;
      if (isPreConnectingRef.current && preConnectionState.callId === callId) {
        // Already pre-connecting for this call
        return;
      }

      // Don't pre-connect if we already have media (might be from a previous call)
      if (preConnectionState.stream) {
        console.log("📞 [PRE-CONNECTION] Media already exists, skipping pre-connection");
        return;
      }

      try {
        isPreConnectingRef.current = true;
        preConnectionState.isConnecting = true;
        preConnectionState.callId = callId;
        cleanupExecutedRef.current = false;

        console.log("🚀 [PRE-CONNECTION] Starting pre-connection (getting media) for call:", callId);

        // Check if media is already available from another source
        const existingStream = mediaAccessLock.getCurrentStream();
        let stream: MediaStream;
        if (existingStream) {
          console.log("📞 [PRE-CONNECTION] Reusing existing media stream");
          stream = existingStream;
          preConnectionState.stream = stream;
        } else {
          // Get media permissions early (camera/mic) using media access lock
          // This is the slowest part, so doing it during ringing makes acceptance instant
          // The lock prevents concurrent getUserMedia calls that cause "Device in use" errors
          stream = await mediaAccessLock.acquire(
            {
              audio: true,
              video: true,
            },
            `pre-connection-${callId}`
          );

          // Store stream globally so call screen can reuse it
          preConnectionState.stream = stream;
        }

        console.log("✅ [PRE-CONNECTION] Media ready for call:", callId, {
          hasStream: !!stream,
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length,
        });

        if (onPreConnectionReady) {
          onPreConnectionReady();
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error("❌ [PRE-CONNECTION] Failed to pre-connect:", err);

        // Reset state on error
        isPreConnectingRef.current = false;
        preConnectionState.isConnecting = false;
        const failedCallId = preConnectionState.callId;
        preConnectionState.callId = null;

        // Release lock if we were holding it
        const lockOwner = `pre-connection-${failedCallId}`;
        if (mediaAccessLock.getLockOwner() === lockOwner) {
          console.log("🔓 [PRE-CONNECTION] Releasing lock after error");
          mediaAccessLock.release(lockOwner);
        }

        // Clear stream if it exists
        if (preConnectionState.stream) {
          preConnectionState.stream.getTracks().forEach(track => track.stop());
          preConnectionState.stream = null;
        }

        if (onPreConnectionError) {
          onPreConnectionError(err);
        }
      }
    },
    [enabled, onPreConnectionReady, onPreConnectionError]
  );

  const cleanupPreConnection = useCallback(() => {
    if (cleanupExecutedRef.current) {
      return; // Already cleaned up
    }

    if (isPreConnectingRef.current || preConnectionState.callId) {
      console.log("🧹 [PRE-CONNECTION] Cleaning up pre-connection:", {
        callId: preConnectionState.callId,
        isPreConnecting: isPreConnectingRef.current,
      });

      cleanupExecutedRef.current = true;
      isPreConnectingRef.current = false;
      preConnectionState.isConnecting = false;
      const callId = preConnectionState.callId;
      preConnectionState.callId = null;

      // Stop all tracks in the pre-connection stream
      // Note: We don't release the media lock here because the call screen may be using it
      // The call screen will release the lock when it's done
      if (preConnectionState.stream) {
        // Only stop if we're the owner of the lock
        const lockOwner = mediaAccessLock.getLockOwner();
        if (lockOwner?.startsWith("pre-connection")) {
          mediaAccessLock.stop(lockOwner);
        } else {
          // Not our lock, just stop tracks
          preConnectionState.stream.getTracks().forEach((track) => {
            track.stop();
          });
        }
        preConnectionState.stream = null;
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPreConnection();
    };
  }, [cleanupPreConnection]);

  return {
    preInitializeMedia,
    cleanupPreConnection,
    isPreConnecting: isPreConnectingRef.current,
    preConnectionCallId: preConnectionState.callId,
    preConnectionStream: preConnectionState.stream,
  };
};

// Export function to get pre-connection stream (for use in call screens)
export const getPreConnectionStream = (): MediaStream | null => {
  return preConnectionState.stream;
};

// Export function to clear pre-connection stream (after call screen takes ownership)
export const clearPreConnectionStream = (): void => {
  preConnectionState.stream = null;
  preConnectionState.callId = null;
  preConnectionState.isConnecting = false;
};


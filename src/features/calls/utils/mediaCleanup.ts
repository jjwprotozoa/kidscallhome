// src/features/calls/utils/mediaCleanup.ts
// Utility functions for ensuring camera/microphone are properly released
// Use these when ending or declining calls to guarantee media is stopped

/**
 * Forcefully stops all media tracks (camera and microphone) on a given stream
 * @param stream - The MediaStream to stop
 */
export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;

  stream.getTracks().forEach((track) => {
    console.warn(`🛑 [MEDIA CLEANUP] Stopping ${track.kind} track:`, {
      id: track.id,
      enabled: track.enabled,
      readyState: track.readyState,
    });
    track.stop();
  });
}

/**
 * Clears a video element's srcObject and stops any associated tracks
 * @param videoElement - The video element to clear
 */
export function clearVideoElement(videoElement: HTMLVideoElement | null): void {
  if (!videoElement?.srcObject) return;

  const stream = videoElement.srcObject as MediaStream;
  if (stream && typeof stream.getTracks === "function") {
    stream.getTracks().forEach((track) => {
      console.warn(
        `🛑 [MEDIA CLEANUP] Stopping track from video element:`,
        track.kind
      );
      track.stop();
    });
  }
  videoElement.srcObject = null;
}

/**
 * Clears an audio element's srcObject and stops any associated tracks
 * @param audioElement - The audio element to clear
 */
export function clearAudioElement(audioElement: HTMLAudioElement | null): void {
  if (!audioElement?.srcObject) return;

  const stream = audioElement.srcObject as MediaStream;
  if (stream && typeof stream.getTracks === "function") {
    stream.getTracks().forEach((track) => {
      console.warn(
        `🛑 [MEDIA CLEANUP] Stopping track from audio element:`,
        track.kind
      );
      track.stop();
    });
  }
  audioElement.srcObject = null;
  audioElement.pause();
}

/**
 * Comprehensive cleanup of all media resources
 * Stops all tracks on provided streams and clears video elements
 * Call this when ending or declining a call
 */
export function cleanupAllMedia({
  localStream,
  remoteStream,
  localVideoRef,
  remoteVideoRef,
  audioElementRef,
}: {
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  localVideoRef?: React.RefObject<HTMLVideoElement>;
  remoteVideoRef?: React.RefObject<HTMLVideoElement>;
  audioElementRef?: React.RefObject<HTMLAudioElement>;
}): void {
  console.warn("🧹 [MEDIA CLEANUP] Starting comprehensive media cleanup...");

  // Stop local stream tracks (camera/mic)
  stopMediaStream(localStream ?? null);

  // Stop remote stream tracks
  stopMediaStream(remoteStream ?? null);

  // Clear video elements
  if (localVideoRef?.current) {
    clearVideoElement(localVideoRef.current);
  }
  if (remoteVideoRef?.current) {
    clearVideoElement(remoteVideoRef.current);
  }

  // Clear audio element if present
  if (audioElementRef?.current) {
    clearAudioElement(audioElementRef.current);
  }

  console.warn("✅ [MEDIA CLEANUP] Cleanup complete");
}

/**
 * Global function to stop all active media streams
 * This is a fallback to ensure the camera indicator goes off
 * Useful when you want to guarantee cleanup even if refs are lost
 */
const activeStreamsRegistry: Set<MediaStream> = new Set();

export function registerActiveStream(stream: MediaStream): void {
  activeStreamsRegistry.add(stream);
}

export function unregisterActiveStream(stream: MediaStream): void {
  activeStreamsRegistry.delete(stream);
}

export function stopAllActiveStreams(): void {
  console.warn(
    `🧹 [MEDIA CLEANUP] Stopping ${activeStreamsRegistry.size} registered streams`
  );
  activeStreamsRegistry.forEach((stream) => {
    stopMediaStream(stream);
  });
  activeStreamsRegistry.clear();
}

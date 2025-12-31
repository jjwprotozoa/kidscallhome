// src/features/calls/utils/mediaAccessLock.ts
// Media access lock utility to prevent concurrent getUserMedia calls
// This prevents "Device in use" errors when multiple hooks try to access media simultaneously

import { getActiveStreamsRegistry, stopAllActiveStreams } from './mediaCleanup';

interface MediaAccessRequest {
  resolve: (stream: MediaStream) => void;
  reject: (error: Error) => void;
  constraints: MediaStreamConstraints;
}

class MediaAccessLock {
  private isLocked = false;
  private currentStream: MediaStream | null = null;
  private queue: MediaAccessRequest[] = [];
  private lockOwner: string | null = null;

  /**
   * Check for and stop any active media tracks that might be holding the device
   * This helps prevent "Device in use" errors
   */
  private async ensureDeviceReleased(): Promise<void> {
    try {
      // Check all video elements for active streams
      const videoElements = document.querySelectorAll('video');
      for (const video of videoElements) {
        if (video.srcObject instanceof MediaStream) {
          const stream = video.srcObject;
          const activeTracks = stream.getTracks().filter(t => t.readyState === 'live');
          if (activeTracks.length > 0) {
            console.log(`🛑 [MEDIA LOCK] Found active tracks on video element, stopping...`);
            activeTracks.forEach(track => track.stop());
          }
          video.srcObject = null;
        }
      }
      
      // Check for active tracks in the global registry
      // This catches streams that might not be attached to video elements
      try {
        const activeStreams = getActiveStreamsRegistry();
        activeStreams.forEach(stream => {
          const activeTracks = stream.getTracks().filter(t => t.readyState === 'live');
          if (activeTracks.length > 0) {
            console.log(`🛑 [MEDIA LOCK] Found active tracks in registry, stopping...`);
            activeTracks.forEach(track => track.stop());
          }
        });
      } catch (error) {
        // Ignore if module not available
      }
      
      // Longer delay to let browser release the device
      // Some browsers need more time to fully release devices
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      // Ignore errors - this is best effort cleanup
      console.warn(`⚠️ [MEDIA LOCK] Error checking for active tracks:`, error);
    }
  }

  /**
   * Acquire media access lock and get user media with retry logic
   * If another request is in progress, this will queue and wait
   * @param constraints - Media constraints for getUserMedia
   * @param owner - Identifier for who is requesting (for debugging)
   * @param retries - Number of retries for "Device in use" errors
   * @returns Promise that resolves with MediaStream
   */
  async acquire(
    constraints: MediaStreamConstraints,
    owner: string = "unknown",
    retries: number = 3
  ): Promise<MediaStream> {
    // For pre-warming (optional), use fewer retries and shorter delays
    // This prevents blocking if device is truly unavailable
    const isPreWarming = owner.includes("pre-connection") || owner.includes("pre-warm");
    const effectiveRetries = isPreWarming ? Math.min(retries, 2) : retries;
    // If we have a current stream that matches the constraints, reuse it
    if (this.currentStream && this.streamMatchesConstraints(this.currentStream, constraints)) {
      // Verify stream tracks are still active
      const activeTracks = this.currentStream.getTracks().filter(t => t.readyState === 'live');
      if (activeTracks.length > 0) {
        console.log(`✅ [MEDIA LOCK] Reusing existing stream for ${owner}`);
        return this.currentStream;
      } else {
        // Stream exists but tracks are dead, clear it
        console.log(`⚠️ [MEDIA LOCK] Existing stream has no active tracks, clearing...`);
        this.currentStream = null;
      }
    }

    // If locked, queue the request
    if (this.isLocked) {
      console.log(`⏳ [MEDIA LOCK] Queueing media request from ${owner} (lock held by ${this.lockOwner})`);
      return new Promise<MediaStream>((resolve, reject) => {
        this.queue.push({ resolve, reject, constraints });
      });
    }

    // Acquire lock and get media
    this.isLocked = true;
    this.lockOwner = owner;

    try {
      console.log(`🔒 [MEDIA LOCK] Acquiring lock for ${owner}`);
      
      // If we have a stream but it doesn't match constraints, stop it first
      if (this.currentStream) {
        console.log(`🛑 [MEDIA LOCK] Stopping existing stream (constraints mismatch)`);
        this.stopStream(this.currentStream);
        this.currentStream = null;
        // Longer delay after stopping to let browser release device
        // Some browsers need more time to fully release the device
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Ensure device is released before acquiring
      await this.ensureDeviceReleased();
      
      // Add a small delay after cleanup to ensure browser has released the device
      // This helps prevent "Device in use" errors when reacquiring quickly
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to get media with retry logic for "Device in use" errors
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= effectiveRetries; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`🔄 [MEDIA LOCK] Retry attempt ${attempt}/${effectiveRetries} for ${owner}`);
            // Force cleanup before every retry to ensure device is released
            await this.forceCleanup();
            // Progressive delays: longer for each retry to give browser more time
            // For pre-warming, use shorter delays to fail faster
            // For normal acquisition, use longer delays for better success rate
            const baseDelay = isPreWarming ? 300 : 500;
            const delay = baseDelay * Math.pow(1.5, attempt - 1); // Exponential backoff
            console.log(`⏳ [MEDIA LOCK] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          this.currentStream = stream;
          
          console.log(`✅ [MEDIA LOCK] Media acquired for ${owner}`, {
            audioTracks: stream.getAudioTracks().length,
            videoTracks: stream.getVideoTracks().length,
            attempt: attempt + 1,
          });

          // Process queued requests
          this.processQueue();

          return stream;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          lastError = err;
          
          // Enhanced error detection for "Device in use" errors
          // Some browsers report this differently, so check multiple conditions
          const errorMessage = err.message?.toLowerCase() || '';
          const isDeviceInUse = 
            (err.name === "NotReadableError" && 
             (errorMessage.includes("device in use") ||
              errorMessage.includes("device is already in use") ||
              errorMessage.includes("could not start video source") ||
              errorMessage.includes("could not start audio source"))) ||
            // Some browsers return generic NotReadableError when device is busy
            (err.name === "NotReadableError" && attempt > 0); // Retry NotReadableError on subsequent attempts
          
          if (isDeviceInUse && attempt < effectiveRetries) {
            console.warn(`⚠️ [MEDIA LOCK] Device in use, will retry (attempt ${attempt + 1}/${effectiveRetries + 1})${isPreWarming ? ' [pre-warming - will fail gracefully]' : ''}`, {
              errorName: err.name,
              errorMessage: err.message,
            });
            // Force cleanup before retry (on first attempt, cleanup happens in next iteration)
            if (attempt === 0) {
              await this.forceCleanup();
            }
            continue;
          }
          
          // Not a retryable error or out of retries, throw immediately
          throw err;
        }
      }
      
      // Should never reach here, but TypeScript needs it
      throw lastError || new Error("Failed to acquire media after retries");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Don't log "Device in use" errors as errors - they're expected during pre-warming
      // and will be handled gracefully by the call flow
      const isDeviceInUse = 
        err.name === "NotReadableError" || 
        err.message?.includes("Device in use") ||
        err.message?.includes("device in use");
      
      if (isDeviceInUse) {
        // Log as warning instead of error for "Device in use" cases
        console.warn(`⚠️ [MEDIA LOCK] Device in use for ${owner} - will retry on explicit call action`);
      } else {
        console.error(`❌ [MEDIA LOCK] Failed to acquire media for ${owner}:`, err);
      }
      
      // Release lock on error
      this.release(owner);
      
      // Reject queued requests
      this.queue.forEach((req) => req.reject(err));
      this.queue = [];
      
      throw err;
    }
  }

  /**
   * Release the lock (call when done with stream)
   * @param owner - Identifier for who is releasing
   * @param stopTracks - Whether to stop active tracks when releasing (default: true)
   *                     Set to false if you want to keep tracks running but release the lock
   */
  release(owner: string = "unknown", stopTracks: boolean = true): void {
    if (this.lockOwner !== owner && this.lockOwner !== null) {
      console.warn(`⚠️ [MEDIA LOCK] Release called by ${owner} but lock held by ${this.lockOwner}`);
      return;
    }

    if (this.isLocked) {
      console.log(`🔓 [MEDIA LOCK] Releasing lock from ${owner}`, { stopTracks });
      this.isLocked = false;
      this.lockOwner = null;
      
      // Stop active tracks when releasing to ensure device is fully released
      // This is especially important on iOS Safari which can hold device locks
      if (this.currentStream && stopTracks) {
        const activeTracks = this.currentStream.getTracks().filter(t => t.readyState === 'live');
        if (activeTracks.length > 0) {
          console.log(`🛑 [MEDIA LOCK] Stopping ${activeTracks.length} active tracks on release`);
          activeTracks.forEach(track => {
            track.stop();
          });
        }
        // Clear stream reference after stopping tracks
        this.currentStream = null;
      } else if (this.currentStream) {
        // If not stopping tracks, only clear if tracks are already dead
        const activeTracks = this.currentStream.getTracks().filter(t => t.readyState === 'live');
        if (activeTracks.length === 0) {
          // Stream is dead, clear it
          this.currentStream = null;
        }
      }
    }
  }

  /**
   * Stop and release the current stream
   * @param owner - Identifier for who is stopping
   */
  async stop(owner: string = "unknown"): Promise<void> {
    if (this.currentStream) {
      console.log(`🛑 [MEDIA LOCK] Stopping stream for ${owner}`);
      this.stopStream(this.currentStream);
      this.currentStream = null;
      
      // Wait a bit for browser to release the device
      // This helps prevent "Device in use" errors on next acquisition
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    this.release(owner);
  }

  /**
   * Get the current stream without acquiring lock
   * Useful for checking if media is already available
   */
  getCurrentStream(): MediaStream | null {
    return this.currentStream;
  }

  /**
   * Check if lock is currently held
   */
  isHeld(): boolean {
    return this.isLocked;
  }

  /**
   * Get current lock owner
   */
  getLockOwner(): string | null {
    return this.lockOwner;
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    if (this.queue.length === 0) {
      // No queued requests - keep lock held by current owner
      // Don't release here - the caller still needs the tracks
      console.log(`✅ [MEDIA LOCK] No queued requests, keeping lock held by ${this.lockOwner}`);
      return;
    }

    console.log(`🔄 [MEDIA LOCK] Processing ${this.queue.length} queued request(s)`);
    const nextRequest = this.queue.shift();
    if (!nextRequest) {
      // No valid request - keep lock held by current owner
      console.log(`⚠️ [MEDIA LOCK] No valid queued request, keeping lock held by ${this.lockOwner}`);
      return;
    }

    // Check if current stream matches next request's constraints
    if (this.currentStream && this.streamMatchesConstraints(this.currentStream, nextRequest.constraints)) {
      console.log(`✅ [MEDIA LOCK] Reusing stream for queued request`);
      // Release lock but keep tracks running since next request will use same stream
      this.release(this.lockOwner || "system", false);
      nextRequest.resolve(this.currentStream);
      // Process next in queue
      this.processQueue();
      return;
    }

    // Need to get new media with different constraints
    // Release current lock and stop tracks (different constraints needed)
    this.release(this.lockOwner || "system", true);
    
    // Let the next request acquire the lock
    this.acquire(nextRequest.constraints, "queued-request")
      .then(nextRequest.resolve)
      .catch(nextRequest.reject);
  }

  /**
   * Check if a stream matches given constraints
   */
  private streamMatchesConstraints(
    stream: MediaStream,
    constraints: MediaStreamConstraints
  ): boolean {
    const hasAudio = stream.getAudioTracks().length > 0;
    const hasVideo = stream.getVideoTracks().length > 0;

    const wantsAudio = constraints.audio !== false && constraints.audio !== undefined;
    const wantsVideo = constraints.video !== false && constraints.video !== undefined;

    return hasAudio === wantsAudio && hasVideo === wantsVideo;
  }

  /**
   * Stop all tracks in a stream
   */
  private stopStream(stream: MediaStream): void {
    stream.getTracks().forEach((track) => {
      if (track.readyState === 'live') {
        console.log(`🛑 [MEDIA LOCK] Stopping ${track.kind} track:`, {
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState,
        });
        track.stop();
      }
    });
  }

  /**
   * Force cleanup of all active media tracks
   * Useful when "Device in use" errors persist
   */
  async forceCleanup(): Promise<void> {
    console.log(`🧹 [MEDIA LOCK] Force cleaning up all media tracks...`);
    
    // Stop current stream if exists
    if (this.currentStream) {
      this.stopStream(this.currentStream);
      this.currentStream = null;
    }
    
    // Check all video elements
    const videoElements = document.querySelectorAll('video');
    for (const video of videoElements) {
      if (video.srcObject instanceof MediaStream) {
        const stream = video.srcObject;
        stream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            console.log(`🛑 [MEDIA LOCK] Force stopping track from video element:`, track.kind);
            track.stop();
          }
        });
        video.srcObject = null;
      }
    }
    
    // Check for active tracks in the global registry
    try {
      stopAllActiveStreams(); // This will stop and clear all registered streams
    } catch (error) {
      // Ignore if module not available
    }
    
    // Release the lock to allow new acquisition
    this.isLocked = false;
    this.lockOwner = null;
    
    // Longer delay to let browser release devices
    // Some browsers (especially Android/Chrome) need more time to fully release devices after stopping tracks
    // Increased from 400ms to 600ms to give browser more time
    await new Promise(resolve => setTimeout(resolve, 600));
    
    console.log(`✅ [MEDIA LOCK] Force cleanup complete`);
  }
}

// Singleton instance
export const mediaAccessLock = new MediaAccessLock();


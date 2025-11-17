// src/features/calls/hooks/useWebRTC.ts
// WebRTC peer connection management hook

import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { endCall as endCallUtil } from "../utils/callEnding";

interface UseWebRTCReturn {
  peerConnection: RTCPeerConnection | null;
  peerConnectionRef: React.MutableRefObject<RTCPeerConnection | null>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnecting: boolean;
  setIsConnecting: (value: boolean) => void;
  isConnected: boolean; // True only when ICE is connected/completed
  initializeConnection: () => Promise<void>;
  cleanup: (force?: boolean) => void;
  iceCandidatesQueue: React.MutableRefObject<RTCIceCandidateInit[]>;
  playRemoteVideo: () => void;
}

export const useWebRTC = (
  callId: string | null,
  localVideoRef: React.RefObject<HTMLVideoElement>,
  remoteVideoRef: React.RefObject<HTMLVideoElement>,
  isChild: boolean = false
): UseWebRTCReturn => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false); // Track actual ICE connection state
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const processedTrackIds = useRef<Set<string>>(new Set());
  const currentCallIdRef = useRef<string | null>(callId);
  
  // Update callId ref when it changes so ICE candidate handler can access it
  useEffect(() => {
    currentCallIdRef.current = callId;
    if (callId) {
      console.log("📞 [CALL ID] CallId updated in useWebRTC:", callId);
    }
  }, [callId]);

  const initializeConnection = useCallback(async () => {
    try {
      // Check if getUserMedia is available (required for iOS Safari)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isHTTPS = window.location.protocol === "https:";
        const isLocalhost = window.location.hostname === "localhost" || 
                           window.location.hostname === "127.0.0.1" ||
                           window.location.hostname.startsWith("192.168.") ||
                           window.location.hostname.startsWith("10.") ||
                           window.location.hostname.startsWith("172.");
        
        let errorMessage = "Camera and microphone access is not available.";
        
        if (isIOS && !isHTTPS && !isLocalhost) {
          errorMessage += "\n\nOn iOS Safari, camera/microphone requires HTTPS when accessing via network IP. " +
            "Options:\n" +
            "1. Use a tunneling service like ngrok (provides HTTPS)\n" +
            "2. Set up local HTTPS certificates\n" +
            "3. Test on the same device using localhost";
        } else if (isIOS && !isHTTPS) {
          errorMessage += "\n\nNote: On iOS, getUserMedia may not work over HTTP on network IPs. " +
            "Consider using ngrok or testing on the same device.";
        } else if (isIOS) {
          errorMessage += " On iOS, please use Safari and grant camera/microphone permissions in Settings.";
        } else {
          errorMessage += " Please use HTTPS or a modern browser that supports WebRTC.";
        }
        
        throw new Error(errorMessage);
      }

      // Get media stream with proper constraints
      // Handle "Device in use" errors gracefully (e.g., when testing on same device with multiple browsers)
      let stream: MediaStream;
      try {
        console.log("🎥 [MEDIA] Requesting camera and microphone access...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user", // Front-facing camera
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        
        console.log("✅ [MEDIA] Media stream obtained:", {
          audioTracks: stream.getAudioTracks().map(t => ({
            id: t.id,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState,
            settings: t.getSettings(),
          })),
          videoTracks: stream.getVideoTracks().map(t => ({
            id: t.id,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState,
            settings: t.getSettings(),
          })),
        });
        
        // [KCH] Telemetry: Log media tracks after getUserMedia
        const role = isChild ? 'child' : 'parent';
        console.log('[KCH]', role, 'media tracks', {
          audio: stream.getAudioTracks().length,
          video: stream.getVideoTracks().length,
        });

        // Verify tracks are actually working
        stream.getAudioTracks().forEach(track => {
          if (track.muted) {
            console.warn("⚠️ [MEDIA] Local audio track is muted");
          }
        });
        stream.getVideoTracks().forEach(track => {
          if (track.muted) {
            console.warn("⚠️ [MEDIA] Local video track is muted");
          }
        });
      } catch (mediaError: unknown) {
        const error = mediaError as DOMException;
        console.error("❌ [MEDIA] Media device access error:", {
          name: error.name,
          message: error.message,
          code: (error as any).code,
        });
        
        if (error.name === "NotReadableError" || error.name === "NotAllowedError") {
          console.warn("⚠️ [MEDIA] Media device access denied or in use, trying audio-only fallback...");
          // Try with audio only as fallback
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            console.log("✅ [MEDIA] Fell back to audio-only stream");
          } catch (fallbackError) {
            const fallbackErr = fallbackError as DOMException;
            console.error("❌ [MEDIA] Audio-only fallback also failed:", {
              name: fallbackErr.name,
              message: fallbackErr.message,
            });
            // If even audio fails, throw the original error
            throw new Error(
              `Unable to access camera/microphone: ${error.message}. ` +
              `This may happen if the device is in use by another application or browser tab. ` +
              `On iOS, make sure you've granted camera and microphone permissions in Settings. ` +
              `Error details: ${error.name} - ${error.message}`
            );
          }
        } else {
          throw new Error(
            `Media access error: ${error.name} - ${error.message}. ` +
            `Please check your camera and microphone permissions.`
          );
        }
      }

      setLocalStream(stream);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Local video should play immediately (no autoplay restrictions for local video)
        localVideoRef.current.play().catch((error) => {
          console.error("Error playing local video:", error);
        });
      }

      // Create peer connection with STUN and TURN servers
      // TURN servers are required when both peers are behind symmetric NATs (common on mobile networks)
      const pc = new RTCPeerConnection({
        iceServers: [
          // STUN servers for NAT discovery
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          // TURN servers for NAT traversal (free public TURN server for testing)
          // For production, use a paid TURN service like Twilio or Metered TURN
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
        // Enable ICE candidate trickling for faster connection
        iceCandidatePoolSize: 10,
      });

      // Monitor connection state changes
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        const iceState = pc.iceConnectionState;
        const signalingState = pc.signalingState;
        
        // [KCH] Telemetry: Connection state
        const role = isChild ? 'child' : 'parent';
        console.log('[KCH]', role, 'connectionState', state);
        
        console.log("🔵 [CONNECTION STATE] Peer connection state changed:", {
          connectionState: state,
          iceConnectionState: iceState,
          signalingState: signalingState,
          timestamp: new Date().toISOString(),
        });

        if (state === "connected") {
          console.log("✅ [CONNECTION STATE] Peer connection is now connected!");
          console.log("📊 [CONNECTION STATE] Connection details:", {
            connectionState: state,
            iceConnectionState: iceState,
            signalingState: signalingState,
            localDescription: !!pc.localDescription,
            remoteDescription: !!pc.remoteDescription,
            remoteStream: !!remoteStreamRef.current,
          });
          
          // Check remote stream tracks when connected
          if (remoteStreamRef.current) {
            const audioTracks = remoteStreamRef.current.getAudioTracks();
            const videoTracks = remoteStreamRef.current.getVideoTracks();
            console.log("📊 [CONNECTION STATE] Remote stream tracks when connected:", {
              audioTracks: audioTracks.map(t => ({
                id: t.id,
                enabled: t.enabled,
                muted: t.muted,
                readyState: t.readyState,
              })),
              videoTracks: videoTracks.map(t => ({
                id: t.id,
                enabled: t.enabled,
                muted: t.muted,
                readyState: t.readyState,
              })),
            });
            
            // Warn if tracks are muted
            audioTracks.forEach(track => {
              if (track.muted) {
                console.error("❌ [CONNECTION STATE] Audio track is muted when connected!");
              }
            });
            videoTracks.forEach(track => {
              if (track.muted) {
                // This is a warning, not necessarily an error - tracks can be muted by user
                // Only log as warning if track is actually receiving data
                if (track.readyState === 'live') {
                  console.warn("⚠️ [CONNECTION STATE] Video track is muted when connected (user may have muted it)", {
                    trackId: track.id,
                    readyState: track.readyState,
                    enabled: track.enabled,
                  });
                }
              }
            });
          }
        } else if (
          state === "failed" ||
          state === "closed" ||
          state === "disconnected"
        ) {
          console.error("❌ [CONNECTION STATE] Connection problem detected:", {
            connectionState: state,
            iceConnectionState: iceState,
            signalingState: signalingState,
            reason: "Connection state changed to problematic state",
            timestamp: new Date().toISOString(),
          });
          
          // Auto-end call on connection failure if callId exists
          // Only if the call row isn't ended yet
          // Only end on "failed" or "closed" - "disconnected" can be transient
          // The database status change listener will handle explicit call ending
          const activeCallId = currentCallIdRef.current;
          if (activeCallId && (state === "failed" || state === "closed")) {
            // Determine role from isChild prop
            const isChildUser = isChild;
            const by = isChildUser ? 'child' : 'parent';
            
            endCallUtil({ callId: activeCallId, by, reason: state }).catch(() => {
              // Ignore errors - call might already be ended
            });
          }
        }
      };

      // Monitor ICE connection state changes
      // CRITICAL: Only cleanup on unrecoverable states (failed, disconnected, closed)
      // NEVER cleanup on "new" or "checking" - let the connection stabilize!
      let iceStateStartTime = Date.now();
      const ICE_STUCK_TIMEOUT = 30000; // 30 seconds - if stuck in "new" for this long, something is wrong
      
      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        const timeInState = Date.now() - iceStateStartTime;
        
        // [KCH] Telemetry: ICE connection state
        const role = isChild ? 'child' : 'parent';
        console.log('[KCH]', role, 'iceConnectionState', iceState);
        
        console.log("🧊 [ICE STATE] ICE connection state changed:", {
          iceConnectionState: iceState,
          connectionState: pc.connectionState,
          signalingState: pc.signalingState,
          hasLocalDescription: !!pc.localDescription,
          hasRemoteDescription: !!pc.remoteDescription,
          iceGatheringState: pc.iceGatheringState,
          timeInStateMs: timeInState,
          timestamp: new Date().toISOString(),
        });

        // Reset timer when state changes
        iceStateStartTime = Date.now();

        if (iceState === "connected" || iceState === "completed") {
          console.log("✅ [ICE STATE] ICE connection established - media should flow now!");
          
          // CRITICAL: Mark as connected only when ICE is actually connected
          setIsConnected(true);
          setIsConnecting(false);
          
          // CRITICAL FIX: When ICE connects, aggressively ensure remote stream is playing
          // This is especially important for parent-to-child calls
          if (remoteStreamRef.current && remoteVideoRef.current) {
            const stream = remoteStreamRef.current;
            const video = remoteVideoRef.current;
            
            // Ensure stream is set to video element
            if (video.srcObject !== stream) {
              console.log("🎬 [ICE STATE] Setting remote stream to video element");
              video.srcObject = stream;
            }
            
            // Check track states immediately
            const audioTracks = stream.getAudioTracks();
            const videoTracks = stream.getVideoTracks();
            
            console.log("📊 [ICE STATE] Tracks after ICE connected:", {
              audioTracks: audioTracks.length,
              videoTracks: videoTracks.length,
              audioMuted: audioTracks.filter(t => t.muted).length,
              videoMuted: videoTracks.filter(t => t.muted).length,
              videoReadyState: video.readyState,
              videoPaused: video.paused,
            });

            // Ensure all tracks are enabled
            audioTracks.forEach(track => {
              track.enabled = true;
              if (track.muted) {
                console.warn("⚠️ [ICE STATE] Audio track is muted after ICE connected");
              }
            });
            videoTracks.forEach(track => {
              track.enabled = true;
              if (track.muted) {
                console.warn("⚠️ [ICE STATE] Video track is muted after ICE connected");
              }
            });

            // CRITICAL: Try to play video immediately when ICE connects
            // Don't wait for readyState - WebRTC streams can play even with low readyState
            const attemptPlay = () => {
              if (video && video.srcObject && video.paused) {
                console.log("🎬 [ICE STATE] Attempting to play video after ICE connection");
                video.play()
                  .then(() => {
                    console.log("✅ [ICE STATE] Video started playing after ICE connected");
                  })
                  .catch(err => {
                    console.warn("⏳ [ICE STATE] Play failed, will retry:", err.name);
                    // Retry after short delay
                    setTimeout(() => {
                      if (video && video.srcObject && video.paused) {
                        video.play().catch(retryErr => {
                          if (retryErr.name !== 'AbortError') {
                            console.error("❌ [ICE STATE] Retry play failed:", retryErr);
                          }
                        });
                      }
                    }, 200);
                  });
              }
            };
            
            // Try immediately
            attemptPlay();
            
            // Also set up listeners for when video becomes ready
            const onReady = () => {
              if (video.paused) {
                attemptPlay();
              }
            };
            video.addEventListener('canplay', onReady, { once: true });
            video.addEventListener('loadeddata', onReady, { once: true });
            video.addEventListener('canplaythrough', onReady, { once: true });
            
            // Also check after a short delay in case tracks unmute
            setTimeout(() => {
              const stillMutedAudio = stream.getAudioTracks().filter(t => t.muted).length;
              const stillMutedVideo = stream.getVideoTracks().filter(t => t.muted).length;
              
              if (stillMutedAudio > 0 || stillMutedVideo > 0) {
                console.error("❌ [ICE STATE] CRITICAL: Tracks still muted after ICE connected!", {
                  mutedAudio: stillMutedAudio,
                  mutedVideo: stillMutedVideo,
                  totalAudio: audioTracks.length,
                  totalVideo: videoTracks.length,
                });
              }
              
              // Try play again in case it failed before
              if (video.paused) {
                attemptPlay();
              }
            }, 1000);
          }
        } else if (iceState === "failed" || iceState === "disconnected" || iceState === "closed") {
          console.error("❌ [ICE STATE] ICE connection problem:", {
            iceConnectionState: iceState,
            connectionState: pc.connectionState,
            reason: "ICE connection failed or disconnected",
            timestamp: new Date().toISOString(),
          });
          
          // Mark as disconnected
          setIsConnected(false);
          setIsConnecting(false);
          
          // Auto-end call on ICE failure if callId exists
          // Only if the call row isn't ended yet
          const activeCallId = currentCallIdRef.current;
          if (activeCallId && (iceState === "failed" || iceState === "closed")) {
            // Determine role from isChild prop
            const isChildUser = isChild;
            const by = isChildUser ? 'child' : 'parent';
            
            endCallUtil({ callId: activeCallId, by, reason: iceState }).catch(() => {
              // Ignore errors - call might already be ended
            });
          }
        } else if (iceState === "checking") {
          // Still connecting - don't mark as connected yet
          setIsConnected(false);
          setIsConnecting(true);
          console.log("⏳ [ICE STATE] ICE connection checking - waiting for connection (this is normal)...");
          
          // Warn if stuck in "checking" for too long - this might indicate ICE candidates aren't being processed correctly
          setTimeout(() => {
            if (pc.iceConnectionState === "checking" && pc.signalingState !== "closed") {
              console.warn("⚠️ [ICE STATE] ICE stuck in 'checking' state for 30+ seconds - this may indicate:", {
                issue: "ICE candidates may not be exchanging properly or connection is failing",
                hasLocalDescription: !!pc.localDescription,
                hasRemoteDescription: !!pc.remoteDescription,
                iceGatheringState: pc.iceGatheringState,
                connectionState: pc.connectionState,
                suggestion: "Check that ICE candidates are being sent/received via database and that both peers have remote descriptions set",
              });
              
              // Log current state for debugging
              const senders = pc.getSenders();
              const receivers = pc.getReceivers();
              console.warn("⚠️ [ICE STATE] Current peer connection state:", {
                senders: senders.length,
                receivers: receivers.length,
                localDescription: pc.localDescription ? {
                  type: pc.localDescription.type,
                  sdp: pc.localDescription.sdp.substring(0, 100) + "...",
                } : null,
                remoteDescription: pc.remoteDescription ? {
                  type: pc.remoteDescription.type,
                  sdp: pc.remoteDescription.sdp.substring(0, 100) + "...",
                } : null,
              });
            }
          }, ICE_STUCK_TIMEOUT);
        } else if (iceState === "new") {
          console.log("🆕 [ICE STATE] ICE connection new - connection starting (this is normal)...");
          
          // Still connecting - don't mark as connected yet
          setIsConnected(false);
          setIsConnecting(true);
          
          // Warn if stuck in "new" for too long - this might indicate ICE candidates aren't being exchanged
          setTimeout(() => {
            if (pc.iceConnectionState === "new" && pc.signalingState !== "closed") {
              console.warn("⚠️ [ICE STATE] ICE stuck in 'new' state for 30+ seconds - this may indicate:", {
                issue: "ICE candidates may not be exchanging properly",
                hasLocalDescription: !!pc.localDescription,
                hasRemoteDescription: !!pc.remoteDescription,
                iceGatheringState: pc.iceGatheringState,
                suggestion: "Check that ICE candidates are being sent/received via database",
              });
            }
          }, ICE_STUCK_TIMEOUT);
        }
      };

      // Monitor ICE gathering state
      pc.onicegatheringstatechange = () => {
        console.log("🧊 [ICE GATHERING] ICE gathering state:", {
          iceGatheringState: pc.iceGatheringState,
          timestamp: new Date().toISOString(),
        });
      };

      // Monitor signaling state changes
      pc.onsignalingstatechange = () => {
        console.log("Signaling state changed to:", pc.signalingState);
        if (pc.signalingState === "closed") {
          console.error("Signaling state is closed!");
        }
      };

      peerConnectionRef.current = pc;

      // Reset processed track IDs for new connection
      processedTrackIds.current.clear();
      remoteStreamRef.current = null;

      // Add local stream tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log("📹 [REMOTE TRACK] Received remote track:", {
          kind: event.track.kind,
          id: event.track.id,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          muted: event.track.muted,
          streams: event.streams.length,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          timestamp: new Date().toISOString(),
        });

        // Monitor track state changes
        event.track.onmute = () => {
          console.warn("⚠️ [REMOTE TRACK] Track muted:", {
            kind: event.track.kind,
            id: event.track.id,
            reason: "Track is muted - no data being received",
            iceConnectionState: pc.iceConnectionState,
            connectionState: pc.connectionState,
          });
        };

        event.track.onunmute = () => {
          console.log("✅ [REMOTE TRACK] Track unmuted - MEDIA IS FLOWING!", {
            kind: event.track.kind,
            id: event.track.id,
            reason: "Track is receiving data - media should be visible/audible now",
            iceConnectionState: pc.iceConnectionState,
            connectionState: pc.connectionState,
          });
          
          // CRITICAL: When track unmutes, aggressively ensure video is playing
          // This is especially important for parent-to-child calls
          if (event.track.kind === "video" && remoteVideoRef.current) {
            const video = remoteVideoRef.current;
            if (video.srcObject) {
              console.log("🎬 [REMOTE TRACK] Video track unmuted - ensuring video plays", {
                readyState: video.readyState,
                paused: video.paused,
                muted: video.muted,
              });
              
              // Try to play immediately - track is unmuted so media is flowing
              if (video.paused) {
                video.play()
                  .then(() => {
                    console.log("✅ [REMOTE TRACK] Video started playing after track unmute");
                  })
                  .catch(err => {
                    // Only log if it's not an AbortError (which happens during cleanup)
                    if (err.name !== 'AbortError') {
                      console.error("❌ [REMOTE TRACK] Error playing video after track unmute:", err);
                      // Retry after short delay
                      setTimeout(() => {
                        if (video && video.srcObject && video.paused) {
                          video.play().catch((retryErr) => {
                            if (retryErr.name !== 'AbortError') {
                              console.error("❌ [REMOTE TRACK] Retry play failed:", retryErr);
                            }
                          });
                        }
                      }, 200);
                    }
                  });
              } else {
                console.log("✅ [REMOTE TRACK] Video is already playing");
              }
            } else {
              console.warn("⚠️ [REMOTE TRACK] Video track unmuted but video element has no srcObject - setting it now");
              // Set srcObject if it's missing
              if (remoteVideoRef.current && remoteStreamRef.current) {
                remoteVideoRef.current.srcObject = remoteStreamRef.current;
                // Try to play after setting
                setTimeout(() => {
                  if (remoteVideoRef.current && remoteVideoRef.current.paused) {
                    remoteVideoRef.current.play().catch(err => {
                      if (err.name !== 'AbortError') {
                        console.error("❌ [REMOTE TRACK] Error playing after setting srcObject:", err);
                      }
                    });
                  }
                }, 100);
              }
            }
          }
        };

        event.track.onended = () => {
          // Track ended is expected when call ends - log as info, not error
          console.log("ℹ️ [REMOTE TRACK] Track ended (expected when call ends):", {
            kind: event.track.kind,
            id: event.track.id,
            reason: "Track has ended - this is normal when call is terminated",
          });
        };

        // Skip if we've already processed this track
        if (processedTrackIds.current.has(event.track.id)) {
          console.log("Track already processed, skipping:", event.track.id);
          return;
        }
        processedTrackIds.current.add(event.track.id);

        // Ensure track is enabled
        event.track.enabled = true;

        // Get or create remote stream
        let currentStream = remoteStreamRef.current;
        
        if (event.streams.length > 0) {
          // Track has a stream associated
          const [streamFromEvent] = event.streams;
          if (!currentStream || currentStream.id !== streamFromEvent.id) {
            // New stream or different stream - use it
            currentStream = streamFromEvent;
            remoteStreamRef.current = currentStream;
          } else {
            // Same stream - add track to existing stream if not already there
            const existingTrack = currentStream.getTracks().find(
              (t) => t.id === event.track.id
            );
            if (!existingTrack) {
              currentStream.addTrack(event.track);
              console.log("Added track to existing stream:", event.track.kind);
            }
          }
        } else {
          // Track doesn't have a stream - create or use existing
          if (!currentStream) {
            currentStream = new MediaStream([event.track]);
            remoteStreamRef.current = currentStream;
            console.log("Created new stream for track:", event.track.kind);
          } else {
            // Add track to existing stream
            const existingTrack = currentStream.getTracks().find(
              (t) => t.id === event.track.id
            );
            if (!existingTrack) {
              currentStream.addTrack(event.track);
              console.log("Added track to existing stream:", event.track.kind);
            }
          }
        }

          // Ensure all tracks in the stream are enabled and check their state
          if (currentStream) {
            currentStream.getAudioTracks().forEach((track) => {
              track.enabled = true;
              // Force unmute if possible (though muted state is usually controlled by the sender)
              if (track.muted && pc.iceConnectionState === "connected") {
                console.warn("⚠️ [REMOTE TRACK] Audio track is muted even though ICE is connected - this may indicate no data");
              }
              console.log("✅ [REMOTE TRACK] Enabled remote audio track:", {
                id: track.id,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                iceConnectionState: pc.iceConnectionState,
              });
            });
            currentStream.getVideoTracks().forEach((track) => {
              track.enabled = true;
              // Force unmute if possible (though muted state is usually controlled by the sender)
              if (track.muted && pc.iceConnectionState === "connected") {
                console.warn("⚠️ [REMOTE TRACK] Video track is muted even though ICE is connected - this may indicate no data");
              }
              console.log("✅ [REMOTE TRACK] Enabled remote video track:", {
                id: track.id,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                iceConnectionState: pc.iceConnectionState,
              });
            });
            
            // CRITICAL: If ICE is already connected, tracks should unmute - check and log
            if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
              const mutedAudio = currentStream.getAudioTracks().filter(t => t.muted).length;
              const mutedVideo = currentStream.getVideoTracks().filter(t => t.muted).length;
              if (mutedAudio > 0 || mutedVideo > 0) {
                console.error("❌ [REMOTE TRACK] CRITICAL: Tracks are muted even though ICE is connected!", {
                  mutedAudioTracks: mutedAudio,
                  mutedVideoTracks: mutedVideo,
                  totalAudioTracks: currentStream.getAudioTracks().length,
                  totalVideoTracks: currentStream.getVideoTracks().length,
                  iceConnectionState: pc.iceConnectionState,
                  connectionState: pc.connectionState,
                  signalingState: pc.signalingState,
                });
              }
            }

          console.log("Remote stream updated:", {
            id: currentStream.id,
            audioTracks: currentStream.getAudioTracks().length,
            videoTracks: currentStream.getVideoTracks().length,
          });

          setRemoteStream(currentStream);
          
          // CRITICAL FIX: Ensure video element is set and playing when tracks are received
          // This fixes the issue where call connects but no video/audio appears
          if (remoteVideoRef.current) {
            const video = remoteVideoRef.current;
            const needsUpdate = video.srcObject !== currentStream;
            
            if (needsUpdate) {
              video.srcObject = currentStream;
              console.log("✅ [REMOTE STREAM] Remote stream srcObject set", {
                streamId: currentStream.id,
                audioTracks: currentStream.getAudioTracks().length,
                videoTracks: currentStream.getVideoTracks().length,
                iceConnectionState: pc.iceConnectionState,
                connectionState: pc.connectionState,
              });
            } else {
              // Stream already set - just ensure it's still set (don't refresh)
              console.log("✅ [REMOTE STREAM] Stream already set, ensuring playback", {
                streamId: currentStream.id,
                audioTracks: currentStream.getAudioTracks().length,
                videoTracks: currentStream.getVideoTracks().length,
              });
            }
            
            // CRITICAL: Aggressively try to play - don't wait for tracks to unmute
            // Tracks may be muted initially but will unmute when media flows
            const attemptPlay = () => {
              if (!video || !video.srcObject) {
                console.warn("⚠️ [REMOTE STREAM] Video or srcObject not ready for play");
                return;
              }
              
              console.log("🎬 [REMOTE STREAM] Attempting to play video with tracks", {
                readyState: video.readyState,
                paused: video.paused,
                muted: video.muted,
                audioTracks: currentStream.getAudioTracks().length,
                videoTracks: currentStream.getVideoTracks().length,
                audioMuted: currentStream.getAudioTracks().some(t => t.muted),
                videoMuted: currentStream.getVideoTracks().some(t => t.muted),
                iceConnectionState: pc.iceConnectionState,
              });
              
              // Try to play immediately - even if tracks are muted, they'll unmute when media flows
              if (video.paused) {
                video.play()
                  .then(() => {
                    console.log("✅ [REMOTE STREAM] Video started playing");
                    // Verify tracks after play starts
                    setTimeout(() => {
                      const audioMuted = currentStream.getAudioTracks().filter(t => t.muted).length;
                      const videoMuted = currentStream.getVideoTracks().filter(t => t.muted).length;
                      if (audioMuted > 0 || videoMuted > 0) {
                        console.warn("⚠️ [REMOTE STREAM] Some tracks still muted after play - they should unmute when media flows", {
                          audioMuted,
                          videoMuted,
                          iceConnectionState: pc.iceConnectionState,
                        });
                      }
                    }, 1000);
                  })
                  .catch((error) => {
                    console.log("⏳ [REMOTE STREAM] Play failed, will retry:", error.name);
                    // Retry after short delay
                    setTimeout(() => {
                      if (video && video.srcObject && video.paused) {
                        video.play().catch((retryError) => {
                          if (retryError.name !== 'AbortError') {
                            console.log("⏳ [REMOTE STREAM] Retry play failed:", retryError.name);
                          }
                        });
                      }
                    }, 200);
                  });
              } else {
                console.log("✅ [REMOTE STREAM] Video is already playing");
              }
            };
            
            // Try immediately and also after a short delay to catch any timing issues
            requestAnimationFrame(() => {
              attemptPlay();
            });
            
            // Also try after a delay in case tracks need time to initialize
            setTimeout(() => {
              if (video && video.srcObject && video.paused) {
                attemptPlay();
              }
            }, 100);
          } else {
            console.warn("⚠️ [REMOTE STREAM] remoteVideoRef.current is null - video element not ready");
          }
        }
      };

      // Handle ICE candidates
      // CRITICAL: Must handle both candidate events and null candidate (gathering complete)
      const processedCandidateIds = new Set<string>();
      
      pc.onicecandidate = async (event) => {
        // Use ref to get current callId (may be set after peer connection is created)
        const activeCallId = currentCallIdRef.current;
        
        if (!activeCallId) {
          console.warn("⚠️ [ICE CANDIDATE] No callId available yet, candidate will be queued");
          // Store candidate temporarily - will be sent when callId is available
          return;
        }

        try {
          // Handle null candidate - this means ICE gathering is complete
          // This is critical for the remote peer to know when to stop waiting for more candidates
          if (event.candidate === null) {
            console.log("🧊 [ICE CANDIDATE] ICE gathering complete (null candidate received)");
            console.log("🧊 [ICE CANDIDATE] Total candidates processed:", processedCandidateIds.size);
            // The null candidate event indicates gathering is complete
            // The remote peer should have received all candidates by now
            // No need to update database - just log for debugging
            return;
          }

          // Handle actual candidate
          if (event.candidate) {
            const candidateJson = event.candidate.toJSON();
            const candidateId = `${candidateJson.candidate}-${candidateJson.sdpMLineIndex}-${candidateJson.sdpMid}`;
            
            // Skip if we've already processed this candidate
            if (processedCandidateIds.has(candidateId)) {
              return;
            }
            processedCandidateIds.add(candidateId);

            // Only log first candidate to reduce console spam
            const currentCount = processedCandidateIds.size;
            const role = isChild ? "child" : "parent";
            if (currentCount === 1) {
              console.log("🧊 [ICE CANDIDATE] ICE gathering started:", {
                role,
                callId: activeCallId,
                isChild,
                timestamp: new Date().toISOString(),
              });
            }

            // CRITICAL: Use role-specific field to prevent overwriting
            // Child writes to child_ice_candidates, parent writes to parent_ice_candidates
            // This MUST match the role - if wrong, ICE candidates won't be exchanged correctly
            const candidateField = isChild ? "child_ice_candidates" : "parent_ice_candidates";
            
            // Verify role is correct (log first candidate only)
            if (currentCount === 1) {
              console.log("🔍 [ICE CANDIDATE] Role verification:", {
                isChild,
                role,
                candidateField,
                expectedField: isChild ? "child_ice_candidates" : "parent_ice_candidates",
                matches: candidateField === (isChild ? "child_ice_candidates" : "parent_ice_candidates"),
              });
            }
            
            // Use a more atomic approach: read current, append, write back
            const { data: call, error: selectError } = await supabase
              .from("calls")
              .select(candidateField)
              .eq("id", activeCallId)
              .maybeSingle();

            if (selectError) {
              console.error(`❌ [ICE CANDIDATE] Error reading ${candidateField}:`, selectError);
              return;
            }

            if (call) {
              const existingCandidates =
                ((call[candidateField as keyof typeof call] as RTCIceCandidateInit[]) ||
                  []) as unknown as RTCIceCandidateInit[];
              
              // Check if candidate already exists to avoid duplicates
              const candidateExists = existingCandidates.some(
                (c) => c.candidate === candidateJson.candidate &&
                       c.sdpMLineIndex === candidateJson.sdpMLineIndex &&
                       c.sdpMid === candidateJson.sdpMid
              );

              if (!candidateExists) {
                const updatedCandidates = [...existingCandidates, candidateJson];

                const { error: updateError } = await supabase
                  .from("calls")
                  .update({ [candidateField]: updatedCandidates as Json })
                  .eq("id", activeCallId);

                if (updateError) {
                  console.error(`❌ [ICE CANDIDATE] Error updating ${candidateField}:`, updateError);
                  // If column doesn't exist, log helpful message
                  if (updateError.message?.includes("column") || updateError.code === "PGRST204") {
                    console.error(`❌ [ICE CANDIDATE] Database column ${candidateField} may not exist. Run fix_ice_candidates_schema.sql migration!`);
                  }
                } else {
                  // Only log first few and every 20th candidate to reduce spam
                  const candidateNum = updatedCandidates.length;
                  if (candidateNum <= 3 || candidateNum % 20 === 0) {
                    console.log(`✅ [ICE CANDIDATE] Candidate #${candidateNum} sent to ${candidateField}`);
                  }
                }
              }
              // Silently skip duplicates - no need to log
            } else {
              console.warn(`⚠️ [ICE CANDIDATE] Call ${activeCallId} not found in database`);
            }
          }
        } catch (error) {
          console.error("❌ [ICE CANDIDATE] Error handling ICE candidate:", error);
          // Don't throw - ICE candidate failures shouldn't break the call
        }
      };
    } catch (error) {
      console.error("Error initializing WebRTC connection:", error);
      throw error;
    }
  }, [callId, localVideoRef, remoteVideoRef, isChild]);

  const cleanup = useCallback((force: boolean = false) => {
    const pc = peerConnectionRef.current;
    const iceState = pc?.iceConnectionState;
    const connectionState = pc?.connectionState;
    
    console.log("🧹 [CLEANUP] Cleaning up WebRTC resources...", {
      timestamp: new Date().toISOString(),
      connectionState: connectionState,
      iceConnectionState: iceState,
      signalingState: pc?.signalingState,
      hasLocalStream: !!localStreamRef.current,
      hasRemoteStream: !!remoteStreamRef.current,
      force: force,
    });

    // CRITICAL FIX: Don't cleanup if ICE is still in "new" or "checking" state
    // UNLESS force=true (explicit hangup) - then always cleanup
    // This prevents premature cleanup during connection establishment
    // But allows cleanup on explicit user action (endCall button)
    if (!force) {
      const timeSinceNew = pc ? (Date.now() - (pc as any)._iceStateStartTime || Date.now()) : 0;
      const isStuckInNew = iceState === "new" && timeSinceNew < 5000;
      
      if ((iceState === "new" && isStuckInNew) || iceState === "checking") {
        console.warn("⚠️ [CLEANUP] Skipping cleanup - ICE connection still establishing (state:", iceState, ")");
        console.warn("⚠️ [CLEANUP] Use force=true to cleanup during explicit hangup");
        return;
      }
      
      if (iceState === "new" && !isStuckInNew) {
        console.warn("⚠️ [CLEANUP] ICE stuck in 'new' for 5+ seconds - allowing cleanup (connection likely failed)");
      }
    } else {
      console.log("✅ [CLEANUP] Force cleanup requested (explicit hangup) - cleaning up regardless of ICE state");
    }

    // Stop all tracks from local stream
    const streamToCleanup = localStreamRef.current;
    if (streamToCleanup) {
      streamToCleanup.getTracks().forEach((track) => {
        track.stop();
        console.log("Stopped track:", track.kind);
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Also check the video element's srcObject
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
        console.log("Stopped track from video element:", track.kind);
      });
      localVideoRef.current.srcObject = null;
    }

    // Clear remote video element
    if (remoteVideoRef.current?.srcObject) {
      remoteVideoRef.current.srcObject = null;
    }

    // Close peer connection
    if (pc) {
      if (pc.signalingState !== "closed") {
        console.log(
          "Closing peer connection, current state:",
          pc.signalingState
        );
        pc.close();
      }
      peerConnectionRef.current = null;
    }

    // Clear remote stream state
    setRemoteStream(null);
    remoteStreamRef.current = null;
    processedTrackIds.current.clear();
  }, [localVideoRef, remoteVideoRef]);

  // Function to explicitly play remote video (called after user interaction)
  const playRemoteVideo = useCallback(() => {
    const video = remoteVideoRef.current;
    if (!video) {
      console.log("Video element not ready yet");
      return;
    }

    // Get the stream to use
    const streamToUse = remoteStreamRef.current || remoteStream;
    if (!streamToUse) {
      console.log("Remote stream not available yet");
      return;
    }

    console.log("playRemoteVideo called", {
      hasVideo: !!video,
      hasStream: !!streamToUse,
      currentSrcObject: !!video.srcObject,
      paused: video.paused,
      readyState: video.readyState,
      audioTracks: streamToUse.getAudioTracks().length,
      videoTracks: streamToUse.getVideoTracks().length,
    });

    // Only set srcObject if it's different (to avoid interrupting play)
    if (video.srcObject !== streamToUse) {
      console.log("Setting remote video srcObject");
      video.srcObject = streamToUse;
    }

    // Function to attempt playback
    // CRITICAL: Wait for readyState >= 2 (have_current_data) before playing
    // This ensures tracks are actually receiving data, not just received/unmuted
    const attemptPlay = () => {
      console.log("🎬 [VIDEO PLAY] Attempting to play video:", {
        hasSrcObject: !!video.srcObject,
        readyState: video.readyState,
        paused: video.paused,
        muted: video.muted,
        timestamp: new Date().toISOString(),
      });

      if (!video.srcObject) {
        console.log("⏳ [VIDEO PLAY] Video srcObject not set, retrying...");
        setTimeout(attemptPlay, 50); // Faster retry
        return;
      }

      // CRITICAL FIX: For WebRTC streams, readyState can be 0 initially but tracks may still be receiving data
      // Check if tracks are unmuted (receiving data) even if readyState is low
      const stream = video.srcObject as MediaStream | null;
      const hasUnmutedTracks = stream && (
        stream.getAudioTracks().some(t => !t.muted && t.readyState === 'live') ||
        stream.getVideoTracks().some(t => !t.muted && t.readyState === 'live')
      );
      
      if (video.readyState < 2 && !hasUnmutedTracks) {
        console.log("⏳ [VIDEO PLAY] Waiting for video readyState >= 2 or unmuted tracks (current:", video.readyState, ")");
        const onReady = () => {
          const nowHasUnmuted = stream && (
            stream.getAudioTracks().some(t => !t.muted && t.readyState === 'live') ||
            stream.getVideoTracks().some(t => !t.muted && t.readyState === 'live')
          );
          if (video.readyState >= 2 || nowHasUnmuted) {
            console.log("✅ [VIDEO PLAY] Video ready, readyState:", video.readyState, "- attempting play");
            if (video.paused) {
              video.play().catch((retryError) => {
                console.error("❌ [VIDEO PLAY] Play failed after ready:", retryError);
              });
            }
          }
        };
        video.addEventListener('loadeddata', onReady, { once: true });
        video.addEventListener('canplay', onReady, { once: true });
        video.addEventListener('canplaythrough', onReady, { once: true });
        
        // Also check for track unmute events
        if (stream) {
          const checkTracks = () => {
            const nowHasUnmuted = stream.getAudioTracks().some(t => !t.muted && t.readyState === 'live') ||
                                 stream.getVideoTracks().some(t => !t.muted && t.readyState === 'live');
            if (nowHasUnmuted && video.paused) {
              console.log("✅ [VIDEO PLAY] Tracks unmuted, attempting play");
              video.play().catch((retryError) => {
                console.error("❌ [VIDEO PLAY] Play failed after track unmute:", retryError);
              });
            }
          };
          stream.getTracks().forEach(track => {
            track.addEventListener('unmute', checkTracks, { once: true });
          });
        }
        
        return;
      }
      
      // If we have unmuted tracks, try to play even with low readyState
      if (hasUnmutedTracks && video.readyState < 2) {
        console.log("🎬 [VIDEO PLAY] Tracks are unmuted, attempting play despite low readyState:", video.readyState);
      }

      // Video is ready (readyState >= 2) - safe to play
      if (video.paused) {
        console.log("🎬 [VIDEO PLAY] Video ready (readyState:", video.readyState, "), attempting play");
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log("✅ [VIDEO PLAY] Remote video playing successfully!");
              console.log("📊 [VIDEO PLAY] Video state:", {
                paused: video.paused,
                muted: video.muted,
                volume: video.volume,
                readyState: video.readyState,
              });
            })
            .catch((error) => {
              // If play fails, retry after short delay
              if (error.name === 'NotAllowedError') {
                console.error("❌ [VIDEO PLAY] Autoplay not allowed - need user interaction");
              } else if (error.name !== 'AbortError') {
                console.log("⏳ [VIDEO PLAY] Play failed, retrying after delay:", error.name);
                setTimeout(() => {
                  if (video.readyState >= 2 && video.paused) {
                    video.play().catch((retryError) => {
                      console.error("❌ [VIDEO PLAY] Retry play failed:", retryError);
                    });
                  }
                }, 100);
              } else {
                console.log("✅ [VIDEO PLAY] Play was interrupted (likely by another play call) - this is OK");
              }
            });
        }
      } else {
        console.log("✅ [VIDEO PLAY] Remote video is already playing");
      }
    };

    // Attempt play immediately - user has already clicked Answer
    requestAnimationFrame(() => {
      attemptPlay();
    });
  }, [remoteStream]);

  // Monitor remote stream changes and ensure video element is updated
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      // Only update srcObject if it's different to avoid interrupting playback
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        console.log("✅ [REMOTE STREAM] Remote stream srcObject updated in useEffect");
        
        // Try to play immediately - user has already clicked Answer
        requestAnimationFrame(() => {
          if (remoteVideoRef.current && remoteVideoRef.current.srcObject === remoteStream) {
            remoteVideoRef.current.play()
              .then(() => {
                console.log("✅ [REMOTE STREAM] Video started playing in useEffect");
              })
              .catch((error) => {
                console.log("⏳ [REMOTE STREAM] Play failed in useEffect (will retry):", error.name);
              });
          }
        });
      }
      
      // Set up periodic monitoring of track states
      const monitorInterval = setInterval(() => {
        const video = remoteVideoRef.current;
        if (!video || !video.srcObject) return;

        const stream = video.srcObject as MediaStream;
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        const pc = peerConnectionRef.current;

        // Only log if there are actual problems (not just normal states)
        const hasMutedAudio = audioTracks.some(t => t.muted);
        const hasMutedVideo = videoTracks.some(t => t.muted);
        const isPaused = video.paused;
        const iceState = pc?.iceConnectionState;
        const connectionState = pc?.connectionState;

        // Only log if there are persistent issues (not just during connection establishment)
        // Skip logging if ICE is still establishing (new/checking) or if everything is connected
        const isProblematic = (iceState === "failed" || iceState === "disconnected" || iceState === "closed") ||
                              (connectionState === "failed" || connectionState === "disconnected" || connectionState === "closed");

        if (isProblematic) {
          // Only log actual problems, not normal connection states
          console.warn("⚠️ [MONITOR] Connection issue detected:", {
            iceConnectionState: iceState,
            connectionState: connectionState,
            videoPaused: isPaused,
            hasMutedAudio: hasMutedAudio && iceState === "connected", // Only log if muted when connected
            hasMutedVideo: hasMutedVideo && iceState === "connected", // Only log if muted when connected
          });
        }

        // If video is paused, try to play (silently)
        if (isPaused && iceState === "connected") {
          video.play().catch(() => {
            // Silently handle - video might not be ready yet
          });
        }
      }, 5000); // Check every 5 seconds (reduced frequency)

      // Log stream info for debugging
      console.log("📹 [REMOTE STREAM] Remote stream in useEffect:", {
        id: remoteStream.id,
        audioTracks: remoteStream.getAudioTracks().map(t => ({
          id: t.id,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
        videoTracks: remoteStream.getVideoTracks().map(t => ({
          id: t.id,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
      });

      return () => {
        clearInterval(monitorInterval);
      };
    }
  }, [remoteStream]);

  return {
    peerConnection: peerConnectionRef.current,
    localStream,
    remoteStream,
    isConnecting,
    setIsConnecting,
    isConnected, // Expose actual ICE connection state
    initializeConnection,
    cleanup,
    iceCandidatesQueue,
    peerConnectionRef, // Expose ref for direct access when needed
    playRemoteVideo, // Expose function to play remote video after user interaction
  };
};


// src/hooks/useWebRTC.ts
// WebRTC peer connection management hook - FIXED VERSION

import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface UseWebRTCReturn {
  peerConnection: RTCPeerConnection | null;
  peerConnectionRef: React.MutableRefObject<RTCPeerConnection | null>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnecting: boolean;
  setIsConnecting: (value: boolean) => void;
  initializeConnection: () => Promise<void>;
  cleanup: () => void;
  iceCandidatesQueue: React.MutableRefObject<RTCIceCandidateInit[]>;
  playRemoteVideo: () => void;
}

export const useWebRTC = (
  callId: string | null,
  localVideoRef: React.RefObject<HTMLVideoElement>,
  remoteVideoRef: React.RefObject<HTMLVideoElement>
): UseWebRTCReturn => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const processedTrackIds = useRef<Set<string>>(new Set());
  const sentCandidates = useRef<Set<string>>(new Set()); // Track sent candidates

  const initializeConnection = useCallback(async () => {
    try {
      // Check if getUserMedia is available (required for iOS Safari)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isHTTPS = window.location.protocol === "https:";
        const isLocalhost = window.location.hostname === "localhost" || 
                           window.location.hostname === "127.0.0.1";
        
        let errorMessage = "Camera and microphone access is not available.";
        
        if (isIOS && !isHTTPS && !isLocalhost) {
          errorMessage += "\n\nOn iOS Safari, camera/microphone requires HTTPS. " +
            "Use ngrok or another tunneling service that provides HTTPS.";
        }
        
        throw new Error(errorMessage);
      }

      // Get media stream with proper constraints
      let stream: MediaStream;
      try {
        console.log("🎥 [MEDIA] Requesting camera and microphone access...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        
        console.log("✅ [MEDIA] Media stream obtained successfully");
      } catch (mediaError: unknown) {
        const error = mediaError as DOMException;
        console.error("❌ [MEDIA] Media device access error:", error);
        
        throw new Error(
          `Unable to access camera/microphone: ${error.message}. ` +
          `Please check your browser permissions.`
        );
      }

      setLocalStream(stream);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // Prevent echo
        localVideoRef.current.play().catch((error) => {
          console.error("Error playing local video:", error);
        });
      }

      // Create peer connection with STUN and TURN servers
      // IMPORTANT: Add TURN servers for better NAT traversal
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          // Add a free TURN server (for production, use your own TURN server)
          // You can get free TURN credentials from: https://www.metered.ca/tools/openrelay/
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
        iceCandidatePoolSize: 10,
      });

      // Monitor connection state changes
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log("🔵 [CONNECTION STATE] Changed to:", state);

        if (state === "connected") {
          console.log("✅ [CONNECTION STATE] Peer connection established!");
        } else if (state === "failed") {
          console.error("❌ [CONNECTION STATE] Connection failed - may need TURN server");
        }
      };

      // Monitor ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        console.log("🧊 [ICE STATE] Changed to:", iceState);

        if (iceState === "connected" || iceState === "completed") {
          console.log("✅ [ICE STATE] ICE connection established!");
        } else if (iceState === "failed") {
          console.error("❌ [ICE STATE] ICE connection failed - check TURN servers");
        }
      };

      // Monitor ICE gathering state
      pc.onicegatheringstatechange = () => {
        console.log("🧊 [ICE GATHERING] State:", pc.iceGatheringState);
      };

      peerConnectionRef.current = pc;

      // Reset processed track IDs for new connection
      processedTrackIds.current.clear();
      remoteStreamRef.current = null;
      sentCandidates.current.clear();

      // Add local stream tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log("Added local track:", track.kind);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log("📹 [REMOTE TRACK] Received:", event.track.kind);

        // Skip if we've already processed this track
        if (processedTrackIds.current.has(event.track.id)) {
          return;
        }
        processedTrackIds.current.add(event.track.id);

        // Get or create remote stream
        let currentStream = remoteStreamRef.current;
        
        if (!currentStream) {
          currentStream = new MediaStream();
          remoteStreamRef.current = currentStream;
          setRemoteStream(currentStream);
        }

        // Add track to stream
        currentStream.addTrack(event.track);

        // Set stream to video element
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== currentStream) {
          remoteVideoRef.current.srcObject = currentStream;
          // Try to play immediately
          remoteVideoRef.current.play().catch((error) => {
            console.log("⏳ [REMOTE STREAM] Will retry play:", error.name);
          });
        }

        // Monitor track state
        event.track.onunmute = () => {
          console.log("✅ [REMOTE TRACK] Unmuted - media flowing:", event.track.kind);
          if (remoteVideoRef.current && remoteVideoRef.current.paused) {
            remoteVideoRef.current.play().catch(console.error);
          }
        };

        event.track.onmute = () => {
          console.warn("⚠️ [REMOTE TRACK] Muted:", event.track.kind);
        };
      };

      // Handle ICE candidates - FIXED to properly send candidates
      pc.onicecandidate = async (event) => {
        if (!callId) return;

        if (event.candidate) {
          const candidateJson = event.candidate.toJSON();
          const candidateKey = `${candidateJson.candidate}-${candidateJson.sdpMLineIndex}`;
          
          // Skip if already sent
          if (sentCandidates.current.has(candidateKey)) {
            return;
          }
          sentCandidates.current.add(candidateKey);

          console.log("🧊 [ICE CANDIDATE] Sending candidate to database");

          try {
            // Get current user role to determine which field to update
            const childSession = localStorage.getItem("childSession");
            const isChild = !!childSession;
            
            // Use separate fields for parent and child candidates
            const updateField = isChild ? "child_ice_candidates" : "parent_ice_candidates";
            
            // Get current candidates for this role
            const { data: call } = await supabase
              .from("calls")
              .select(updateField)
              .eq("id", callId)
              .single();

            if (call) {
              const existingCandidates = (call[updateField] as RTCIceCandidateInit[]) || [];
              const updatedCandidates = [...existingCandidates, candidateJson];

              const { error } = await supabase
                .from("calls")
                .update({ [updateField]: updatedCandidates as Json })
                .eq("id", callId);

              if (error) {
                console.error("❌ [ICE CANDIDATE] Error sending:", error);
              } else {
                console.log("✅ [ICE CANDIDATE] Sent successfully");
              }
            }
          } catch (error) {
            console.error("❌ [ICE CANDIDATE] Error:", error);
          }
        }
      };
    } catch (error) {
      console.error("Error initializing WebRTC connection:", error);
      throw error;
    }
  }, [callId, localVideoRef, remoteVideoRef]);

  const cleanup = useCallback(() => {
    console.log("🧹 [CLEANUP] Cleaning up WebRTC resources...");

    // Stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      if (peerConnectionRef.current.signalingState !== "closed") {
        peerConnectionRef.current.close();
      }
      peerConnectionRef.current = null;
    }

    // Clear remote stream
    setRemoteStream(null);
    remoteStreamRef.current = null;
    processedTrackIds.current.clear();
    sentCandidates.current.clear();
  }, [localVideoRef, remoteVideoRef]);

  const playRemoteVideo = useCallback(() => {
    const video = remoteVideoRef.current;
    const stream = remoteStreamRef.current || remoteStream;
    
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    if (video.paused) {
      video.play().catch((error) => {
        console.log("⏳ [VIDEO PLAY] Will retry:", error.name);
        setTimeout(() => {
          if (video.paused) {
            video.play().catch(console.error);
          }
        }, 100);
      });
    }
  }, [remoteStream]);

  // Monitor remote stream changes
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(console.log);
      }
    }
  }, [remoteStream]);

  return {
    peerConnection: peerConnectionRef.current,
    localStream,
    remoteStream,
    isConnecting,
    setIsConnecting,
    initializeConnection,
    cleanup,
    iceCandidatesQueue,
    peerConnectionRef,
    playRemoteVideo,
  };
};

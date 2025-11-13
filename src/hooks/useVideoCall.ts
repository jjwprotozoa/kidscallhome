// src/hooks/useVideoCall.ts
// Video call orchestration hook that manages call initialization and lifecycle

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWebRTC } from "./useWebRTC";
import { handleParentCall } from "@/utils/callHandlers";
import { handleChildCall } from "@/utils/childCallHandler";
import { endCall as endCallUtil, isCallTerminal } from "@/utils/callEnding";
import type { ChildSession } from "@/types/call";

export const useVideoCall = () => {
  const { childId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const initializationRef = useRef(false);

  const [isChild, setIsChild] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const terminationChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const {
    localStream,
    remoteStream,
    isConnecting,
    setIsConnecting,
    initializeConnection,
    cleanup: cleanupWebRTC,
    iceCandidatesQueue,
    peerConnectionRef,
    playRemoteVideo,
  } = useWebRTC(callId, localVideoRef, remoteVideoRef, isChild);

  // Track if we've already attempted to play to avoid multiple calls
  const playAttemptedRef = useRef(false);

  // Reset play attempt flag when callId changes (new call)
  useEffect(() => {
    playAttemptedRef.current = false;
  }, [callId]);

  // Play remote video when connection is established and stream is available
  // This happens after user clicks "Answer" (user interaction)
  // CRITICAL: Wait for readyState >= 2 (have_current_data) before marking call as live
  // However, if call is connected (isConnecting = false), try to play even if ICE is still establishing
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current && !playAttemptedRef.current) {
      const pc = peerConnectionRef.current;
      const iceState = pc?.iceConnectionState;
      const video = remoteVideoRef.current;
      const callIsConnected = !isConnecting; // Call is connected when not connecting
      
      console.log("🎬 [VIDEO PLAY] Attempting to play remote video:", {
        hasRemoteStream: !!remoteStream,
        hasVideoElement: !!video,
        iceState,
        isConnecting,
        callIsConnected,
        videoReadyState: video.readyState,
        videoPaused: video.paused,
        videoSrcObject: !!video.srcObject,
      });
      
      // CRITICAL FIX: If call is connected (answer received), try to play even if ICE is still establishing
      // This fixes the issue where parent-to-child calls connect but video doesn't play
      if (callIsConnected && (iceState === "connected" || iceState === "completed")) {
        // Remote stream is available, call is connected, and ICE is connected
        // CRITICAL FIX: Wait for readyState >= 2 before playing
        // This ensures tracks are actually receiving data, not just received/unmuted
        if (video.readyState >= 2) {
          playAttemptedRef.current = true;
          console.log("🎬 [VIDEO PLAY] Stream available, call connected, ICE connected, video ready (readyState:", video.readyState, ")");
          playRemoteVideo();
        } else {
          console.log("⏳ [VIDEO PLAY] Waiting for video readyState >= 2 (current:", video.readyState, ")");
          // Wait for video to be ready
          const onReady = () => {
            if (video.readyState >= 2 && !playAttemptedRef.current) {
              playAttemptedRef.current = true;
              console.log("✅ [VIDEO PLAY] Video ready (readyState:", video.readyState, "), attempting play");
              playRemoteVideo();
            }
          };
          video.addEventListener('loadeddata', onReady, { once: true });
          video.addEventListener('canplay', onReady, { once: true });
          video.addEventListener('canplaythrough', onReady, { once: true });
        }
      } else if (callIsConnected && (iceState === "new" || iceState === "checking")) {
        // Call is connected but ICE is still establishing - try to play anyway
        // This is important for parent-to-child calls where ICE might be slow
        console.log("⏳ [VIDEO PLAY] Call connected but ICE still establishing - attempting play anyway (state:", iceState, ")");
        
        // Try to play immediately - tracks might already be unmuted
        if (video.readyState >= 2) {
          playAttemptedRef.current = true;
          console.log("🎬 [VIDEO PLAY] Video ready, attempting play (ICE still:", iceState, ")");
          playRemoteVideo();
        } else {
          // Wait for video to be ready, but don't wait too long
          const onReady = () => {
            if (video.readyState >= 2 && !playAttemptedRef.current) {
              playAttemptedRef.current = true;
              console.log("✅ [VIDEO PLAY] Video ready, attempting play (ICE still:", iceState, ")");
              playRemoteVideo();
            }
          };
          video.addEventListener('loadeddata', onReady, { once: true });
          video.addEventListener('canplay', onReady, { once: true });
          video.addEventListener('canplaythrough', onReady, { once: true });
          
          // Also set up ICE watcher in case it connects
          const checkICE = setInterval(() => {
            const currentPC = peerConnectionRef.current;
            const currentICEState = currentPC?.iceConnectionState;
            if (currentICEState === "connected" || currentICEState === "completed") {
              clearInterval(checkICE);
              if (!playAttemptedRef.current && video.readyState >= 2) {
                playAttemptedRef.current = true;
                console.log("✅ [VIDEO PLAY] ICE connected, video ready, attempting play");
                playRemoteVideo();
              }
            }
          }, 500);
          
          // Timeout after 5 seconds - if video isn't ready by then, try anyway
          setTimeout(() => {
            clearInterval(checkICE);
            if (!playAttemptedRef.current) {
              console.warn("⚠️ [VIDEO PLAY] Timeout waiting for video readyState, attempting play anyway");
              playAttemptedRef.current = true;
              playRemoteVideo();
            }
          }, 5000);
          
          return () => clearInterval(checkICE);
        }
      } else if (!callIsConnected && (iceState === "new" || iceState === "checking")) {
        console.log("⏳ [VIDEO PLAY] Waiting for call to connect and ICE connection - current state:", iceState);
        // Wait for call to connect, then wait for ICE to connect, then wait for video readyState >= 2
        const checkConnection = setInterval(() => {
          const currentPC = peerConnectionRef.current;
          const currentICEState = currentPC?.iceConnectionState;
          const currentIsConnecting = isConnecting;
          
          if (!currentIsConnecting && (currentICEState === "connected" || currentICEState === "completed")) {
            clearInterval(checkConnection);
            // Now wait for video readyState >= 2
            if (video.readyState >= 2 && !playAttemptedRef.current) {
              playAttemptedRef.current = true;
              console.log("✅ [VIDEO PLAY] Call connected, ICE connected, video ready (readyState:", video.readyState, "), attempting play");
              playRemoteVideo();
            } else if (!playAttemptedRef.current) {
              const onReady = () => {
                if (video.readyState >= 2 && !playAttemptedRef.current) {
                  playAttemptedRef.current = true;
                  console.log("✅ [VIDEO PLAY] Video ready after call and ICE connected (readyState:", video.readyState, ")");
                  playRemoteVideo();
                }
              };
              video.addEventListener('loadeddata', onReady, { once: true });
              video.addEventListener('canplay', onReady, { once: true });
              video.addEventListener('canplaythrough', onReady, { once: true });
            }
          } else if (currentICEState === "failed" || currentICEState === "closed") {
            clearInterval(checkConnection);
            console.error("❌ [VIDEO PLAY] ICE connection failed, cannot play media");
          }
        }, 500);
        
        // Timeout after 15 seconds
        setTimeout(() => {
          clearInterval(checkConnection);
          if (!playAttemptedRef.current && video.readyState >= 2) {
            console.warn("⚠️ [VIDEO PLAY] Connection timeout but video is ready, attempting play");
            playAttemptedRef.current = true;
            playRemoteVideo();
          }
        }, 15000);
        
        return () => clearInterval(checkConnection);
      } else {
        // ICE is in failed/disconnected/closed state - log but don't attempt play
        console.error("❌ [VIDEO PLAY] ICE connection in terminal state:", iceState);
      }
    }
  }, [remoteStream, playRemoteVideo, isConnecting]);

  useEffect(() => {
    // Prevent multiple initializations
    if (initializationRef.current) {
      return;
    }

    const childSession = localStorage.getItem("childSession");
    const isChildUser = !!childSession;
    setIsChild(isChildUser);

    let isMounted = true;
    initializationRef.current = true;

    initializeCall(isChildUser).catch((error) => {
      if (isMounted) {
        console.error("Call initialization error:", error);
        initializationRef.current = false; // Allow retry on error
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        
        // Only show error toast, don't navigate away
        // Navigation should only happen in specific error handlers
        toast({
          title: "Connection Error",
          description: errorMessage,
          variant: "destructive",
        });
        
        // Don't cleanup on initialization errors - let user retry
        // Cleanup should only happen when call ends or component unmounts
        // For child users, don't navigate on initialization errors
        // They should stay on the call page to retry
        // Only navigate if it's a critical session error (handled in handleChildCallFlow)
        if (!isChildUser) {
          // For parent users, errors are handled in handleParentCallFlow
          // Don't navigate here either - let them stay on the page
        }
      }
    });

    return () => {
      isMounted = false;
      // Don't reset initializationRef here - let it persist for the call duration
      // Only cleanup if component is actually unmounting (not just re-rendering)
      // The cleanup will happen when the call ends or component unmounts
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  const initializeCall = async (isChildUser: boolean) => {
    try {
      // Initialize WebRTC connection
      await initializeConnection();

      const pc = peerConnectionRef.current;
      if (!pc) {
        throw new Error("Failed to create peer connection");
      }

      // Set up call based on role
      let channel: any;
      if (isChildUser) {
        channel = await handleChildCallFlow(pc);
      } else {
        channel = await handleParentCallFlow(pc);
      }
      
      // Store channel reference for cleanup
      if (channel) {
        callChannelRef.current = channel;
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Connection Error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsConnecting(false);
      throw error;
    }
  };

  const handleParentCallFlow = async (pc: RTCPeerConnection) => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      
      if (authError) {
        console.error("Auth error in parent call flow:", authError);
        // Don't throw - just show error and let user stay on page
        // They can manually navigate if needed
        toast({
          title: "Authentication Error",
          description: "Please log in again to make calls",
          variant: "destructive",
        });
        // Don't navigate - let them stay on the call page
        // Navigation to /parent/auth should be handled by ParentDashboard's checkAuth
        return null;
      }
      
      if (!user || !childId) {
        console.error("Missing user or childId in parent call flow");
        toast({
          title: "Error",
          description: "Unable to start call. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      const channel = await handleParentCall(
        pc,
        childId,
        user.id,
        (id: string) => {
          setCallId(id);
          // Set up termination listener after callId is set
          const terminationChannel = setupCallTerminationListener(id);
          if (terminationChannel) {
            terminationChannelRef.current = terminationChannel;
          }
        },
        setIsConnecting,
        iceCandidatesQueue
      );
      
      return channel;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      
      // Check if it's a schema cache error
      const isSchemaError = errorMessage.includes("Database schema cache");
      
      toast({
        title: isSchemaError ? "Database Schema Error" : "Error",
        description: isSchemaError
          ? "The database schema cache needs to be refreshed. Please contact support or try refreshing the page."
          : errorMessage,
        variant: "destructive",
      });
      setIsConnecting(false);
      throw error;
    }
  };

  const handleChildCallFlow = async (pc: RTCPeerConnection) => {
    try {
      const childSession = localStorage.getItem("childSession");
      if (!childSession) {
        navigate("/child/login");
        return;
      }

      const child: ChildSession = JSON.parse(childSession);

      // Verify child exists in database and get parent_id
      // Only check once at initialization, don't re-check during call
      const { data: childData, error: childError } = await supabase
        .from("children")
        .select("parent_id")
        .eq("id", child.id)
        .single();

      if (childError || !childData) {
        console.error("Child not found in database:", childError);
        // Only navigate if this is during initialization, not during an active call
        // If callId exists, we're in the middle of a call - don't navigate away
        if (!callId) {
          localStorage.removeItem("childSession");
          toast({
            title: "Session expired",
            description: "Please log in again with your code",
            variant: "destructive",
          });
          navigate("/child/login");
          return;
        } else {
          // If call is active, just log the error but don't navigate
          // Use cached parent_id from child session if available
          console.warn("Child verification failed during active call, using cached data...");
          // Continue with call using child data we already have
        }
      }

      // Use childData if available, otherwise throw error (parent_id should always be in database)
      const parentId = childData?.parent_id;
      if (!parentId) {
        throw new Error("Unable to determine parent ID for call. Please log in again.");
      }

      // Check if there's a specific callId in URL params (when answering incoming call)
      const urlCallId = searchParams.get("callId");
      
      const channel = await handleChildCall(
        pc,
        child,
        { parent_id: parentId },
        (id: string) => {
          setCallId(id);
          // Set up termination listener after callId is set
          const terminationChannel = setupCallTerminationListener(id);
          if (terminationChannel) {
            terminationChannelRef.current = terminationChannel;
          }
        },
        setIsConnecting,
        iceCandidatesQueue,
        urlCallId // Pass the callId from URL if present
      );
      
      return channel;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      
      // Check if it's a schema cache error
      const isSchemaError = errorMessage.includes("Database schema cache");
      
      toast({
        title: isSchemaError ? "Database Schema Error" : "Error",
        description: isSchemaError
          ? "The database schema cache needs to be refreshed. Please contact support or try refreshing the page."
          : errorMessage,
        variant: "destructive",
      });
      setIsConnecting(false);
      navigate("/child/dashboard");
      throw error;
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const newMutedState = !isMuted;
      // FIXED: When muted, enabled should be false (not true)
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !newMutedState; // enabled = false when muted
      });
      setIsMuted(newMutedState);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const newVideoOffState = !isVideoOff;
      // FIXED: When video off, enabled should be false (not true)
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !newVideoOffState; // enabled = false when video off
      });
      setIsVideoOff(newVideoOffState);
    }
  };

  const setupCallTerminationListener = (currentCallId: string) => {
    // Listen for call termination by remote party
    // Note: Termination is also handled in the call handlers' UPDATE listeners
    // This provides a backup and UI feedback
    const terminationChannel = supabase
      .channel(`call-termination:${currentCallId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${currentCallId}`,
        },
        async (payload) => {
          try {
            const updatedCall = payload.new as {
              id: string;
              status: string;
            };
            const oldCall = payload.old as {
              status?: string;
            } | null;
            
            // Only log if status actually changed (reduce console spam)
            // Skip logging if oldStatus is undefined (initial state) and status hasn't meaningfully changed
            const statusChanged = oldCall?.status !== undefined && oldCall.status !== updatedCall.status;
            if (statusChanged) {
              console.log("📞 [CALL LIFECYCLE] Call status update received:", {
                callId: updatedCall.id,
                oldStatus: oldCall?.status,
                newStatus: updatedCall.status,
                timestamp: new Date().toISOString(),
              });
            }
            
            // Check for terminal state: status === 'ended' OR ended_at != null
            // Only trigger if status changed TO terminal (not if it was already ended)
            // Don't trigger on status changes to "active" (that means call was answered)
            // CRITICAL: Only process if this is the current call we're handling
            const isTerminal = isCallTerminal(updatedCall);
            
            // CRITICAL FIX: Only treat as ended if we have a previous state that was NOT terminal
            // If oldCall is undefined, we can't be sure this is a new termination
            // This prevents false positives when the listener first subscribes
            const wasTerminal = oldCall ? isCallTerminal(oldCall) : null; // null means unknown, not false
            
            // Only process if:
            // 1. Call is now terminal
            // 2. We have a previous state (oldCall is not undefined)
            // 3. Previous state was NOT terminal (wasTerminal === false)
            // 4. This is the current call we're handling
            if (
              isTerminal && 
              oldCall !== undefined && // Must have previous state
              wasTerminal === false && // Previous state was NOT terminal
              updatedCall.id === currentCallId
            ) {
              const pc = peerConnectionRef.current;
              const iceState = pc?.iceConnectionState;
              
              console.info("🛑 [CALL LIFECYCLE] Call ended by remote party - cleaning up", {
                callId: currentCallId,
                oldStatus: oldCall?.status,
                newStatus: updatedCall.status,
                ended_at: updatedCall.ended_at,
                ended_by: (updatedCall as any).ended_by,
                reason: "Call reached terminal state (ended or ended_at set) in database",
                timestamp: new Date().toISOString(),
                connectionState: pc?.connectionState,
                iceConnectionState: iceState,
                hasRemoteStream: !!remoteStream,
                remoteVideoReadyState: remoteVideoRef.current?.readyState,
              });
              
              // CRITICAL FIX: Only cleanup if ICE is not in "new" or "checking"
              // This prevents premature cleanup during connection establishment
              // However, if stuck in "new" for more than 10 seconds, allow cleanup (connection likely failed)
              const allowCleanup = iceState !== "new" && iceState !== "checking";
              
              // Always cleanup when call is ended, regardless of ICE state
              // The call was explicitly ended by the other party, so we should respond immediately
              console.log("🛑 [CALL LIFECYCLE] Call ended by remote party - cleaning up immediately", {
                iceState,
                reason: "Call reached terminal state - cleaning up regardless of ICE state",
              });
              
              toast({
                title: "Call Ended",
                description: "The other person ended the call",
                variant: "default",
              });
              
              // Cleanup immediately - don't wait for ICE state
              cleanupWebRTC();
              if (callChannelRef.current) {
                supabase.removeChannel(callChannelRef.current);
                callChannelRef.current = null;
              }
              if (terminationChannelRef.current) {
                supabase.removeChannel(terminationChannelRef.current);
                terminationChannelRef.current = null;
              }
              
              const childSession = localStorage.getItem("childSession");
              const isChildUser = !!childSession;
              
              if (isChildUser) {
                navigate("/child/dashboard");
              } else {
                navigate("/parent/dashboard");
              }
            }
          } catch (error) {
            console.error("❌ [CALL LIFECYCLE] Error in termination listener:", error);
            // Don't navigate on errors - just log
          }
        }
      )
      .subscribe();
    
    return terminationChannel;
  };

  const callStartTimeRef = useRef<number | null>(null);

  // Track when call becomes active
  useEffect(() => {
    if (!isConnecting && callId && !callStartTimeRef.current) {
      callStartTimeRef.current = Date.now();
      console.log("📞 [CALL LIFECYCLE] Call started (connection established)", {
        callId: callId,
        timestamp: new Date().toISOString(),
      });
    }
  }, [isConnecting, callId]);

  const endCall = async () => {
    const callDuration = callStartTimeRef.current 
      ? Date.now() - callStartTimeRef.current 
      : null;

    console.log("🛑 [USER ACTION] User ended call", {
      callId: callId,
      callDurationMs: callDuration,
      callDurationSeconds: callDuration ? Math.round(callDuration / 1000) : null,
      timestamp: new Date().toISOString(),
      connectionState: peerConnectionRef.current?.connectionState,
      iceConnectionState: peerConnectionRef.current?.iceConnectionState,
      hasRemoteStream: !!remoteStream,
      remoteVideoReadyState: remoteVideoRef.current?.readyState,
    });

    // Warn if call is ended very quickly (less than 5 seconds)
    if (callDuration && callDuration < 5000) {
      console.warn("⚠️ [USER ACTION] Call ended very quickly - might be accidental", {
        durationMs: callDuration,
        durationSeconds: Math.round(callDuration / 1000),
      });
    }

    // Determine if user is child by checking for child session
    const childSession = localStorage.getItem("childSession");
    const isChildUser = !!childSession;
    const by = isChildUser ? 'child' : 'parent';

    // Order matters: write the terminal state FIRST, then cleanup
    // If cleanup crashes, the remote still gets the signal
    if (callId) {
      try {
        await endCallUtil({ callId, by, reason: 'hangup' });
      } catch (error) {
        console.error("❌ [USER ACTION] Error ending call:", error);
        // Continue with cleanup even if DB update fails
      }
    }

    // Reset call start time
    callStartTimeRef.current = null;
    
    // Clean up all resources (force cleanup on explicit hangup)
    // Pass true to force cleanup even if ICE is still establishing
    cleanupWebRTC(true);
    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }
    if (terminationChannelRef.current) {
      supabase.removeChannel(terminationChannelRef.current);
      terminationChannelRef.current = null;
    }
    
    // Navigate based on user type
    if (isChildUser) {
      navigate("/child/dashboard");
    } else {
      navigate("/parent/dashboard");
    }
  };

  return {
    localVideoRef,
    remoteVideoRef,
    localStream,
    remoteStream,
    isConnecting,
    isMuted,
    isVideoOff,
    isChild,
    toggleMute,
    toggleVideo,
    endCall,
  };
};


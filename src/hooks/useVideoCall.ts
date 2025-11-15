// src/hooks/useVideoCall.ts
// Video call orchestration hook that manages call initialization and lifecycle

import { callLog } from "@/features/calls/utils/callLogger";
import { useToast } from "@/hooks/use-toast";
import { useAudioNotifications } from "@/hooks/useAudioNotifications";
import { supabase } from "@/integrations/supabase/client";
import type { ChildSession } from "@/types/call";
import { endCall as endCallUtil, isCallTerminal } from "@/utils/callEnding";
import { handleParentCall } from "@/utils/callHandlers";
import { handleChildCall } from "@/utils/childCallHandler";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useWebRTC } from "./useWebRTC";

export const useVideoCall = () => {
  const { childId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playRingtone, stopRingtone, playCallAnswered } =
    useAudioNotifications({ enabled: true, volume: 0.7 });
  const initializationRef = useRef(false);

  // CRITICAL FIX: Derive isChild synchronously from route/session BEFORE useWebRTC
  // This ensures ICE candidates go to the correct database columns
  // Check route path first (most reliable)
  const isChildRoute = window.location.pathname.includes("/child/");
  const isParentRoute = window.location.pathname.includes("/parent/");

  // Derive from route or fallback to session check
  // Use useState with initial value derived synchronously
  const [isChild] = useState(() => {
    // If on child route, definitely a child
    if (isChildRoute) return true;
    // If on parent route, definitely a parent
    if (isParentRoute) return false;
    // Fallback: check session synchronously (may not be perfect but better than false)
    const childSession = localStorage.getItem("childSession");
    const hasAuthSession =
      document.cookie.includes("sb-") || localStorage.getItem("sb-");
    return !hasAuthSession && !!childSession;
  });

  const [callId, setCallId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null
  );
  const terminationChannelRef = useRef<ReturnType<
    typeof supabase.channel
  > | null>(null);

  // CRITICAL: Log role to verify it's correct
  callLog.debug("ROLE", "useVideoCall role", {
    isChild,
    route: window.location.pathname,
    isChildRoute,
    isParentRoute,
    timestamp: new Date().toISOString(),
  });

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
    isConnected, // Add connection state from useWebRTC
  } = useWebRTC(callId, localVideoRef, remoteVideoRef, isChild);

  // Track if we've already attempted to play to avoid multiple calls
  const playAttemptedRef = useRef(false);

  // Reset play attempt flag when callId changes (new call)
  useEffect(() => {
    playAttemptedRef.current = false;
  }, [callId]);

  // Play ringtone for outgoing calls (when connecting and no remote stream yet)
  useEffect(() => {
    if (isConnecting && !remoteStream && callId) {
      // Outgoing call - play ringtone while waiting for answer
      callLog.debug("AUDIO", "Outgoing call - starting ringtone");
      playRingtone();
    } else if (remoteStream || !isConnecting) {
      // Call answered or connection established - stop ringtone
      callLog.debug("AUDIO", "Call answered or connected - stopping ringtone");
      stopRingtone();
      if (remoteStream && !playAttemptedRef.current) {
        // Play answered sound when remote stream first appears
        playCallAnswered();
      }
    }

    // Cleanup on unmount
    return () => {
      stopRingtone();
    };
  }, [
    isConnecting,
    remoteStream,
    callId,
    playRingtone,
    stopRingtone,
    playCallAnswered,
  ]);

  // Play remote video when connection is established and stream is available
  // This happens after user clicks "Answer" (user interaction)
  // CRITICAL: Wait for readyState >= 2 (have_current_data) before marking call as live
  // However, if call is connected (isConnecting = false), try to play even if ICE is still establishing
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current && !playAttemptedRef.current) {
      const pc = peerConnectionRef.current;
      const iceState = pc?.iceConnectionState;
      const video = remoteVideoRef.current;
      // CRITICAL FIX: Only mark as connected when ICE is actually connected
      // Don't rely on isConnecting flag alone - use actual ICE state
      const callIsConnected = isConnected && !!remoteStream;

      callLog.debug("VIDEO", "Attempting to play remote video", {
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
      if (
        callIsConnected &&
        (iceState === "connected" || iceState === "completed")
      ) {
        // Remote stream is available, call is connected, and ICE is connected
        // CRITICAL FIX: Wait for readyState >= 2 before playing
        // This ensures tracks are actually receiving data, not just received/unmuted
        if (video.readyState >= 2) {
          playAttemptedRef.current = true;
          callLog.debug(
            "VIDEO",
            "Stream available, call connected, ICE connected, video ready",
            { readyState: video.readyState }
          );
          playRemoteVideo();
        } else {
          callLog.debug("VIDEO", "Waiting for video readyState >= 2", {
            current: video.readyState,
          });
          // Wait for video to be ready
          const onReady = () => {
            if (video.readyState >= 2 && !playAttemptedRef.current) {
              playAttemptedRef.current = true;
              callLog.debug("VIDEO", "Video ready, attempting play", {
                readyState: video.readyState,
              });
              playRemoteVideo();
            }
          };
          video.addEventListener("loadeddata", onReady, { once: true });
          video.addEventListener("canplay", onReady, { once: true });
          video.addEventListener("canplaythrough", onReady, { once: true });
        }
      } else if (
        callIsConnected &&
        (iceState === "new" || iceState === "checking")
      ) {
        // Call is connected but ICE is still establishing - try to play anyway
        // This is important for parent-to-child calls where ICE might be slow
        callLog.debug(
          "VIDEO",
          "Call connected but ICE still establishing - attempting play anyway",
          { state: iceState }
        );

        // Try to play immediately - tracks might already be unmuted
        if (video.readyState >= 2) {
          playAttemptedRef.current = true;
          callLog.debug("VIDEO", "Video ready, attempting play", { iceState });
          playRemoteVideo();
        } else {
          // Wait for video to be ready, but don't wait too long
          const onReady = () => {
            if (video.readyState >= 2 && !playAttemptedRef.current) {
              playAttemptedRef.current = true;
              callLog.debug("VIDEO", "Video ready, attempting play", {
                iceState,
              });
              playRemoteVideo();
            }
          };
          video.addEventListener("loadeddata", onReady, { once: true });
          video.addEventListener("canplay", onReady, { once: true });
          video.addEventListener("canplaythrough", onReady, { once: true });

          // Also set up ICE watcher in case it connects
          const checkICE = setInterval(() => {
            const currentPC = peerConnectionRef.current;
            const currentICEState = currentPC?.iceConnectionState;
            if (
              currentICEState === "connected" ||
              currentICEState === "completed"
            ) {
              clearInterval(checkICE);
              if (!playAttemptedRef.current && video.readyState >= 2) {
                playAttemptedRef.current = true;
                callLog.debug(
                  "VIDEO",
                  "ICE connected, video ready, attempting play"
                );
                playRemoteVideo();
              }
            }
          }, 500);

          // Timeout after 5 seconds - if video isn't ready by then, try anyway
          setTimeout(() => {
            clearInterval(checkICE);
            if (!playAttemptedRef.current) {
              callLog.warn(
                "VIDEO",
                "Timeout waiting for video readyState, attempting play anyway"
              );
              playAttemptedRef.current = true;
              playRemoteVideo();
            }
          }, 5000);

          return () => clearInterval(checkICE);
        }
      } else if (
        !callIsConnected &&
        (iceState === "new" || iceState === "checking")
      ) {
        callLog.debug(
          "VIDEO",
          "Waiting for call to connect and ICE connection",
          { state: iceState }
        );
        // Wait for call to connect, then wait for ICE to connect, then wait for video readyState >= 2
        const checkConnection = setInterval(() => {
          const currentPC = peerConnectionRef.current;
          const currentICEState = currentPC?.iceConnectionState;
          const currentIsConnecting = isConnecting;

          if (
            !currentIsConnecting &&
            (currentICEState === "connected" || currentICEState === "completed")
          ) {
            clearInterval(checkConnection);
            // Now wait for video readyState >= 2
            if (video.readyState >= 2 && !playAttemptedRef.current) {
              playAttemptedRef.current = true;
              callLog.debug(
                "VIDEO",
                "Call connected, ICE connected, video ready, attempting play",
                { readyState: video.readyState }
              );
              playRemoteVideo();
            } else if (!playAttemptedRef.current) {
              const onReady = () => {
                if (video.readyState >= 2 && !playAttemptedRef.current) {
                  playAttemptedRef.current = true;
                  callLog.debug(
                    "VIDEO",
                    "Video ready after call and ICE connected",
                    { readyState: video.readyState }
                  );
                  playRemoteVideo();
                }
              };
              video.addEventListener("loadeddata", onReady, { once: true });
              video.addEventListener("canplay", onReady, { once: true });
              video.addEventListener("canplaythrough", onReady, { once: true });
            }
          } else if (
            currentICEState === "failed" ||
            currentICEState === "closed"
          ) {
            clearInterval(checkConnection);
            callLog.error("VIDEO", "ICE connection failed, cannot play media");
          }
        }, 500);

        // Timeout after 15 seconds
        setTimeout(() => {
          clearInterval(checkConnection);
          if (!playAttemptedRef.current && video.readyState >= 2) {
            callLog.warn(
              "VIDEO",
              "Connection timeout but video is ready, attempting play"
            );
            playAttemptedRef.current = true;
            playRemoteVideo();
          }
        }, 15000);

        return () => clearInterval(checkConnection);
      } else {
        // ICE is in failed/disconnected/closed state - log but don't attempt play
        callLog.error("VIDEO", "ICE connection in terminal state", {
          iceState,
        });
      }
    }
    // peerConnectionRef is a ref (stable reference) and doesn't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteStream, playRemoteVideo, isConnecting, isConnected]);

  useEffect(() => {
    // Prevent multiple initializations
    if (initializationRef.current) {
      return;
    }

    // CRITICAL: Check auth session FIRST - parents have auth session, children don't
    // If user has auth session, they are a parent (even if childSession exists)
    // NOTE: isChild is now derived synchronously above, but we still need to determine it
    // for initializeCall - use the same logic
    const determineUserType = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const childSession = localStorage.getItem("childSession");
      // Parent if has auth session (even if childSession exists)
      // Child if has childSession but NO auth session
      const isChildUser = !session && !!childSession;
      // isChild is already set synchronously above, but verify it matches
      if (isChildUser !== isChild) {
        callLog.warn("ROLE", "Role mismatch detected", {
          isChildState: isChild,
          isChildUser,
          route: window.location.pathname,
        });
      }
      return isChildUser;
    };

    determineUserType()
      .then((isChildUser) => {
        const isMounted = true;
        initializationRef.current = true;

        initializeCall(isChildUser).catch((error) => {
          if (isMounted) {
            callLog.error("INIT", "Call initialization error", error);
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
      })
      .catch((error) => {
        callLog.error("INIT", "Error determining user type", error);
      });

    return () => {
      // Don't reset initializationRef here - let it persist for the call duration
      // Only cleanup if component is actually unmounting (not just re-rendering)
      // The cleanup will happen when the call ends or component unmounts
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  const initializeCall = async (isChildUser: boolean) => {
    callLog.debug("INIT", "Initialize call entry", {
      isChildUser,
      childId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Initialize WebRTC connection
      callLog.debug("INIT", "Initializing WebRTC connection");
      await initializeConnection();

      const pc = peerConnectionRef.current;
      if (!pc) {
        throw new Error("Failed to create peer connection");
      }

      callLog.debug("INIT", "WebRTC connection initialized", {
        signalingState: pc.signalingState,
        senders: pc.getSenders().length,
        tracks: pc
          .getSenders()
          .map((s) => s.track)
          .filter(Boolean).length,
      });

      // Set up call based on role
      let channel: ReturnType<typeof supabase.channel> | null = null;
      if (isChildUser) {
        callLog.debug("INIT", "Setting up child call flow");
        channel = await handleChildCallFlow(pc);
      } else {
        callLog.debug("INIT", "Setting up parent call flow");
        channel = await handleParentCallFlow(pc);
      }

      callLog.debug("INIT", "Call flow setup complete", {
        hasChannel: !!channel,
        isChildUser,
      });

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
    callLog.debug("PARENT", "Parent call flow entry", {
      childId,
      timestamp: new Date().toISOString(),
      signalingState: pc.signalingState,
      senders: pc.getSenders().length,
      tracks: pc
        .getSenders()
        .map((s) => s.track)
        .filter(Boolean).length,
    });

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      callLog.debug("PARENT", "Auth check complete", {
        hasUser: !!user,
        userId: user?.id,
        hasAuthError: !!authError,
      });

      if (authError) {
        callLog.error("PARENT", "Auth error in parent call flow", authError);
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
        callLog.error("PARENT", "Missing user or childId in parent call flow");
        toast({
          title: "Error",
          description: "Unable to start call. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      callLog.debug("PARENT", "Calling handleParentCall", {
        childId,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      const channel = await handleParentCall(
        pc,
        childId,
        user.id,
        (id: string) => {
          callLog.debug("PARENT", "CallId set", { id });
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

      callLog.debug("PARENT", "handleParentCall returned", {
        hasChannel: !!channel,
        timestamp: new Date().toISOString(),
      });

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
      // Check if we're answering an incoming call (has callId in URL)
      const urlCallId = searchParams.get("callId");
      const isAnsweringCall = !!urlCallId;

      const childSession = localStorage.getItem("childSession");
      if (!childSession) {
        // If answering a call but no session, try to get child ID from URL
        if (isAnsweringCall && childId) {
          callLog.warn(
            "CHILD",
            "No child session but answering call - attempting to continue with childId from URL"
          );
          // Don't navigate away - let the call handler try to work with the callId
          // The call handler might be able to find the call and continue
        } else {
          callLog.error(
            "CHILD",
            "No child session and not answering call - redirecting to login"
          );
          navigate("/child/login");
          return;
        }
      }

      const child: ChildSession = JSON.parse(childSession || "{}");

      // If we don't have a valid child object but we're answering a call, try to continue
      if (!child.id && isAnsweringCall && childId) {
        callLog.warn(
          "CHILD",
          "Invalid child session but answering call - using childId from URL"
        );
        // Create a minimal child object from URL param
        const childWithId: ChildSession & { id: string } = {
          ...child,
          id: childId,
        };
        Object.assign(child, childWithId);
      }

      if (!child.id) {
        callLog.error("CHILD", "No valid child ID found");
        if (!isAnsweringCall) {
          navigate("/child/login");
          return;
        } else {
          // If answering call, try to continue anyway
          callLog.warn("CHILD", "Continuing call without valid child ID");
        }
      }

      // Verify child exists in database and get parent_id
      // Only check once at initialization, don't re-check during call
      // CRITICAL: When answering a call, don't navigate away even if verification fails
      const { data: childData, error: childError } = await supabase
        .from("children")
        .select("parent_id")
        .eq("id", child.id)
        .single();

      if (childError || !childData) {
        callLog.error("CHILD", "Child not found in database", childError);
        // CRITICAL: Don't navigate away if we're answering an incoming call
        // The call handler can work with just the callId
        if (!callId && !isAnsweringCall) {
          localStorage.removeItem("childSession");
          toast({
            title: "Session expired",
            description: "Please log in again with your code",
            variant: "destructive",
          });
          navigate("/child/login");
          return;
        } else {
          // If call is active or we're answering, just log the error but don't navigate
          // Use cached parent_id from child session if available
          callLog.warn(
            "CHILD",
            "Child verification failed but continuing call",
            {
              isAnsweringCall,
              hasCallId: !!callId,
              reason: "Call is active or answering - don't navigate away",
            }
          );
          // Continue with call using child data we already have
        }
      }

      // Use childData if available, otherwise try to get parent_id from child session or throw error
      let parentId = childData?.parent_id;

      // If parent_id not in database response, try to get it from child session (for backward compatibility)
      // Note: ChildSession type doesn't include parent_id, but it may exist in cached session data
      const childWithParentId = child as ChildSession & { parent_id?: string };
      if (!parentId && childWithParentId.parent_id) {
        parentId = childWithParentId.parent_id;
        callLog.warn("CHILD", "Using parent_id from child session cache");
      }

      if (!parentId) {
        callLog.error("CHILD", "Unable to determine parent ID", {
          hasChildData: !!childData,
          hasChildSession: !!child,
          childId: child.id,
        });
        // Don't navigate away if we're answering a call - let the call handler deal with it
        if (!urlCallId) {
          throw new Error(
            "Unable to determine parent ID for call. Please log in again."
          );
        } else {
          // If answering a call, try to continue - the call handler might have the parent_id
          callLog.warn(
            "CHILD",
            "Continuing call without parent_id - call handler may have it"
          );
        }
      }

      // If we don't have parentId but we're answering a call, try to get it from the call record
      if (!parentId && urlCallId) {
        callLog.debug(
          "CHILD",
          "No parentId but answering call - fetching from call record"
        );
        try {
          const { data: callData } = await supabase
            .from("calls")
            .select("parent_id")
            .eq("id", urlCallId)
            .maybeSingle();

          if (callData?.parent_id) {
            parentId = callData.parent_id;
            callLog.debug("CHILD", "Got parentId from call record", {
              parentId,
            });
          }
        } catch (err) {
          callLog.warn(
            "CHILD",
            "Could not fetch parentId from call record",
            err
          );
        }
      }

      // If still no parentId, use a placeholder (call handler might not need it when answering)
      const parentIdForCall = parentId || "unknown";

      const channel = await handleChildCall(
        pc,
        child,
        { parent_id: parentIdForCall },
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

      // Check if we're answering an incoming call (has callId in URL)
      const urlCallId = searchParams.get("callId");
      const isAnsweringCall = !!urlCallId;

      callLog.error("CHILD", "Error in handleChildCallFlow", {
        errorMessage,
        isAnsweringCall,
        urlCallId,
        hasChildSession: !!localStorage.getItem("childSession"),
      });

      toast({
        title: isSchemaError ? "Database Schema Error" : "Connection Error",
        description: isSchemaError
          ? "The database schema cache needs to be refreshed. Please contact support or try refreshing the page."
          : isAnsweringCall
          ? "Failed to connect to call. Please try again."
          : errorMessage,
        variant: "destructive",
      });
      setIsConnecting(false);

      // If answering a call, don't navigate away - let user stay on call page to retry
      // Only navigate if it's not an incoming call answer
      if (!isAnsweringCall) {
        navigate("/child/dashboard");
      }
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
              ended_at?: string | null;
              ended_by?: string | null;
            };
            const oldCall = payload.old as {
              status?: string;
              ended_at?: string | null;
            } | null;

            // Only log if status actually changed (reduce console spam)
            // Skip logging if oldStatus is undefined (initial state) and status hasn't meaningfully changed
            const statusChanged =
              oldCall?.status !== undefined &&
              oldCall.status !== updatedCall.status;
            if (statusChanged) {
              callLog.debug("LIFECYCLE", "Call status update received", {
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
            callLog.debug("TERMINATION", "Checking termination conditions", {
              isTerminal,
              hasOldCall: oldCall !== undefined,
              wasTerminal,
              callIdMatch: updatedCall.id === currentCallId,
              oldStatus: oldCall?.status,
              newStatus: updatedCall.status,
              oldEndedAt: oldCall?.ended_at,
              newEndedAt: updatedCall.ended_at,
            });

            if (
              isTerminal &&
              oldCall !== undefined && // Must have previous state
              wasTerminal === false && // Previous state was NOT terminal
              updatedCall.id === currentCallId
            ) {
              const pc = peerConnectionRef.current;
              const iceState = pc?.iceConnectionState;

              callLog.info(
                "LIFECYCLE",
                "Call ended by remote party - cleaning up",
                {
                  callId: currentCallId,
                  oldStatus: oldCall?.status,
                  newStatus: updatedCall.status,
                  ended_at: updatedCall.ended_at,
                  reason:
                    "Call reached terminal state (ended or ended_at set) in database",
                  timestamp: new Date().toISOString(),
                  connectionState: pc?.connectionState,
                  iceConnectionState: iceState,
                  hasRemoteStream: !!remoteStream,
                  remoteVideoReadyState: remoteVideoRef.current?.readyState,
                }
              );

              // CRITICAL FIX: Only cleanup if ICE is not in "new" or "checking"
              // This prevents premature cleanup during connection establishment
              // However, if stuck in "new" for more than 10 seconds, allow cleanup (connection likely failed)
              const allowCleanup =
                iceState !== "new" && iceState !== "checking";

              // Always cleanup when call is ended, regardless of ICE state
              // The call was explicitly ended by the other party, so we should respond immediately
              callLog.debug(
                "LIFECYCLE",
                "Call ended by remote party - cleaning up immediately",
                {
                  iceState,
                  reason:
                    "Call reached terminal state - cleaning up regardless of ICE state",
                }
              );

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

              // Determine if user is child or parent
              // CRITICAL: Check auth session FIRST - parents have auth session, children don't
              const {
                data: { session },
              } = await supabase.auth.getSession();
              const childSession = localStorage.getItem("childSession");
              // Parent if has auth session (even if childSession exists)
              // Child if has childSession but NO auth session
              const isChildUser = !session && !!childSession;

              callLog.debug(
                "ROLE",
                "Termination listener - determining user type",
                {
                  hasAuthSession: !!session,
                  hasChildSession: !!childSession,
                  isChildUser,
                  userId: session?.user?.id || null,
                  timestamp: new Date().toISOString(),
                }
              );

              if (isChildUser) {
                navigate("/child/dashboard");
              } else if (session) {
                navigate("/parent/dashboard");
              } else {
                // No session at all - redirect to login
                navigate("/");
              }
            }
          } catch (error) {
            callLog.error("LIFECYCLE", "Error in termination listener", error);
            // Don't navigate on errors - just log
          }
        }
      )
      .subscribe();

    return terminationChannel;
  };

  const callStartTimeRef = useRef<number | null>(null);

  // CRITICAL FIX: Only mark call as started when ICE is actually connected
  // Don't mark as "connected" just because answer was received
  useEffect(() => {
    if (isConnected && remoteStream && callId && !callStartTimeRef.current) {
      callStartTimeRef.current = Date.now();
      callLog.debug("LIFECYCLE", "Call started (ICE connected)", {
        callId,
        timestamp: new Date().toISOString(),
        iceState: peerConnectionRef.current?.iceConnectionState,
        connectionState: peerConnectionRef.current?.connectionState,
      });
    }
  }, [isConnected, remoteStream, callId, peerConnectionRef]);

  // Track when call becomes active (DEPRECATED - use isConnected check above instead)
  // Keep for backwards compatibility but prefer isConnected check
  useEffect(() => {
    if (!isConnecting && callId && !callStartTimeRef.current && !isConnected) {
      // Only log if not already logged by isConnected check
      callLog.debug("LIFECYCLE", "Call signaling complete (waiting for ICE)", {
        callId: callId,
        timestamp: new Date().toISOString(),
      });
    }
  }, [isConnecting, callId, isConnected]);

  const endCall = async () => {
    const callDuration = callStartTimeRef.current
      ? Date.now() - callStartTimeRef.current
      : null;

    callLog.debug("USER", "User ended call", {
      callId: callId,
      callDurationMs: callDuration,
      callDurationSeconds: callDuration
        ? Math.round(callDuration / 1000)
        : null,
      timestamp: new Date().toISOString(),
      connectionState: peerConnectionRef.current?.connectionState,
      iceConnectionState: peerConnectionRef.current?.iceConnectionState,
      hasRemoteStream: !!remoteStream,
      remoteVideoReadyState: remoteVideoRef.current?.readyState,
    });

    // Warn if call is ended very quickly (less than 5 seconds)
    if (callDuration && callDuration < 5000) {
      callLog.warn("USER", "Call ended very quickly - might be accidental", {
        durationMs: callDuration,
        durationSeconds: Math.round(callDuration / 1000),
      });
    }

    // Determine if user is child or parent
    // CRITICAL: Check auth session FIRST - parents have auth session, children don't
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const childSession = localStorage.getItem("childSession");
    // Parent if has auth session (even if childSession exists)
    // Child if has childSession but NO auth session
    const isChildUser = !session && !!childSession;
    const by = isChildUser ? "child" : "parent";

    callLog.debug("ROLE", "End call - determining user type", {
      hasAuthSession: !!session,
      hasChildSession: !!childSession,
      isChildUser,
      by,
      userId: session?.user?.id || null,
      timestamp: new Date().toISOString(),
    });

    // Order matters: write the terminal state FIRST, then cleanup
    // If cleanup crashes, the remote still gets the signal
    if (callId) {
      try {
        await endCallUtil({ callId, by, reason: "hangup" });
      } catch (error) {
        callLog.error("USER", "Error ending call", error);
        // Continue with cleanup even if DB update fails
      }
    }

    // Reset call start time
    callStartTimeRef.current = null;

    // Stop ringtone if playing
    stopRingtone();

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

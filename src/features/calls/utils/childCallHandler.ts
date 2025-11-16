// src/features/calls/utils/childCallHandler.ts
// Child call handling logic

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { CallRecord, ChildSession } from "../types/call";
import { isCallTerminal } from "./callEnding";

export const handleChildCall = async (
  pc: RTCPeerConnection,
  child: ChildSession,
  childData: { parent_id: string },
  setCallId: (id: string) => void,
  setIsConnecting: (value: boolean) => void,
  iceCandidatesQueue: React.MutableRefObject<RTCIceCandidateInit[]>,
  specificCallId?: string | null
) => {
  // If a specific callId is provided (e.g., from URL param when answering), use that first
  if (specificCallId) {
    console.log("📞 [CHILD CALL] Looking for specific call:", specificCallId);
    const { data: specificCall, error: specificCallError } = await supabase
      .from("calls")
      .select("*")
      .eq("id", specificCallId)
      .eq("child_id", child.id)
      .maybeSingle();

    if (specificCallError) {
      console.error("Error fetching specific call:", specificCallError);
    }

    if (specificCall) {
      console.log("📞 [CHILD CALL] Found specific call:", {
        id: specificCall.id,
        caller_type: specificCall.caller_type,
        status: specificCall.status,
        hasOffer: !!specificCall.offer,
      });

      // If it's an incoming call from parent with an offer, ANSWER IT
      // When specificCallId is provided (from URL param), we're answering a call, so check status
      if (specificCall.caller_type === "parent" && specificCall.offer) {
        // Only answer if status is ringing or active (not ended)
        // If ended, the call was already terminated and we shouldn't answer it
        if (
          specificCall.status === "ringing" ||
          specificCall.status === "active"
        ) {
          console.log(
            "📞 [CHILD CALL] Answering incoming call from parent (status:",
            specificCall.status + ", hasOffer: true)"
          );
          return handleIncomingCallFromParent(
            pc,
            specificCall as unknown as CallRecord,
            setCallId,
            setIsConnecting,
            iceCandidatesQueue
          );
        } else {
          console.log(
            "📞 [CHILD CALL] Specific call is ended (status:",
            specificCall.status + "), cannot answer. Creating new call instead."
          );
        }
      }
      // If it's a child-initiated call, handle it
      if (
        specificCall.caller_type === "child" &&
        (specificCall.status === "ringing" || specificCall.status === "active")
      ) {
        console.log("📞 [CHILD CALL] Using existing child-initiated call");
        return handleExistingCall(
          pc,
          specificCall as unknown as CallRecord,
          setCallId,
          setIsConnecting,
          iceCandidatesQueue
        );
      }
      // If specific call is ended or doesn't match, continue to check for other incoming calls
      if (isCallTerminal(specificCall)) {
        console.log(
          "📞 [CHILD CALL] Specific call is ended, checking for other incoming calls..."
        );
      }
    }
  }

  // CRITICAL FIX: Check for incoming parent calls FIRST
  // This ensures child answers parent's call instead of continuing an old child-initiated call
  // Check if there's an incoming call from parent
  // IMPORTANT: When child is INITIATING a call (not answering), only check for RINGING calls
  // We should NOT answer old ended calls when trying to make a new call
  const { data: incomingCallData, error: incomingCallError } = await supabase
    .from("calls")
    .select("*")
    .eq("child_id", child.id)
    .eq("caller_type", "parent")
    .eq("status", "ringing") // CRITICAL: Only answer ringing calls when initiating
    .not("offer", "is", null) // Must have an offer to answer
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (incomingCallError) {
    console.error("Error checking for incoming call:", incomingCallError);
  }

  if (incomingCallData) {
    if (incomingCallData.offer && incomingCallData.status === "ringing") {
      console.log(
        "📞 [CHILD CALL] Found incoming RINGING call from parent with offer:",
        {
          callId: incomingCallData.id,
          status: incomingCallData.status,
          hasOffer: true,
        }
      );
      // Only answer if status is ringing (not ended)
      return handleIncomingCallFromParent(
        pc,
        incomingCallData as unknown as CallRecord,
        setCallId,
        setIsConnecting,
        iceCandidatesQueue
      );
    } else {
      // Offer not ready yet or call is not ringing, wait for it or create new call
      if (incomingCallData.status !== "ringing") {
        console.log(
          "📞 [CHILD CALL] Found call from parent but status is",
          incomingCallData.status + ", not ringing. Creating new call instead."
        );
        // Don't wait for offer if call is not ringing - create new call instead
      } else {
        console.log(
          "📞 [CHILD CALL] Found incoming call from parent but offer not ready yet, waiting...",
          incomingCallData.id
        );
        setCallId(incomingCallData.id);

        // Set up listener to wait for offer
        const channel = supabase
          .channel(`call:${incomingCallData.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "calls",
              filter: `id=eq.${incomingCallData.id}`,
            },
            async (payload) => {
              const updatedCall = payload.new as CallRecord;
              if (updatedCall.offer && pc.remoteDescription === null) {
                console.log(
                  "📞 [CHILD CALL] Offer received, answering incoming call from parent"
                );
                // Unsubscribe from this channel and handle the call
                supabase.removeChannel(channel);
                return handleIncomingCallFromParent(
                  pc,
                  updatedCall,
                  setCallId,
                  setIsConnecting,
                  iceCandidatesQueue
                );
              }
            }
          )
          .subscribe();
        return channel;
      }
    }
  }

  // Only check for existing child-initiated calls if no incoming parent call exists
  // This prevents treating our own outgoing call as incoming
  const { data: existingCall } = await supabase
    .from("calls")
    .select("*")
    .eq("child_id", child.id)
    .eq("parent_id", childData.parent_id)
    .in("status", ["ringing", "active"])
    .eq("caller_type", "child")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingCall) {
    console.log(
      "📞 [CHILD CALL] Found existing child-initiated call, continuing it:",
      existingCall.id
    );
    return handleExistingCall(
      pc,
      existingCall as unknown as CallRecord,
      setCallId,
      setIsConnecting,
      iceCandidatesQueue
    );
  }

  // CRITICAL: Only create new call if NO incoming parent call exists
  // This prevents creating a new call when we should be answering an existing one
  console.log(
    "📞 [CHILD CALL] No existing or incoming call found - child initiating new call"
  );
  return handleChildInitiatedCall(
    pc,
    child,
    childData.parent_id,
    setCallId,
    setIsConnecting,
    iceCandidatesQueue
  );
};

const handleExistingCall = async (
  pc: RTCPeerConnection,
  existingCall: CallRecord,
  setCallId: (id: string) => void,
  setIsConnecting: (value: boolean) => void,
  iceCandidatesQueue: React.MutableRefObject<RTCIceCandidateInit[]>
) => {
  console.log("Using existing call:", existingCall.id);
  setCallId(existingCall.id);

  // If the call is ended or active (meaning it was already connected), reset it to ringing
  // This ensures the parent sees it as a new incoming call when child reconnects
  let wasReset = false;
  if (existingCall.status === "ended" || existingCall.status === "active") {
    console.log(
      "Resetting existing call to ringing status (was:",
      existingCall.status,
      ")..."
    );
    const { error: resetError } = await supabase
      .from("calls")
      .update({
        status: "ringing",
        ended_at: null, // Clear ended_at when resetting to ringing (constraint requires ended_at IS NULL for non-ended status)
        offer: null,
        answer: null,
        parent_ice_candidates: null,
        child_ice_candidates: null,
      })
      .eq("id", existingCall.id);

    if (resetError) {
      console.error("Error resetting call status:", resetError);
    } else {
      // Update the existingCall object for the rest of the function
      existingCall.status = "ringing";
      existingCall.offer = undefined;
      existingCall.answer = undefined;
      wasReset = true;
    }
  }

  // If we reset the call, we need to create a fresh offer
  // Don't try to reuse old offers/answers as they won't match the new peer connection
  if (wasReset) {
    console.log("Call was reset, creating fresh offer...");
    // Create a new offer for the reset call
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const offerData = { type: offer.type, sdp: offer.sdp };
    const { error: updateError } = await supabase
      .from("calls")
      .update({ offer: offerData as Json })
      .eq("id", existingCall.id);

    if (updateError) {
      console.error("Error updating call with new offer:", updateError);
      throw new Error(`Failed to create offer: ${updateError.message}`);
    }

    console.log("Fresh offer created and set for reset call");
    // Continue to set up listener below - don't process old answers/offers
  } else if (existingCall.answer && pc.remoteDescription === null) {
    // If the existing call has an answer from parent, handle it
    // BUT: We need to have a local offer first before we can set a remote answer
    if (pc.localDescription === null) {
      // No local offer exists - we need to create one first
      // This happens when child reconnects to an existing call that already has an answer
      console.log(
        "Existing call has answer but no local offer - creating offer first..."
      );

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Update the call with the offer (in case it wasn't saved before)
      const offerData = { type: offer.type, sdp: offer.sdp };
      await supabase
        .from("calls")
        .update({ offer: offerData as Json })
        .eq("id", existingCall.id);

      console.log("Created and set local offer, now setting remote answer");
    }

    // Now we can set the remote answer (peer connection should be in "have-local-offer" state)
    const answerDesc =
      existingCall.answer as unknown as RTCSessionDescriptionInit;
    await pc.setRemoteDescription(new RTCSessionDescription(answerDesc));

    // Process queued ICE candidates
    for (const candidate of iceCandidatesQueue.current) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    iceCandidatesQueue.current = [];
    setIsConnecting(false);
  } else if (existingCall.offer && !wasReset) {
    // Call has an offer, but we're using a new peer connection
    // Old offers from previous peer connections won't work - create a fresh one
    // This happens when child navigates back to call page with a new peer connection
    console.log(
      "Existing call has offer, but creating fresh offer for new peer connection..."
    );

    if (pc.localDescription === null) {
      // Create a fresh offer instead of reusing the old one
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const offerData = { type: offer.type, sdp: offer.sdp };
      const { error: updateError } = await supabase
        .from("calls")
        .update({ offer: offerData as Json })
        .eq("id", existingCall.id);

      if (updateError) {
        console.error("Error updating call with fresh offer:", updateError);
        throw new Error(`Failed to create offer: ${updateError.message}`);
      }

      console.log("Fresh offer created and set for existing call");
    } else {
      console.log("Peer connection already has local description, skipping");
    }
  } else {
    // No offer exists - child needs to create one
    console.log("Existing call has no offer, creating one...");

    // Verify call still exists and is in correct state
    const { data: verifyCall, error: verifyError } = await supabase
      .from("calls")
      .select("id, status, caller_type")
      .eq("id", existingCall.id)
      .single();

    if (verifyError || !verifyCall) {
      console.error("Call verification failed:", verifyError);
      throw new Error(
        `Call ${existingCall.id} no longer exists or cannot be accessed`
      );
    }

    if (isCallTerminal(verifyCall)) {
      throw new Error("Call has already ended");
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const offerData = { type: offer.type, sdp: offer.sdp };
    console.log("Updating call with offer:", {
      callId: existingCall.id,
      offerData,
    });

    // Try update without select first to avoid potential issues
    const { data: updateData, error: updateError } = await supabase
      .from("calls")
      .update({ offer: offerData as Json })
      .eq("id", existingCall.id)
      .select();

    console.log("Update response:", { data: updateData, error: updateError });

    if (updateError) {
      console.error("Error updating call with offer:", updateError);
      console.error("Error code:", updateError.code);
      console.error("Error message:", updateError.message);
      console.error("Error details:", JSON.stringify(updateError, null, 2));
      console.error("Call ID:", existingCall.id);
      console.error("Offer data:", offerData);
      console.error("Offer data type:", typeof offerData);
      console.error("Offer data JSON:", JSON.stringify(offerData));

      // Check if it's a schema cache issue
      if (
        updateError.code === "PGRST204" ||
        updateError.message?.includes("Could not find the 'offer' column")
      ) {
        throw new Error(
          "Database schema cache is out of sync. Please refresh the page or contact support."
        );
      }

      // Check for RLS policy issues (403 Forbidden)
      if (
        updateError.code === "42501" ||
        updateError.code === "PGRST301" ||
        updateError.message?.includes("permission denied") ||
        updateError.message?.includes("new row violates row-level security")
      ) {
        throw new Error(
          `Permission denied: ${updateError.message}. Check RLS policies.`
        );
      }

      // Check for validation/constraint issues (400 Bad Request)
      if (updateError.code === "PGRST204" || updateError.code === "23514") {
        throw new Error(
          `Validation error: ${updateError.message}. Check data format.`
        );
      }

      throw new Error(
        `Failed to send offer: ${
          updateError.message || JSON.stringify(updateError)
        }`
      );
    }

    console.log("Offer created and sent for existing call");
  }

  // Set up listener for this existing call
  return supabase
    .channel(`call:${existingCall.id}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "calls",
        filter: `id=eq.${existingCall.id}`,
      },
      async (payload) => {
        try {
          const updatedCall = payload.new as CallRecord;
          const oldCall = payload.old as CallRecord;

          // Check if call is in terminal state - only process if status actually changed TO terminal
          const isTerminal = isCallTerminal(updatedCall);
          // CRITICAL: Only treat as ended if we have a previous state that was NOT terminal
          // If oldCall is undefined, we can't be sure this is a new termination
          const wasTerminal = oldCall ? isCallTerminal(oldCall) : null; // null means unknown, not false

          // Only process if we have a previous state and it was NOT terminal
          if (isTerminal && oldCall !== undefined && wasTerminal === false) {
            const iceState = pc.iceConnectionState;
            console.info(
              "🛑 [CALL LIFECYCLE] Call ended by remote party (child handler - existing call)",
              {
                callId: updatedCall.id,
                oldStatus: oldCall?.status,
                newStatus: updatedCall.status,
                ended_at: updatedCall.ended_at,
                reason: "Status changed to terminal state in database",
                timestamp: new Date().toISOString(),
                connectionState: pc.connectionState,
                iceConnectionState: iceState,
                signalingState: pc.signalingState,
              }
            );
            // Always close when call is ended - don't wait for ICE state
            // The call was explicitly ended, so we should close immediately
            console.log(
              "🛑 [CALL LIFECYCLE] Call ended - closing peer connection immediately",
              {
                iceState,
                reason:
                  "Call status changed to terminal - closing regardless of ICE state",
              }
            );

            if (pc.signalingState !== "closed") {
              pc.close();
            }
            return;
          }

          // If status changed to "active", that means parent answered
          if (updatedCall.status === "active" && oldCall?.status !== "active") {
            console.log(
              "Call status changed to active - parent answered the call!"
            );
          }

          // Process answer if received and not already set
          if (updatedCall.answer && pc.remoteDescription === null) {
            console.log(
              "Received answer from parent, setting remote description..."
            );
            const answerDesc =
              updatedCall.answer as unknown as RTCSessionDescriptionInit;

            try {
              await pc.setRemoteDescription(
                new RTCSessionDescription(answerDesc)
              );
              console.log("Remote description set successfully");

              // Process queued ICE candidates
              for (const candidate of iceCandidatesQueue.current) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                  // Silently handle duplicate candidates
                }
              }
              iceCandidatesQueue.current = [];
              setIsConnecting(false);
              console.log("Call connected!");
            } catch (error) {
              console.error("Error setting remote description:", error);
            }
          }

          // Add ICE candidates - CRITICAL for connection establishment
          // Child reads parent's candidates from parent_ice_candidates field
          const candidatesToProcess =
            updatedCall.parent_ice_candidates as unknown as
              | RTCIceCandidateInit[]
              | null;

          if (candidatesToProcess && Array.isArray(candidatesToProcess)) {
            // Only log summary periodically (every 10th batch)
            const processedCount = candidatesToProcess.length;
            if (processedCount > 0 && processedCount % 10 === 0) {
              console.log(
                "🧊 [CHILD HANDLER] Processing ICE candidates (from parent):",
                {
                  count: processedCount,
                  iceConnectionState: pc.iceConnectionState,
                }
              );
            }

            for (const candidate of candidatesToProcess) {
              try {
                // Validate candidate before adding
                if (!candidate.candidate) {
                  console.warn(
                    "⚠️ [CHILD HANDLER] Skipping invalid candidate (no candidate field)"
                  );
                  continue;
                }

                if (pc.remoteDescription) {
                  const iceCandidate = new RTCIceCandidate(candidate);
                  await pc.addIceCandidate(iceCandidate);
                  // Silently process - only log errors
                } else {
                  // Queue candidates if remote description not set yet
                  iceCandidatesQueue.current.push(candidate);
                }
              } catch (err) {
                // Log duplicate candidate errors for debugging
                const error = err as Error;
                if (
                  error.message?.includes("duplicate") ||
                  error.message?.includes("already")
                ) {
                  // Silently handle duplicate candidates
                } else {
                  console.error(
                    "❌ [CHILD HANDLER] Error adding ICE candidate:",
                    error.message
                  );
                }
              }
            }
          }
        } catch (error) {
          console.error("Error in call update handler:", error);
        }
      }
    )
    .subscribe();
};

const handleIncomingCallFromParent = async (
  pc: RTCPeerConnection,
  call: CallRecord,
  setCallId: (id: string) => void,
  setIsConnecting: (value: boolean) => void,
  iceCandidatesQueue: React.MutableRefObject<RTCIceCandidateInit[]>
) => {
  // Answer incoming call from parent
  console.log("✅ [CHILD HANDLER] Answering incoming call from parent:", {
    callId: call.id,
    hasOffer: !!call.offer,
    offerType: (call.offer as any)?.type,
  });
  setCallId(call.id);

  if (!call.offer) {
    throw new Error("Cannot answer call: offer not found");
  }

  const offerDesc = call.offer as unknown as RTCSessionDescriptionInit;
  console.log(
    "✅ [CHILD HANDLER] Setting remote description with parent's offer..."
  );

  // Set the remote description (mirror parent's approach)
  await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));

  // Wait for signaling state to change to have-remote-offer (mirror parent's approach)
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for signaling state change"));
    }, 5000);

    const checkState = () => {
      if (
        pc.signalingState === "have-remote-offer" ||
        pc.signalingState === "have-local-pranswer"
      ) {
        clearTimeout(timeout);
        resolve();
      } else {
        setTimeout(checkState, 100);
      }
    };
    checkState();
  });

  // CRITICAL: Verify tracks are added before creating answer
  // This MUST match parent's approach exactly for parent-to-child calls
  const senderTracks = pc
    .getSenders()
    .map((s) => s.track)
    .filter(Boolean);
  console.log("📹 [CHILD HANDLER] Tracks in peer connection before answer:", {
    audioTracks: senderTracks.filter((t) => t?.kind === "audio").length,
    videoTracks: senderTracks.filter((t) => t?.kind === "video").length,
    totalTracks: senderTracks.length,
    senders: pc.getSenders().length,
    trackDetails: senderTracks.map((t) => ({
      kind: t.kind,
      id: t.id,
      enabled: t.enabled,
      muted: t.muted,
    })),
  });

  // CRITICAL GUARD: Fail if no tracks are found - this will cause no video/audio
  // This prevents silent failures that break video/audio
  if (senderTracks.length === 0) {
    const errorMsg =
      "❌ [CHILD HANDLER] NO TRACKS FOUND in peer connection! This will cause no video/audio. Make sure initializeConnection() was called and tracks were added.";
    console.error(errorMsg);
    throw new Error(
      "Cannot create answer: no media tracks found. Please ensure camera/microphone permissions are granted."
    );
  }

  // Verify we have both audio and video tracks
  const audioTracks = senderTracks.filter((t) => t?.kind === "audio");
  const videoTracks = senderTracks.filter((t) => t?.kind === "video");
  if (audioTracks.length === 0 && videoTracks.length === 0) {
    const errorMsg = "❌ [CHILD HANDLER] No audio or video tracks found!";
    console.error(errorMsg);
    throw new Error("Cannot create answer: no media tracks available.");
  }

  console.log(
    "✅ [CHILD HANDLER] Creating answer, current state:",
    pc.signalingState
  );
  // CRITICAL: Ensure answer includes media tracks by explicitly requesting them
  // This matches the parent's approach when answering child-initiated calls
  const answer = await pc.createAnswer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });

  // [KCH] Telemetry: Created answer
  console.log("[KCH]", "child", "created answer", !!answer?.sdp);

  console.log(
    "✅ [CHILD HANDLER] Answer created, setting local description..."
  );
  await pc.setLocalDescription(answer);

  // CRITICAL FIX: Verify answer SDP includes media tracks
  const hasAudio = answer.sdp?.includes("m=audio");
  const hasVideo = answer.sdp?.includes("m=video");
  console.log("📋 [CHILD HANDLER] Answer SDP verification:", {
    type: answer.type,
    sdpLength: answer.sdp?.length,
    hasAudio,
    hasVideo,
    sdpPreview: answer.sdp?.substring(0, 200),
  });

  if (!hasAudio && !hasVideo) {
    console.error(
      "❌ [CHILD HANDLER] CRITICAL: Answer SDP has no media tracks! This will cause no video/audio."
    );
    throw new Error(
      "Answer SDP missing media tracks - ensure tracks are added before creating answer"
    );
  }

  console.log("✅ [CHILD HANDLER] Updating call with answer...", {
    callId: call.id,
    answerType: answer.type,
  });

  // [KCH] Telemetry: Saving answer to Supabase
  console.log("[KCH]", "child", "saving answer for call", call.id);

  const { error: updateError } = await supabase
    .from("calls")
    .update({
      answer: { type: answer.type, sdp: answer.sdp } as Json,
      status: "active",
      ended_at: null, // Clear ended_at when reactivating call (constraint requires ended_at IS NULL for non-ended status)
    })
    .eq("id", call.id);

  if (updateError) {
    console.error(
      "❌ [CHILD HANDLER] Error updating call with answer:",
      updateError
    );
    throw new Error(`Failed to send answer: ${updateError.message}`);
  }

  console.log("✅ [CHILD HANDLER] Answer sent successfully to parent");

  // Process any queued ICE candidates that arrived before remote description was set
  const queuedCount = iceCandidatesQueue.current.length;
  if (queuedCount > 0) {
    console.log(
      `✅ [CHILD HANDLER] Processing ${queuedCount} queued ICE candidates after answer`
    );
    for (const candidate of iceCandidatesQueue.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        // Silently handle duplicate candidates
        const error = err as Error;
        if (
          !error.message?.includes("duplicate") &&
          !error.message?.includes("already")
        ) {
          console.error(
            "❌ [CHILD HANDLER] Error processing queued ICE candidate:",
            error.message
          );
        }
      }
    }
    iceCandidatesQueue.current = [];
  }

  setIsConnecting(false);
  console.log(
    "✅ [CHILD HANDLER] Call connected! Child answered parent's call."
  );

  // CRITICAL: Process any existing ICE candidates from parent immediately
  // Parent may have already sent candidates before child's listener was set up
  // Process in background but await properly to ensure candidates are added
  (async () => {
    try {
      const { data: currentCall } = await supabase
        .from("calls")
        .select("parent_ice_candidates")
        .eq("id", call.id)
        .maybeSingle();

      if (currentCall) {
        const existingCandidates =
          currentCall.parent_ice_candidates as unknown as
            | RTCIceCandidateInit[]
            | null;
        if (
          existingCandidates &&
          Array.isArray(existingCandidates) &&
          existingCandidates.length > 0
        ) {
          console.log(
            "🧊 [CHILD HANDLER] Processing existing ICE candidates from parent (immediate):",
            {
              count: existingCandidates.length,
              hasRemoteDescription: !!pc.remoteDescription,
              iceConnectionState: pc.iceConnectionState,
            }
          );

          for (const candidate of existingCandidates) {
            try {
              if (!candidate.candidate) continue;
              if (pc.remoteDescription) {
                // CRITICAL: Await to ensure candidate is added properly
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log(
                  "✅ [CHILD HANDLER] Added existing ICE candidate from parent"
                );
              } else {
                iceCandidatesQueue.current.push(candidate);
              }
            } catch (err) {
              const error = err as Error;
              if (
                !error.message?.includes("duplicate") &&
                !error.message?.includes("already")
              ) {
                console.error(
                  "❌ [CHILD HANDLER] Error adding existing ICE candidate:",
                  error.message
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(
        "❌ [CHILD HANDLER] Error fetching existing ICE candidates:",
        err
      );
      // Don't block - continue with listener setup
    }
  })(); // IIFE - runs in background without blocking

  // Listen for ICE candidates from parent (mirror parent's approach)
  return supabase
    .channel(`call:${call.id}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "calls",
        filter: `id=eq.${call.id}`,
      },
      async (payload) => {
        const updatedCall = payload.new as CallRecord;
        const oldCall = payload.old as CallRecord;

        // Check if call was ended - use isCallTerminal to check both status and ended_at
        // Only process if status actually changed TO ended (not if it was already ended)
        const isTerminal = isCallTerminal(updatedCall);
        // CRITICAL: Only treat as ended if we have a previous state that was NOT terminal
        // If oldCall is undefined, we can't be sure this is a new termination
        const wasTerminal = oldCall ? isCallTerminal(oldCall) : null; // null means unknown, not false

        // Only process if we have a previous state and it was NOT terminal
        if (isTerminal && oldCall !== undefined && wasTerminal === false) {
          const iceState = pc.iceConnectionState;
          console.info(
            "🛑 [CALL LIFECYCLE] Call ended by remote party (child handler - incoming call)",
            {
              callId: updatedCall.id,
              oldStatus: oldCall?.status,
              newStatus: updatedCall.status,
              ended_at: updatedCall.ended_at,
              reason: "Status changed to terminal state in database",
              timestamp: new Date().toISOString(),
              connectionState: pc.connectionState,
              iceConnectionState: iceState,
              signalingState: pc.signalingState,
            }
          );
          // Always close when call is ended - don't wait for ICE state
          // The call was explicitly ended, so we should close immediately
          console.log(
            "🛑 [CALL LIFECYCLE] Call ended - closing peer connection immediately",
            {
              iceState,
              reason:
                "Call status changed to terminal - closing regardless of ICE state",
            }
          );

          if (pc.signalingState !== "closed") {
            pc.close();
          }
          return;
        }

        // Add ICE candidates - CRITICAL for connection establishment
        // Child reads parent's candidates from parent_ice_candidates field
        const candidatesToProcess =
          updatedCall.parent_ice_candidates as unknown as
            | RTCIceCandidateInit[]
            | null;

        if (candidatesToProcess && Array.isArray(candidatesToProcess)) {
          const queuedCount = iceCandidatesQueue.current.length;
          const processedCount = candidatesToProcess.length;

          // Only log summary periodically to reduce console spam (every 10th batch)
          if (processedCount > 0 && processedCount % 10 === 0) {
            console.log(
              "🧊 [CHILD HANDLER] Processing ICE candidates (incoming call, from parent):",
              {
                count: processedCount,
                iceConnectionState: pc.iceConnectionState,
              }
            );
          }

          // Track processed candidates to avoid duplicates
          const processedCandidates = new Set<string>();

          for (const candidate of candidatesToProcess) {
            try {
              // Validate candidate before adding
              if (!candidate.candidate) {
                continue; // Skip invalid candidates silently
              }

              // Create unique key for candidate
              const candidateKey = `${candidate.candidate}-${
                candidate.sdpMLineIndex
              }-${candidate.sdpMid || ""}`;

              // Skip if already processed
              if (processedCandidates.has(candidateKey)) {
                continue;
              }
              processedCandidates.add(candidateKey);

              if (pc.remoteDescription) {
                const iceCandidate = new RTCIceCandidate(candidate);
                await pc.addIceCandidate(iceCandidate);
                // Silently process - only log errors
              } else {
                // Queue candidates if remote description not set yet
                iceCandidatesQueue.current.push(candidate);
              }
            } catch (err) {
              const error = err as Error;
              // Silently handle duplicate candidates
              if (
                !error.message?.includes("duplicate") &&
                !error.message?.includes("already")
              ) {
                console.error(
                  "❌ [CHILD HANDLER] Error adding ICE candidate:",
                  error.message
                );
              }
            }
          }

          // Log summary only periodically (every 10th batch)
          if (
            processedCount > 0 &&
            processedCandidates.size > 0 &&
            processedCandidates.size % 10 === 0
          ) {
            console.log(
              "✅ [CHILD HANDLER] Processed",
              processedCandidates.size,
              "ICE candidates from parent",
              {
                iceConnectionState: pc.iceConnectionState,
              }
            );
          }
        }
      }
    )
    .subscribe();
};

const handleChildInitiatedCall = async (
  pc: RTCPeerConnection,
  child: ChildSession,
  parentId: string,
  setCallId: (id: string) => void,
  setIsConnecting: (value: boolean) => void,
  iceCandidatesQueue: React.MutableRefObject<RTCIceCandidateInit[]>
) => {
  console.log(
    "📞 [CHILD CALL] Creating call for child:",
    child.id,
    "parent:",
    parentId
  );

  // Verify child exists and parent_id matches before attempting insert
  const { data: childData, error: childCheckError } = await supabase
    .from("children")
    .select("id, parent_id")
    .eq("id", child.id)
    .eq("parent_id", parentId)
    .single();

  if (childCheckError || !childData) {
    console.error("❌ [CHILD CALL] Child verification failed:", {
      childId: child.id,
      parentId: parentId,
      error: childCheckError,
      childData,
    });
    throw new Error(
      `Child verification failed: ${
        childCheckError?.message || "Child not found or parent mismatch"
      }`
    );
  }

  console.log("✅ [CHILD CALL] Child verified, attempting insert:", {
    childId: child.id,
    parentId: parentId,
    childData,
  });

  const { data: call, error: callError } = await supabase
    .from("calls")
    .insert({
      child_id: child.id,
      parent_id: parentId,
      caller_type: "child",
      status: "ringing",
    })
    .select()
    .single();

  if (callError) {
    console.error("❌ [CHILD CALL] Call creation error:", {
      error: callError,
      code: callError.code,
      message: callError.message,
      details: callError.details,
      hint: callError.hint,
      insertData: {
        child_id: child.id,
        parent_id: parentId,
        caller_type: "child",
        status: "ringing",
      },
    });
    throw new Error(`Failed to create call: ${callError.message}`);
  }

  if (!call) {
    throw new Error("Failed to create call: No call data returned");
  }

  console.log("✅ [CHILD CALL] Call created successfully:", {
    callId: call.id,
    childId: call.child_id,
    parentId: call.parent_id,
    callerType: call.caller_type,
    status: call.status,
    createdAt: call.created_at,
  });
  setCallId(call.id);

  // Check peer connection state before creating offer
  if (pc.signalingState === "closed") {
    throw new Error("Peer connection is closed. Please try again.");
  }

  if (pc.connectionState === "closed" || pc.connectionState === "failed") {
    throw new Error(
      `Peer connection is in ${pc.connectionState} state. Please try again.`
    );
  }

  // CRITICAL: Verify tracks are added before creating offer
  // This MUST match parent-to-child flow exactly to ensure video/audio work
  const senderTracks = pc
    .getSenders()
    .map((s) => s.track)
    .filter(Boolean);
  console.log("📹 [CHILD CALL] Tracks in peer connection before offer:", {
    audioTracks: senderTracks.filter((t) => t?.kind === "audio").length,
    videoTracks: senderTracks.filter((t) => t?.kind === "video").length,
    totalTracks: senderTracks.length,
    senders: pc.getSenders().length,
    trackDetails: senderTracks.map((t) => ({
      kind: t.kind,
      id: t.id,
      enabled: t.enabled,
      muted: t.muted,
    })),
  });

  // CRITICAL GUARD: Fail if no tracks are found - this will cause no video/audio
  // This prevents silent failures that break video/audio
  if (senderTracks.length === 0) {
    const errorMsg =
      "❌ [CHILD CALL] NO TRACKS FOUND in peer connection! This will cause no video/audio. Make sure initializeConnection() was called and tracks were added.";
    console.error(errorMsg);
    throw new Error(
      "Cannot create offer: no media tracks found. Please ensure camera/microphone permissions are granted."
    );
  }

  // Verify we have both audio and video tracks
  const audioTracks = senderTracks.filter((t) => t?.kind === "audio");
  const videoTracks = senderTracks.filter((t) => t?.kind === "video");
  if (audioTracks.length === 0 && videoTracks.length === 0) {
    const errorMsg = "❌ [CHILD CALL] No audio or video tracks found!";
    console.error(errorMsg);
    throw new Error("Cannot create offer: no media tracks available.");
  }

  // Create and set offer with media constraints
  // CRITICAL: Ensure offer includes media tracks by explicitly requesting them
  console.log("Creating offer, current signaling state:", pc.signalingState);
  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });

  // [KCH] Telemetry: Created offer
  console.log("[KCH]", "child", "created offer", !!offer?.sdp);

  // CRITICAL FIX: Verify SDP includes media tracks
  const hasAudio = offer.sdp?.includes("m=audio");
  const hasVideo = offer.sdp?.includes("m=video");
  console.log("📋 [CHILD CALL] Offer SDP verification:", {
    hasAudio,
    hasVideo,
    sdpLength: offer.sdp?.length,
    sdpPreview: offer.sdp?.substring(0, 200),
  });

  if (!hasAudio && !hasVideo) {
    console.error(
      "❌ [CHILD CALL] CRITICAL: Offer SDP has no media tracks! This will cause no video/audio."
    );
    throw new Error(
      "Offer SDP missing media tracks - ensure tracks are added before creating offer"
    );
  }
  console.log("Offer created, setting local description...");
  await pc.setLocalDescription(offer);

  const offerData = { type: offer.type, sdp: offer.sdp };
  console.log("Updating call with offer:", { callId: call.id, offerData });

  // [KCH] Telemetry: Saving offer to Supabase
  console.log("[KCH]", "child", "saving offer for call", call.id);

  // Try update without select first to avoid potential issues
  const { data: updateData, error: updateError } = await supabase
    .from("calls")
    .update({ offer: offerData as Json })
    .eq("id", call.id)
    .select();

  console.log("Update response:", { data: updateData, error: updateError });

  if (updateError) {
    console.error("Error updating call with offer:", updateError);
    console.error("Error code:", updateError.code);
    console.error("Error message:", updateError.message);
    console.error("Error details:", JSON.stringify(updateError, null, 2));
    console.error("Call ID:", call.id);
    console.error("Offer data:", offerData);
    console.error("Offer data type:", typeof offerData);
    console.error("Offer data JSON:", JSON.stringify(offerData));

    // Check if it's a schema cache issue
    if (
      updateError.code === "PGRST204" ||
      updateError.message?.includes("Could not find the 'offer' column")
    ) {
      throw new Error(
        "Database schema cache is out of sync. Please refresh the page or contact support."
      );
    }

    // Check for RLS policy issues (403 Forbidden)
    if (
      updateError.code === "42501" ||
      updateError.code === "PGRST301" ||
      updateError.message?.includes("permission denied") ||
      updateError.message?.includes("new row violates row-level security")
    ) {
      throw new Error(
        `Permission denied: ${updateError.message}. Check RLS policies.`
      );
    }

    // Check for validation/constraint issues (400 Bad Request)
    if (updateError.code === "PGRST204" || updateError.code === "23514") {
      throw new Error(
        `Validation error: ${updateError.message}. Check data format.`
      );
    }

    throw new Error(
      `Failed to send offer: ${
        updateError.message || JSON.stringify(updateError)
      }`
    );
  }

  console.log("Offer sent successfully");

  // Listen for answer from parent
  return supabase
    .channel(`call:${call.id}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "calls",
        filter: `id=eq.${call.id}`,
      },
      async (payload) => {
        const updatedCall = payload.new as CallRecord;
        const oldCall = payload.old as CallRecord;

        // Check if call was ended - use isCallTerminal to check both status and ended_at
        // Only process if status actually changed TO ended (not if it was already ended)
        const isTerminal = isCallTerminal(updatedCall);
        // CRITICAL: Only treat as ended if we have a previous state that was NOT terminal
        // If oldCall is undefined, we can't be sure this is a new termination
        const wasTerminal = oldCall ? isCallTerminal(oldCall) : null; // null means unknown, not false

        // Only process if we have a previous state and it was NOT terminal
        if (isTerminal && oldCall !== undefined && wasTerminal === false) {
          const iceState = pc.iceConnectionState;
          console.info(
            "🛑 [CALL LIFECYCLE] Call ended by remote party (child handler - child initiated)",
            {
              callId: updatedCall.id,
              oldStatus: oldCall?.status,
              newStatus: updatedCall.status,
              ended_at: updatedCall.ended_at,
              reason: "Status changed to terminal state in database",
              timestamp: new Date().toISOString(),
              connectionState: pc.connectionState,
              iceConnectionState: iceState,
              signalingState: pc.signalingState,
            }
          );
          // Always close when call is ended - don't wait for ICE state
          // The call was explicitly ended, so we should close immediately
          console.log(
            "🛑 [CALL LIFECYCLE] Call ended - closing peer connection immediately",
            {
              iceState,
              reason:
                "Call status changed to terminal - closing regardless of ICE state",
            }
          );

          if (pc.signalingState !== "closed") {
            pc.close();
          }
          return;
        }

        // Check if parent answered the call - CRITICAL: Process answer before ICE candidates
        if (updatedCall.answer && pc.remoteDescription === null) {
          try {
            console.log(
              "✅ [CHILD HANDLER] Received answer from parent, setting remote description...",
              {
                callId: updatedCall.id,
                hasAnswer: !!updatedCall.answer,
                answerType: (updatedCall.answer as any)?.type,
                currentRemoteDesc: !!pc.remoteDescription,
              }
            );
            const answerDesc =
              updatedCall.answer as unknown as RTCSessionDescriptionInit;
            await pc.setRemoteDescription(
              new RTCSessionDescription(answerDesc)
            );
            console.log(
              "✅ [CHILD HANDLER] Remote description set successfully from parent's answer"
            );

            // Process queued ICE candidates now that remote description is set
            for (const candidate of iceCandidatesQueue.current) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                const error = err as Error;
                if (
                  !error.message?.includes("duplicate") &&
                  !error.message?.includes("already")
                ) {
                  console.error(
                    "❌ [CHILD HANDLER] Error adding queued ICE candidate:",
                    error.message
                  );
                }
              }
            }
            iceCandidatesQueue.current = [];
            setIsConnecting(false);
            console.log(
              "✅ [CHILD HANDLER] Call connected! Child received answer from parent."
            );
            
            // CRITICAL: Process any existing ICE candidates from parent immediately
            // Parent may have already sent candidates before child's listener processed the answer
            // Process in background but await properly to ensure candidates are added
            (async () => {
              try {
                const { data: currentCall } = await supabase
                  .from("calls")
                  .select("parent_ice_candidates")
                  .eq("id", updatedCall.id)
                  .maybeSingle();

                if (currentCall) {
                  const existingCandidates =
                    currentCall.parent_ice_candidates as unknown as
                      | RTCIceCandidateInit[]
                      | null;
                  if (
                    existingCandidates &&
                    Array.isArray(existingCandidates) &&
                    existingCandidates.length > 0
                  ) {
                    console.log(
                      "🧊 [CHILD HANDLER] Processing existing ICE candidates from parent (immediate after answer):",
                      {
                        count: existingCandidates.length,
                        hasRemoteDescription: !!pc.remoteDescription,
                        iceConnectionState: pc.iceConnectionState,
                      }
                    );

                    for (const candidate of existingCandidates) {
                      try {
                        if (!candidate.candidate) continue;
                        if (pc.remoteDescription) {
                          // CRITICAL: Await to ensure candidate is added properly
                          await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } else {
                          iceCandidatesQueue.current.push(candidate);
                        }
                      } catch (err) {
                        const error = err as Error;
                        if (
                          !error.message?.includes("duplicate") &&
                          !error.message?.includes("already")
                        ) {
                          console.error(
                            "❌ [CHILD HANDLER] Error adding existing ICE candidate:",
                            error.message
                          );
                        }
                      }
                    }
                    console.log(
                      "✅ [CHILD HANDLER] Finished processing existing ICE candidates from parent"
                    );
                  }
                }
              } catch (error) {
                console.error(
                  "❌ [CHILD HANDLER] Error fetching existing ICE candidates:",
                  error
                );
                // Don't throw - connection might still work
              }
            })(); // IIFE - runs in background without blocking
          } catch (error: unknown) {
            console.error(
              "❌ [CHILD HANDLER] Error setting remote description from answer:",
              error
            );
            // Don't throw - connection might still work
          }
        }

        // Add ICE candidates - CRITICAL for connection establishment
        // Child reads parent's candidates from parent_ice_candidates field
        const candidatesToProcess =
          updatedCall.parent_ice_candidates as unknown as
            | RTCIceCandidateInit[]
            | null;

        if (candidatesToProcess && Array.isArray(candidatesToProcess)) {
          // Only log summary, not each candidate (reduces console spam)
          const queuedCount = iceCandidatesQueue.current.length;
          const processedCount = candidatesToProcess.length;

          if (processedCount > 0 && processedCount % 10 === 0) {
            // Log every 10th batch to reduce spam
            console.log(
              "🧊 [CHILD HANDLER] Processing ICE candidates (child initiated, from parent):",
              {
                count: processedCount,
                iceConnectionState: pc.iceConnectionState,
              }
            );
          }

          for (const candidate of candidatesToProcess) {
            try {
              // Validate candidate before adding
              if (!candidate.candidate) {
                continue; // Skip invalid candidates silently
              }

              if (pc.remoteDescription) {
                const iceCandidate = new RTCIceCandidate(candidate);
                await pc.addIceCandidate(iceCandidate);
                // Silently process - only log errors
              } else {
                // Queue candidates if remote description not set yet
                iceCandidatesQueue.current.push(candidate);
              }
            } catch (err) {
              const error = err as Error;
              // Silently handle duplicate candidates
              if (
                !error.message?.includes("duplicate") &&
                !error.message?.includes("already")
              ) {
                console.error(
                  "❌ [CHILD HANDLER] Error adding ICE candidate:",
                  error.message
                );
              }
            }
          }
        }
      }
    )
    .subscribe();
};

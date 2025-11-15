// src/utils/callHandlers.ts
// Call handling logic for parent and child roles

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { CallRecord } from "@/types/call";
import { isCallTerminal } from "@/utils/callEnding";

export const handleParentCall = async (
  pc: RTCPeerConnection,
  childId: string,
  userId: string,
  setCallId: (id: string) => void,
  setIsConnecting: (value: boolean) => void,
  iceCandidatesQueue: React.MutableRefObject<RTCIceCandidateInit[]>
) => {
  // First, check if there's an existing call the parent initiated
  // This prevents treating our own outgoing call as incoming
  const { data: existingCall } = await supabase
    .from("calls")
    .select("*")
    .eq("child_id", childId)
    .eq("parent_id", userId)
    .in("status", ["ringing", "active"])
    .eq("caller_type", "parent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingCall) {
    // Parent is continuing an existing call they initiated
    console.log(
      "📞 [PARENT CALL] Using existing parent-initiated call:",
      existingCall.id
    );
    setCallId(existingCall.id);

    // If call has an answer from child, handle it
    if (existingCall.answer && pc.remoteDescription === null) {
      console.log(
        "📞 [PARENT CALL] Existing call has answer, setting remote description..."
      );
      const answerDesc =
        existingCall.answer as unknown as RTCSessionDescriptionInit;
      await pc.setRemoteDescription(new RTCSessionDescription(answerDesc));

      // Process queued ICE candidates
      for (const candidate of iceCandidatesQueue.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          const error = err as Error;
          if (
            !error.message?.includes("duplicate") &&
            !error.message?.includes("already")
          ) {
            console.error("Error adding queued ICE candidate:", error.message);
          }
        }
      }
      iceCandidatesQueue.current = [];
      setIsConnecting(false);
    } else if (!existingCall.offer) {
      // No offer exists - parent needs to create one
      console.log(
        "📞 [PARENT CALL] Existing call has no offer, creating one..."
      );
      const offer = await pc.createOffer();
      
      // [KCH] Telemetry: Created offer (existing call)
      console.log('[KCH]', 'parent', 'created offer', !!offer?.sdp);
      
      await pc.setLocalDescription(offer);

      // [KCH] Telemetry: Saving offer to Supabase (existing call)
      console.log('[KCH]', 'parent', 'saving offer for call', existingCall.id);

      await supabase
        .from("calls")
        .update({ offer: { type: offer.type, sdp: offer.sdp } as Json })
        .eq("id", existingCall.id);
    } else if (existingCall.offer) {
      // Offer exists - check if we need to set it
      const existingOffer = existingCall.offer as unknown as RTCSessionDescriptionInit;
      
      // Check current state of peer connection
      const hasLocalDesc = pc.localDescription !== null;
      const signalingState = pc.signalingState;
      const hasTracks = pc.getSenders().length > 0;
      
      console.log("📞 [PARENT CALL] Checking existing offer:", {
        hasLocalDescription: hasLocalDesc,
        signalingState,
        hasTracks,
        offerType: existingOffer.type,
        offerSdpLength: existingOffer.sdp?.length,
      });
      
      // If peer connection already has tracks, it's been initialized and we shouldn't try to set
      // the local description from an old offer - the connection is already in progress
      if (hasTracks && hasLocalDesc) {
        console.log(
          "✅ [PARENT CALL] Peer connection already initialized with tracks and local description. " +
          "Skipping setLocalDescription - connection is already in progress."
        );
      } else if (!hasLocalDesc && signalingState === "stable" && !hasTracks) {
        // No local description set, connection is stable, and no tracks yet - safe to set it
        console.log(
          "📞 [PARENT CALL] Setting local description from existing offer..."
        );
        try {
          await pc.setLocalDescription(new RTCSessionDescription(existingOffer));
          console.log("✅ [PARENT CALL] Successfully set local description from existing offer");
        } catch (error: unknown) {
          const err = error as Error;
          // If error is about SDP mismatch, the description was set elsewhere or connection state changed
          if (err.message?.includes("does not match") || err.message?.includes("SDP") || err.message?.includes("InvalidModificationError")) {
            console.warn(
              "⚠️ [PARENT CALL] Could not set local description - already set with different SDP. " +
              "This may indicate the connection was already initialized. Continuing without error..."
            );
            // Don't throw - continue with the call setup
          } else {
            // Re-throw other errors
            console.error("❌ [PARENT CALL] Unexpected error setting local description:", err);
            throw error;
          }
        }
      } else if (hasLocalDesc) {
        // Local description already exists - verify it matches
        if (pc.localDescription.sdp !== existingOffer.sdp) {
          console.warn(
            "⚠️ [PARENT CALL] Local description already set but doesn't match existing offer. " +
            `Current SDP length: ${pc.localDescription.sdp?.length}, Offer SDP length: ${existingOffer.sdp?.length}. ` +
            "This may indicate a race condition. Skipping setLocalDescription and continuing."
          );
        } else {
          console.log(
            "✅ [PARENT CALL] Local description already matches existing offer"
          );
        }
      } else {
        // Signaling state is not stable or has tracks - connection is in progress
        console.warn(
          `⚠️ [PARENT CALL] Cannot set local description - signaling state is "${signalingState}", hasTracks: ${hasTracks}. ` +
          "This may indicate the connection is already in progress. Skipping setLocalDescription."
        );
      }
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

            // Check if call is in terminal state
            if (isCallTerminal(updatedCall)) {
              const iceState = pc.iceConnectionState;
              console.error(
                "🛑 [CALL LIFECYCLE] Call ended by remote party (parent handler - existing call)",
                {
                  callId: updatedCall.id,
                  oldStatus: oldCall?.status,
                  newStatus: updatedCall.status,
                  reason: "Status changed to 'ended' in database",
                  timestamp: new Date().toISOString(),
                  connectionState: pc.connectionState,
                  iceConnectionState: iceState,
                  signalingState: pc.signalingState,
                }
              );
              if (pc.signalingState !== "closed") {
                pc.close();
              }
              return;
            }

            // Check if child answered the call
            if (updatedCall.answer && pc.remoteDescription === null) {
              try {
                console.log(
                  "✅ [PARENT HANDLER] Parent received answer from child (existing call), setting remote description..."
                );
                const answerDesc =
                  updatedCall.answer as unknown as RTCSessionDescriptionInit;
                await pc.setRemoteDescription(
                  new RTCSessionDescription(answerDesc)
                );

                // Process queued ICE candidates
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
                        "❌ [PARENT HANDLER] Error adding queued ICE candidate:",
                        error.message
                      );
                    }
                  }
                }
                iceCandidatesQueue.current = [];
                setIsConnecting(false);
              } catch (error: unknown) {
                console.error(
                  "❌ [PARENT HANDLER] Error setting remote description:",
                  error
                );
              }
            }

            // Add ICE candidates from child
            const candidatesToProcess = updatedCall.child_ice_candidates as unknown as
              | RTCIceCandidateInit[]
              | null;

            if (candidatesToProcess && Array.isArray(candidatesToProcess)) {
              for (const candidate of candidatesToProcess) {
                try {
                  if (!candidate.candidate) {
                    continue;
                  }

                  if (pc.remoteDescription) {
                    const iceCandidate = new RTCIceCandidate(candidate);
                    await pc.addIceCandidate(iceCandidate);
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
                      "❌ [PARENT HANDLER] Error adding ICE candidate:",
                      error.message
                    );
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error in parent call update handler:", error);
          }
        }
      )
      .subscribe();
  }

  // Check if there's an incoming call from child
  const { data: incomingCall } = await supabase
    .from("calls")
    .select("*")
    .eq("child_id", childId)
    .eq("parent_id", userId)
    .eq("status", "ringing")
    .eq("caller_type", "child")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (incomingCall) {
    // Answer incoming call from child
    setCallId(incomingCall.id);

    if (!incomingCall.offer) {
      console.log("Incoming call has no offer yet, waiting for offer...");
      // Set up listener to wait for offer
      const channel = supabase
        .channel(`call:${incomingCall.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "calls",
            filter: `id=eq.${incomingCall.id}`,
          },
          async (payload) => {
            const updatedCall = payload.new as CallRecord;
            if (updatedCall.offer && pc.remoteDescription === null) {
              console.log("Received offer, setting remote description...");
              const offerDesc =
                updatedCall.offer as unknown as RTCSessionDescriptionInit;
              await pc.setRemoteDescription(
                new RTCSessionDescription(offerDesc)
              );

              // Wait for signaling state to change
              await new Promise<void>((resolve) => {
                const checkState = () => {
                  if (
                    pc.signalingState === "have-remote-offer" ||
                    pc.signalingState === "have-local-pranswer"
                  ) {
                    resolve();
                  } else {
                    setTimeout(checkState, 100);
                  }
                };
                checkState();
              });

              // CRITICAL: Verify tracks are added before creating answer
              // This MUST match the main answer path exactly
              const senderTracks = pc
                .getSenders()
                .map((s) => s.track)
                .filter(Boolean);
              console.log(
                "📹 [PARENT HANDLER] Tracks in peer connection before answer (waiting for offer):",
                {
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
                }
              );

              // CRITICAL GUARD: Fail if no tracks are found
              if (senderTracks.length === 0) {
                const errorMsg =
                  "❌ [PARENT HANDLER] NO TRACKS FOUND in peer connection! This will cause no video/audio. Make sure initializeConnection() was called and tracks were added.";
                console.error(errorMsg);
                throw new Error(
                  "Cannot create answer: no media tracks found. Please ensure camera/microphone permissions are granted."
                );
              }

              const answer = await pc.createAnswer();
              
              // [KCH] Telemetry: Created answer (waiting for offer)
              console.log('[KCH]', 'parent', 'created answer', !!answer?.sdp);
              
              await pc.setLocalDescription(answer);

              // CRITICAL FIX: Verify answer SDP includes media tracks
              const hasAudio = answer.sdp?.includes("m=audio");
              const hasVideo = answer.sdp?.includes("m=video");
              console.log("📋 [PARENT HANDLER] Answer SDP verification (waiting for offer):", {
                type: answer.type,
                sdpLength: answer.sdp?.length,
                hasAudio,
                hasVideo,
                sdpPreview: answer.sdp?.substring(0, 200),
              });

              if (!hasAudio && !hasVideo) {
                console.error(
                  "❌ [PARENT HANDLER] CRITICAL: Answer SDP has no media tracks! This will cause no video/audio."
                );
                throw new Error(
                  "Answer SDP missing media tracks - ensure tracks are added before creating answer"
                );
              }

              // [KCH] Telemetry: Saving answer to Supabase (waiting for offer)
              console.log('[KCH]', 'parent', 'saving answer for call', incomingCall.id);

              await supabase
                .from("calls")
                .update({
                  answer: { type: answer.type, sdp: answer.sdp } as Json,
                  status: "active",
                  ended_at: null, // Clear ended_at when reactivating call (constraint requires ended_at IS NULL for non-ended status)
                })
                .eq("id", incomingCall.id);

              setIsConnecting(false);
            }
          }
        )
        .subscribe();
      return channel;
    }

    // Offer exists, proceed with answer (mirror child's approach when answering parent's call)
    const offerDesc =
      incomingCall.offer as unknown as RTCSessionDescriptionInit;
    console.log(
      "✅ [PARENT HANDLER] Setting remote description with child's offer..."
    );
    await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));

    // Wait for signaling state to change to have-remote-offer (mirror child's approach)
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
    // This MUST match child's approach exactly for child-to-parent calls
    const senderTracks = pc
      .getSenders()
      .map((s) => s.track)
      .filter(Boolean);
    console.log(
      "📹 [PARENT HANDLER] Tracks in peer connection before answer:",
      {
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
      }
    );

    // CRITICAL GUARD: Fail if no tracks are found - this will cause no video/audio
    // This prevents silent failures that break video/audio
    if (senderTracks.length === 0) {
      const errorMsg =
        "❌ [PARENT HANDLER] NO TRACKS FOUND in peer connection! This will cause no video/audio. Make sure initializeConnection() was called and tracks were added.";
      console.error(errorMsg);
      throw new Error(
        "Cannot create answer: no media tracks found. Please ensure camera/microphone permissions are granted."
      );
    }

    // Verify we have both audio and video tracks
    const audioTracks = senderTracks.filter((t) => t?.kind === "audio");
    const videoTracks = senderTracks.filter((t) => t?.kind === "video");
    if (audioTracks.length === 0 && videoTracks.length === 0) {
      const errorMsg = "❌ [PARENT HANDLER] No audio or video tracks found!";
      console.error(errorMsg);
      throw new Error("Cannot create answer: no media tracks available.");
    }

    console.log(
      "✅ [PARENT HANDLER] Creating answer, current state:",
      pc.signalingState
    );
    const answer = await pc.createAnswer();
    
    // [KCH] Telemetry: Created answer
    console.log('[KCH]', 'parent', 'created answer', !!answer?.sdp);
    
    console.log(
      "✅ [PARENT HANDLER] Answer created, setting local description..."
    );
    await pc.setLocalDescription(answer);

    // CRITICAL FIX: Verify answer SDP includes media tracks
    const hasAudio = answer.sdp?.includes("m=audio");
    const hasVideo = answer.sdp?.includes("m=video");
    console.log("📋 [PARENT HANDLER] Answer SDP verification:", {
      type: answer.type,
      sdpLength: answer.sdp?.length,
      hasAudio,
      hasVideo,
      sdpPreview: answer.sdp?.substring(0, 200),
    });

    if (!hasAudio && !hasVideo) {
      console.error(
        "❌ [PARENT HANDLER] CRITICAL: Answer SDP has no media tracks! This will cause no video/audio."
      );
      throw new Error(
        "Answer SDP missing media tracks - ensure tracks are added before creating answer"
      );
    }

    console.log("✅ [PARENT HANDLER] Updating call with answer...", {
      callId: incomingCall.id,
      answerType: answer.type,
    });
    
    // [KCH] Telemetry: Saving answer to Supabase
    console.log('[KCH]', 'parent', 'saving answer for call', incomingCall.id);
    
    const { error: updateError } = await supabase
      .from("calls")
      .update({
        answer: { type: answer.type, sdp: answer.sdp } as Json,
        status: "active",
        ended_at: null, // Clear ended_at when reactivating call (constraint requires ended_at IS NULL for non-ended status)
      })
      .eq("id", incomingCall.id);

    if (updateError) {
      console.error(
        "❌ [PARENT HANDLER] Error updating call with answer:",
        updateError
      );
      throw new Error(`Failed to send answer: ${updateError.message}`);
    }

    console.log("✅ [PARENT HANDLER] Answer sent successfully to child");

    // Process any queued ICE candidates that arrived before remote description was set (mirror child's approach)
    const queuedCount = iceCandidatesQueue.current.length;
    if (queuedCount > 0) {
      console.log(
        `✅ [PARENT HANDLER] Processing ${queuedCount} queued ICE candidates after answer`
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
              "❌ [PARENT HANDLER] Error processing queued ICE candidate:",
              error.message
            );
          }
        }
      }
      iceCandidatesQueue.current = [];
    }

    setIsConnecting(false);
    console.log(
      "✅ [PARENT HANDLER] Call connected! Parent answered child's call."
    );

    // Listen for ICE candidates from child
    const channel = supabase
      .channel(`call:${incomingCall.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${incomingCall.id}`,
        },
        async (payload) => {
          const updatedCall = payload.new as CallRecord;

          // Check if call was ended
          if (updatedCall.status === "ended") {
            const iceState = pc.iceConnectionState;
            console.error(
              "🛑 [CALL LIFECYCLE] Call ended by remote party (parent handler)",
              {
                callId: updatedCall.id,
                oldStatus: (payload.old as CallRecord)?.status,
                newStatus: updatedCall.status,
                reason: "Status changed to 'ended' in database",
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
                  "Call status changed to 'ended' - closing regardless of ICE state",
              }
            );

            if (pc.signalingState !== "closed") {
              pc.close();
            }
            return;
          }

          // Add ICE candidates - CRITICAL for connection establishment
          // Parent reads child's candidates from child_ice_candidates field
          const candidatesToProcess = updatedCall.child_ice_candidates as unknown as
            | RTCIceCandidateInit[]
            | null;

          if (candidatesToProcess && Array.isArray(candidatesToProcess)) {
            const queuedCount = iceCandidatesQueue.current.length;
            const processedCount = candidatesToProcess.length;

            // Log first batch and then periodically
            if (processedCount > 0 && (processedCount <= 5 || processedCount % 5 === 0)) {
              console.log(
                "🧊 [PARENT HANDLER] Processing ICE candidates (from child):",
                {
                  count: processedCount,
                  queued: queuedCount,
                  hasRemoteDescription: !!pc.remoteDescription,
                  iceConnectionState: pc.iceConnectionState,
                  source: "child_ice_candidates",
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
                  // Only log first few candidates
                  if (processedCount <= 3) {
                    console.log(
                      "✅ [PARENT HANDLER] Added ICE candidate #" +
                        processedCount
                    );
                  }
                } else {
                  // Queue candidates if remote description not set yet
                  iceCandidatesQueue.current.push(candidate);
                  // Only log first few queued candidates
                  if (queuedCount < 3) {
                    console.log(
                      "⏳ [PARENT HANDLER] Queued ICE candidate (waiting for remote description)"
                    );
                  }
                }
              } catch (err) {
                // Silently handle duplicate candidates
                const error = err as Error;
                if (
                  !error.message?.includes("duplicate") &&
                  !error.message?.includes("already")
                ) {
                  console.error(
                    "❌ [PARENT HANDLER] Error adding ICE candidate:",
                    error.message
                  );
                }
              }
            }
          }
        }
      )
      .subscribe();

    return channel;
  } else {
    // Parent is initiating the call - create call record
    console.log("Parent initiating call to child:", childId);
    const { data: call, error: callError } = await supabase
      .from("calls")
      .insert({
        child_id: childId,
        parent_id: userId,
        caller_type: "parent",
        status: "ringing",
      })
      .select()
      .single();

    if (callError) {
      console.error("Call creation error:", callError);
      throw new Error(`Failed to create call: ${callError.message}`);
    }

    if (!call) {
      throw new Error("Failed to create call: No call data returned");
    }

    console.log("Call created successfully:", call.id);
    setCallId(call.id);

    // CRITICAL: Verify tracks are added before creating offer
    // This MUST match child-to-parent flow exactly to ensure video/audio work
    const senderTracks = pc
      .getSenders()
      .map((s) => s.track)
      .filter(Boolean);
    console.log("📹 [PARENT CALL] Tracks in peer connection before offer:", {
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
        "❌ [PARENT CALL] NO TRACKS FOUND in peer connection! This will cause no video/audio. Make sure initializeConnection() was called and tracks were added.";
      console.error(errorMsg);
      throw new Error(
        "Cannot create offer: no media tracks found. Please ensure camera/microphone permissions are granted."
      );
    }

    // Verify we have both audio and video tracks
    const audioTracks = senderTracks.filter((t) => t?.kind === "audio");
    const videoTracks = senderTracks.filter((t) => t?.kind === "video");
    if (audioTracks.length === 0 && videoTracks.length === 0) {
      const errorMsg = "❌ [PARENT CALL] No audio or video tracks found!";
      console.error(errorMsg);
      throw new Error("Cannot create offer: no media tracks available.");
    }

    // Create and set offer with media constraints (mirror child-to-parent approach)
    // CRITICAL: Ensure offer includes media tracks by explicitly requesting them
    console.log("Creating offer, current signaling state:", pc.signalingState);
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    
    // [KCH] Telemetry: Created offer
    console.log('[KCH]', 'parent', 'created offer', !!offer?.sdp);

    // CRITICAL FIX: Verify SDP includes media tracks
    const hasAudio = offer.sdp?.includes("m=audio");
    const hasVideo = offer.sdp?.includes("m=video");
    console.log("📋 [PARENT CALL] Offer SDP verification:", {
      hasAudio,
      hasVideo,
      sdpLength: offer.sdp?.length,
      sdpPreview: offer.sdp?.substring(0, 200),
    });

    if (!hasAudio && !hasVideo) {
      console.error(
        "❌ [PARENT CALL] CRITICAL: Offer SDP has no media tracks! This will cause no video/audio."
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
    console.log('[KCH]', 'parent', 'saving offer for call', call.id);

    // Try update without select first to avoid potential issues (mirror child-to-parent approach)
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

      throw new Error(`Failed to set offer: ${updateError.message}`);
    }

    console.log(
      "✅ [PARENT CALL] Offer sent successfully, waiting for child's answer..."
    );

    // Listen for answer
    const channel = supabase
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
          try {
            // CRITICAL: Log every UPDATE event to diagnose missing answer
            console.log("📡 [PARENT HANDLER] UPDATE event received:", {
              callId: call.id,
              hasNew: !!payload.new,
              hasOld: !!payload.old,
              timestamp: new Date().toISOString(),
            });

            const updatedCall = payload.new as CallRecord;
            const oldCall = payload.old as CallRecord;

            console.log("📡 [PARENT HANDLER] Update details:", {
              hasAnswer: !!updatedCall.answer,
              hadAnswer: !!oldCall?.answer,
              status: updatedCall.status,
              oldStatus: oldCall?.status,
              hasRemoteDesc: !!pc.remoteDescription,
            });

            // Only log significant status changes (not every UPDATE)
            const statusChanged = oldCall?.status !== updatedCall.status;
            if (
              statusChanged &&
              (updatedCall.status === "ended" ||
                updatedCall.status === "active")
            ) {
              console.log("📞 [PARENT HANDLER] Call status changed:", {
                callId: updatedCall.id,
                oldStatus: oldCall?.status,
                newStatus: updatedCall.status,
              });

              // CRITICAL: If status changed to "active", stop connecting (this stops the ringtone)
              if (
                updatedCall.status === "active" &&
                oldCall?.status !== "active"
              ) {
                console.log(
                  "✅ [PARENT HANDLER] Call status changed to active - stopping ringtone"
                );
                setIsConnecting(false);
              }
            }
            // Log answer only once when first received
            if (updatedCall.answer && !oldCall?.answer) {
              console.log("✅ [PARENT HANDLER] Answer received from child");
            }

            // Check if call is in terminal state - only process if status actually changed TO ended
            // CRITICAL: Only treat as ended if we have a previous state that was NOT terminal
            // If oldCall is undefined, we can't be sure this is a new termination
            const isTerminal = isCallTerminal(updatedCall);
            const wasTerminal = oldCall ? isCallTerminal(oldCall) : null; // null means unknown, not false

            // Only process if we have a previous state and it was NOT terminal
            if (isTerminal && oldCall !== undefined && wasTerminal === false) {
              const iceState = pc.iceConnectionState;
              console.info(
                "🛑 [CALL LIFECYCLE] Call ended by remote party (parent handler - parent initiated)",
                {
                  callId: updatedCall.id,
                  oldStatus: oldCall?.status,
                  newStatus: updatedCall.status,
                  reason: "Status changed to 'ended' in database",
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
                    "Call status changed to 'ended' - closing regardless of ICE state",
                }
              );

              if (pc.signalingState !== "closed") {
                pc.close();
              }
              return;
            }

            // Check if child answered the call - CRITICAL: Process answer before ICE candidates
            if (updatedCall.answer && pc.remoteDescription === null) {
              try {
                console.log(
                  "✅ [PARENT HANDLER] Parent received answer from child, setting remote description...",
                  {
                    callId: updatedCall.id,
                    hasAnswer: !!updatedCall.answer,
                    answerType: (updatedCall.answer as any)?.type,
                    currentRemoteDesc: !!pc.remoteDescription,
                    signalingState: pc.signalingState,
                  }
                );
                const answerDesc =
                  updatedCall.answer as unknown as RTCSessionDescriptionInit;
                await pc.setRemoteDescription(
                  new RTCSessionDescription(answerDesc)
                );
                console.log(
                  "✅ [PARENT HANDLER] Remote description set successfully from child's answer",
                  {
                    signalingState: pc.signalingState,
                    iceConnectionState: pc.iceConnectionState,
                  }
                );

                // Process queued ICE candidates now that remote description is set
                const queuedCount = iceCandidatesQueue.current.length;
                if (queuedCount > 0) {
                  console.log(
                    `✅ [PARENT HANDLER] Processing ${queuedCount} queued ICE candidates after answer`
                  );
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
                          "❌ [PARENT HANDLER] Error adding queued ICE candidate:",
                          error.message
                        );
                      }
                    }
                  }
                  iceCandidatesQueue.current = [];
                }

                // CRITICAL: Set isConnecting to false so UI knows call is connected
                // This allows video playback to start even if ICE is still establishing
                setIsConnecting(false);
                console.log(
                  "✅ [PARENT HANDLER] Call connected! Parent received answer from child.",
                  {
                    signalingState: pc.signalingState,
                    iceConnectionState: pc.iceConnectionState,
                    iceGatheringState: pc.iceGatheringState,
                    hasRemoteDescription: !!pc.remoteDescription,
                    hasLocalDescription: !!pc.localDescription,
                  }
                );

                // CRITICAL: Process any existing ICE candidates from child immediately
                // Child may have already sent candidates before parent's listener processed the answer
                // Process candidates from the updatedCall payload
                const existingCandidates = updatedCall.child_ice_candidates as unknown as
                  | RTCIceCandidateInit[]
                  | null;
                if (
                  existingCandidates &&
                  Array.isArray(existingCandidates) &&
                  existingCandidates.length > 0
                ) {
                  console.log(
                    "🧊 [PARENT HANDLER] Processing existing ICE candidates from child (immediate after answer):",
                    {
                      count: existingCandidates.length,
                      hasRemoteDescription: !!pc.remoteDescription,
                      iceConnectionState: pc.iceConnectionState,
                    }
                  );

                  // Process candidates in background but await properly
                  (async () => {
                    for (const candidate of existingCandidates) {
                      try {
                        if (!candidate.candidate) continue;
                        if (pc.remoteDescription) {
                          // CRITICAL: Await to ensure candidate is added properly
                          await pc.addIceCandidate(
                            new RTCIceCandidate(candidate)
                          );
                          console.log(
                            "✅ [PARENT HANDLER] Added existing ICE candidate from child"
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
                            "❌ [PARENT HANDLER] Error adding existing ICE candidate:",
                            error.message
                          );
                        }
                      }
                    }
                  })(); // IIFE - runs in background without blocking the handler
                }
              } catch (error: unknown) {
                console.error(
                  "❌ [PARENT HANDLER] Error setting remote description:",
                  error
                );
                // Don't throw - connection might still work
              }
            } else if (updatedCall.answer && pc.remoteDescription !== null) {
              console.log(
                "ℹ️ [PARENT HANDLER] Answer received but remote description already set"
              );
            }

            // Add ICE candidates - CRITICAL for connection establishment
            // Parent reads child's candidates from child_ice_candidates field
            const candidatesToProcess = (updatedCall.child_ice_candidates ||
              updatedCall.ice_candidates) as unknown as
              | RTCIceCandidateInit[]
              | null;

            if (candidatesToProcess && Array.isArray(candidatesToProcess)) {
              // Only log summary periodically (every 10th batch)
              const processedCount = candidatesToProcess.length;
              if (processedCount > 0 && processedCount % 10 === 0) {
                console.log(
                  "🧊 [PARENT HANDLER] Processing ICE candidates (from child):",
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
                      "❌ [PARENT HANDLER] Error adding ICE candidate:",
                      error.message
                    );
                  }
                }
              }

              // Log summary if we processed candidates (only periodically)
              if (
                processedCandidates.size > 0 &&
                processedCandidates.size % 10 === 0
              ) {
                console.log(
                  "✅ [PARENT HANDLER] Processed",
                  processedCandidates.size,
                  "ICE candidates from child",
                  {
                    iceConnectionState: pc.iceConnectionState,
                    connectionState: pc.connectionState,
                  }
                );
              }
            }
          } catch (error) {
            console.error("Error in parent call update handler:", error);
            // Don't throw - errors here shouldn't break the call
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 [PARENT CALL] Realtime subscription status:", status, {
          callId: call.id,
        });
        if (status === "SUBSCRIBED") {
          console.log(
            "✅ [PARENT CALL] Successfully subscribed to realtime updates for answer"
          );
        } else if (status === "CHANNEL_ERROR") {
          console.error(
            "❌ [PARENT CALL] Realtime subscription error - answer may not be received!"
          );
        }
      });

    return channel;
  }
};

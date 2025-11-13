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
      await pc.setLocalDescription(offer);

      await supabase
        .from("calls")
        .update({ offer: { type: offer.type, sdp: offer.sdp } as Json })
        .eq("id", existingCall.id);
    } else if (existingCall.offer && pc.localDescription === null) {
      // Offer exists but peer connection doesn't have it - set it
      console.log(
        "📞 [PARENT CALL] Setting local description from existing offer..."
      );
      const offerDesc =
        existingCall.offer as unknown as RTCSessionDescriptionInit;
      await pc.setLocalDescription(new RTCSessionDescription(offerDesc));
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
            const candidatesToProcess = (updatedCall.child_ice_candidates ||
              updatedCall.ice_candidates) as unknown as
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

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

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

    // Offer exists, proceed with answer
    const offerDesc =
      incomingCall.offer as unknown as RTCSessionDescriptionInit;
    console.log("Setting remote description with offer from child...");
    await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));

    // Wait for signaling state to change to have-remote-offer
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
      }
    );

    console.log(
      "✅ [PARENT HANDLER] Creating answer, current state:",
      pc.signalingState
    );
    const answer = await pc.createAnswer();
    console.log(
      "✅ [PARENT HANDLER] Answer created, setting local description..."
    );
    await pc.setLocalDescription(answer);

    console.log("✅ [PARENT HANDLER] Updating call with answer...", {
      callId: incomingCall.id,
      answerType: answer.type,
    });
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
    setIsConnecting(false);

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
          const candidatesToProcess = (updatedCall.child_ice_candidates ||
            updatedCall.ice_candidates) as unknown as
            | RTCIceCandidateInit[]
            | null;

          if (candidatesToProcess && Array.isArray(candidatesToProcess)) {
            const queuedCount = iceCandidatesQueue.current.length;
            const processedCount = candidatesToProcess.length;

            // Only log summary periodically to reduce console spam
            if (processedCount > 0 && processedCount % 5 === 0) {
              console.log(
                "🧊 [PARENT HANDLER] Processing ICE candidates (from child):",
                {
                  count: processedCount,
                  queued: queuedCount,
                  hasRemoteDescription: !!pc.remoteDescription,
                  iceConnectionState: pc.iceConnectionState,
                  source: updatedCall.child_ice_candidates
                    ? "child_ice_candidates"
                    : "ice_candidates (legacy)",
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
    const senderTracks = pc
      .getSenders()
      .map((s) => s.track)
      .filter(Boolean);
    console.log("📹 [PARENT CALL] Tracks in peer connection before offer:", {
      audioTracks: senderTracks.filter((t) => t?.kind === "audio").length,
      videoTracks: senderTracks.filter((t) => t?.kind === "video").length,
      totalTracks: senderTracks.length,
    });

    // Create and set offer with media constraints
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);

    const { error: updateError } = await supabase
      .from("calls")
      .update({ offer: { type: offer.type, sdp: offer.sdp } as Json })
      .eq("id", call.id);

    if (updateError) {
      console.error("Error updating call with offer:", updateError);
      // Check if it's a schema cache issue
      if (
        updateError.code === "PGRST204" ||
        updateError.message?.includes("Could not find the 'offer' column")
      ) {
        throw new Error(
          "Database schema cache is out of sync. Please refresh the page or contact support."
        );
      }
      throw new Error(`Failed to set offer: ${updateError.message}`);
    }

    console.log("Offer set, waiting for child's answer...");

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
            const updatedCall = payload.new as CallRecord;
            const oldCall = payload.old as CallRecord;

            // Only log significant updates to reduce console spam
            if (
              updatedCall.answer ||
              updatedCall.status === "ended" ||
              updatedCall.status === "active"
            ) {
              console.log("Parent call handler received UPDATE:", {
                callId: updatedCall.id,
                status: updatedCall.status,
                hasAnswer: !!updatedCall.answer,
                currentRemoteDesc: !!pc.remoteDescription,
              });
            }

            // Check if call is in terminal state - only process if status actually changed TO ended
            // CRITICAL: Only treat as ended if we have a previous state that was NOT terminal
            // If oldCall is undefined, we can't be sure this is a new termination
            const isTerminal = isCallTerminal(updatedCall);
            const wasTerminal = oldCall ? isCallTerminal(oldCall) : null; // null means unknown, not false

            // Only process if we have a previous state and it was NOT terminal
            if (isTerminal && oldCall !== undefined && wasTerminal === false) {
              const iceState = pc.iceConnectionState;
              console.error(
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
              // Only log if we have candidates and it's a significant update
              const hasNewCandidates = candidatesToProcess.length > 0;
              if (hasNewCandidates) {
                console.log(
                  "🧊 [PARENT HANDLER] Processing ICE candidates (parent initiated, from child):",
                  {
                    count: candidatesToProcess.length,
                    hasRemoteDescription: !!pc.remoteDescription,
                    iceConnectionState: pc.iceConnectionState,
                    connectionState: pc.connectionState,
                    signalingState: pc.signalingState,
                    source: updatedCall.child_ice_candidates
                      ? "child_ice_candidates"
                      : "ice_candidates (legacy)",
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
                    // Only log first few candidates to reduce spam
                    if (processedCandidates.size <= 3) {
                      console.log(
                        "✅ [PARENT HANDLER] Added ICE candidate #" +
                          processedCandidates.size,
                        {
                          candidate:
                            candidate.candidate?.substring(0, 50) + "...",
                          sdpMLineIndex: candidate.sdpMLineIndex,
                          iceConnectionState: pc.iceConnectionState,
                        }
                      );
                    }
                  } else {
                    // Queue candidates if remote description not set yet
                    iceCandidatesQueue.current.push(candidate);
                    // Only log first few queued candidates
                    if (iceCandidatesQueue.current.length <= 3) {
                      console.log(
                        "⏳ [PARENT HANDLER] Queued ICE candidate (waiting for remote description)"
                      );
                    }
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

              // Log summary if we processed candidates
              if (hasNewCandidates && processedCandidates.size > 0) {
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
      .subscribe();

    return channel;
  }
};

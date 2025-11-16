# Call Termination & Ringtone Logic Comparison

## Overview
This document compares how call termination and ringtone start/stop logic works in the `working-calls` branch versus the current implementation.

---

## Ringtone Logic

### Working-Calls Branch (`useVideoCall.ts`)

**Simple, straightforward logic:**

```typescript
// Play ringtone for outgoing calls (when connecting and no remote stream yet)
useEffect(() => {
  if (isConnecting && !remoteStream && callId) {
    // Outgoing call - play ringtone while waiting for answer
    console.log("🔔 [AUDIO] Outgoing call - starting ringtone");
    playRingtone();
  } else if (remoteStream || !isConnecting) {
    // Call answered or connection established - stop ringtone
    console.log("🔇 [AUDIO] Call answered or connected - stopping ringtone");
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
}, [isConnecting, remoteStream, callId, playRingtone, stopRingtone, playCallAnswered]);
```

**Key Points:**
- ✅ Simple condition: `isConnecting && !remoteStream && callId` → play
- ✅ Simple condition: `remoteStream || !isConnecting` → stop
- ✅ No `isIncomingCall` state needed
- ✅ Relies on `isConnecting` being set correctly by call handlers

### Current Implementation (`useVideoCall.ts`)

**More complex with incoming call detection:**

```typescript
// Play ringtone for outgoing calls (when connecting and no remote stream yet)
// CRITICAL: Don't play ringtone for incoming calls being answered
useEffect(() => {
  // CRITICAL: Always stop ringtone first if call is not connecting or has remote stream
  // This ensures ringtone stops immediately when call is answered or ended
  // Also check ref for immediate detection (before async state update)
  const isIncoming = isIncomingCall || isIncomingCallRef.current;
  
  if (!isConnecting || remoteStream || isIncoming) {
    console.log("🔇 [AUDIO] Stopping ringtone - call answered, ended, or incoming:", {
      isConnecting,
      hasRemoteStream: !!remoteStream,
      isIncomingCall,
      isIncomingCallRef: isIncomingCallRef.current,
      callId,
    });
    stopRingtone();
    if (remoteStream && !playAttemptedRef.current) {
      // Play answered sound when remote stream first appears
      playCallAnswered();
    }
  } else if (isConnecting && !remoteStream && callId && !isIncoming) {
    // Outgoing call - play ringtone while waiting for answer
    console.log("🔔 [AUDIO] Outgoing call - starting ringtone");
    playRingtone();
  }

  // Cleanup on unmount or when dependencies change
  return () => {
    stopRingtone();
  };
}, [isConnecting, remoteStream, callId, isIncomingCall, playRingtone, stopRingtone, playCallAnswered]);
```

**Key Points:**
- ⚠️ More complex with `isIncomingCall` state and ref
- ⚠️ Checks `isIncomingCall` to prevent playing ringtone for incoming calls
- ⚠️ More defensive stopping logic (stops if `!isConnecting || remoteStream || isIncoming`)
- ⚠️ Requires `isIncomingCall` to be set correctly via async database query

---

## Call Termination Logic

### Working-Calls Branch

#### Termination Listener Setup

**Set up in callback when `setCallId` is called:**

```typescript
const channel = await handleParentCall(
  pc,
  childId,
  user.id,
  (id: string) => {
    console.log("🚀 [PARENT CALL FLOW] CallId set:", id);
    setCallId(id);
    // Set up termination listener after callId is set
    const terminationChannel = setupCallTerminationListener(id);
    if (terminationChannel) {
      terminationChannelRef.current = terminationChannel;
    }
  },
  setIsConnecting,
  iceCandidatesQueue,
  urlCallId
);
```

**Termination Detection:**

```typescript
const setupCallTerminationListener = (currentCallId: string) => {
  const terminationChannel = supabase
    .channel(`call-termination:${currentCallId}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "calls",
      filter: `id=eq.${currentCallId}`,
    }, async (payload) => {
      const updatedCall = payload.new as CallRecord;
      const oldCall = payload.old as CallRecord | null;
      
      const isTerminal = isCallTerminal(updatedCall);
      const wasTerminal = oldCall ? isCallTerminal(oldCall) : null;
      
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
        // Cleanup...
        cleanupWebRTC();
        // Navigate...
      }
    })
    .subscribe();
  
  return terminationChannel;
};
```

**Key Points:**
- ✅ Simple termination detection
- ✅ Requires `oldCall !== undefined` (prevents false positives on initial subscription)
- ✅ No initial status check when setting up listener
- ✅ Set up synchronously in callback

### Current Implementation

#### Termination Listener Setup

**Set up in useEffect when `callId` changes:**

```typescript
// CRITICAL: Set up termination listener whenever callId changes
useEffect(() => {
  if (callId && callId !== terminationListenerSetupRef.current) {
    console.log("🔔 [CALL LIFECYCLE] Setting up termination listener for callId:", callId);
    terminationListenerSetupRef.current = callId;
    
    // CRITICAL: Check if call is already terminated when setting up listener
    // This handles cases where child ends call before listener is set up
    (async () => {
      try {
        const { data: callData } = await supabase
          .from("calls")
          .select("status, ended_at")
          .eq("id", callId)
          .maybeSingle();
        
        if (callData && isCallTerminal(callData)) {
          console.log("⚠️ [CALL LIFECYCLE] Call is already terminated when setting up listener - triggering cleanup");
          // Immediate cleanup...
          return;
        }
      } catch (error) {
        console.error("Error checking call status:", error);
      }
    })();
    
    const terminationChannel = setupCallTerminationListener(callId);
    // Store channel...
  }
}, [callId, cleanupWebRTC, stopRingtone, setIsConnecting, toast, navigate]);
```

**Termination Detection:**

```typescript
const setupCallTerminationListener = (currentCallId: string) => {
  // ... channel setup ...
  
  async (payload) => {
    const updatedCall = payload.new as CallRecord;
    const oldCall = payload.old as CallRecord | null;
    
    const isTerminal = isCallTerminal(updatedCall);
    const wasTerminal = oldCall ? isCallTerminal(oldCall) : null;
    
    // CRITICAL: Process termination even if oldCall is undefined (might be first event)
    // But only if call is terminal and matches current callId
    // Also check if peer connection is already closed (indicates call was ended by UPDATE listener)
    const pc = peerConnectionRef.current;
    const pcAlreadyClosed = pc && (pc.signalingState === "closed" || pc.connectionState === "closed");
    
    const shouldProcessTermination = 
      isTerminal && 
      updatedCall.id === currentCallId &&
      (oldCall === undefined || wasTerminal === false || pcAlreadyClosed);
    
    if (shouldProcessTermination) {
      // Cleanup...
    }
  }
};
```

**Key Points:**
- ⚠️ More complex termination detection
- ⚠️ Checks `pcAlreadyClosed` to catch cases where UPDATE listener closed connection
- ⚠️ Processes termination even if `oldCall === undefined` (handles late subscription)
- ⚠️ Initial status check when setting up listener (handles early termination)
- ⚠️ Set up asynchronously in useEffect

---

## Call Handler Termination Logic

### Working-Calls Branch (`callHandlers.ts`)

**For incoming calls from child:**

```typescript
// Check if call was ended
if (updatedCall.status === "ended") {
  const iceState = pc.iceConnectionState;
  console.error("🛑 [CALL LIFECYCLE] Call ended by remote party (parent handler)", {
    callId: updatedCall.id,
    // ...
  });
  
  // Always close when call is ended - don't wait for ICE state
  if (pc.signalingState !== "closed") {
    pc.close();
  }
  return;
}

// CRITICAL: If status changed to "active", stop connecting (this stops the ringtone)
if (
  updatedCall.status === "active" &&
  oldCall?.status !== "active"
) {
  console.log("✅ [PARENT HANDLER] Call status changed to active - stopping ringtone");
  setIsConnecting(false);
}

// Check if call is in terminal state
const isTerminal = isCallTerminal(updatedCall);
const wasTerminal = oldCall ? isCallTerminal(oldCall) : null;

if (isTerminal && oldCall !== undefined && wasTerminal === false) {
  // Close peer connection...
  if (pc.signalingState !== "closed") {
    pc.close();
  }
  return;
}
```

**Key Points:**
- ✅ Simple status check: `updatedCall.status === "ended"`
- ✅ Sets `setIsConnecting(false)` when status changes to "active"
- ✅ Uses `isCallTerminal()` for robust detection
- ✅ Closes peer connection but doesn't trigger full cleanup (relies on termination listener)

### Current Implementation (`callHandlers.ts`)

**For incoming calls from child:**

```typescript
// CRITICAL: Check if status changed to "active" - this means call was answered
// Stop ringtone immediately when call becomes active
if (
  updatedCall.status === "active" &&
  oldCall?.status !== "active"
) {
  console.log("✅ [PARENT HANDLER] Call status changed to active (incoming call from child) - stopping ringtone");
  setIsConnecting(false);
  // Don't return - continue to check for terminal state below
}

// Check if call is in terminal state - use isCallTerminal for proper detection
const isTerminal = isCallTerminal(updatedCall);
const wasTerminal = oldCall ? isCallTerminal(oldCall) : null;

// Only process if we have a previous state and it was NOT terminal
if (isTerminal && oldCall !== undefined && wasTerminal === false) {
  const iceState = pc.iceConnectionState;
  console.info("🛑 [CALL LIFECYCLE] Call ended by remote party (parent handler - incoming call from child)", {
    // ...
  });
  
  // CRITICAL: Stop ringtone and reset connecting state when call ends
  setIsConnecting(false);
  
  if (pc.signalingState !== "closed") {
    pc.close();
  }
  return;
}
```

**Key Points:**
- ✅ Uses `isCallTerminal()` for robust detection (checks both `status` and `ended_at`)
- ✅ Sets `setIsConnecting(false)` when status changes to "active"
- ✅ Sets `setIsConnecting(false)` in termination handler
- ✅ Closes peer connection but doesn't trigger full cleanup (relies on termination listener)

---

## Key Differences Summary

### Ringtone Logic

| Aspect | Working-Calls | Current |
|--------|---------------|---------|
| Complexity | Simple | More complex |
| Incoming call detection | No (relies on `isConnecting`) | Yes (`isIncomingCall` state + ref) |
| Stopping logic | `remoteStream \|\| !isConnecting` | `!isConnecting \|\| remoteStream \|\| isIncoming` |
| Race condition handling | None | Uses ref for immediate detection |

### Termination Logic

| Aspect | Working-Calls | Current |
|--------|---------------|---------|
| Listener setup | Synchronous in callback | Asynchronous in useEffect |
| Initial status check | No | Yes (handles early termination) |
| Termination detection | Requires `oldCall !== undefined` | Handles `oldCall === undefined` |
| Peer connection check | No | Yes (`pcAlreadyClosed`) |
| Robustness | Good | Better (handles edge cases) |

### Call Handler Termination

| Aspect | Working-Calls | Current |
|--------|---------------|---------|
| Status check | `status === "ended"` | `isCallTerminal()` (checks both `status` and `ended_at`) |
| Active status handling | Sets `setIsConnecting(false)` | Sets `setIsConnecting(false)` |
| Termination cleanup | Closes PC only | Closes PC + sets `setIsConnecting(false)` |

---

## Recommendations

### For Ringtone Logic

**Working-Calls approach is simpler and more reliable:**
- ✅ Relies on `isConnecting` being set correctly by call handlers
- ✅ No need for `isIncomingCall` state (adds complexity)
- ✅ Simpler condition checks

**Current implementation adds complexity:**
- ⚠️ `isIncomingCall` state requires async database query
- ⚠️ Race conditions between state updates and ringtone logic
- ⚠️ More defensive but harder to reason about

### For Termination Logic

**Current implementation is more robust:**
- ✅ Handles early termination (call ended before listener set up)
- ✅ Handles late subscription (listener set up after call ended)
- ✅ Checks peer connection state for additional safety

**Working-Calls approach is simpler but may miss edge cases:**
- ⚠️ No initial status check (may miss early termination)
- ⚠️ Requires `oldCall !== undefined` (may miss late subscription)
- ⚠️ Simpler but less defensive

---

## Conclusion

The **working-calls branch** has simpler ringtone logic that relies on `isConnecting` being set correctly, while the **current implementation** has more robust termination detection that handles edge cases better.

**Best approach would be:**
1. **Simplify ringtone logic** to match working-calls (remove `isIncomingCall` complexity)
2. **Keep robust termination logic** from current implementation (handles edge cases)
3. **Ensure `setIsConnecting(false)` is called correctly** in all call handlers when call becomes active or ends


# Call Flow Improvements - WhatsApp-like Smooth Experience

## Summary

This document describes the improvements made to align the call flow with the specified WhatsApp-like smooth and efficient flow.

## Key Changes

### 1. State Machine Updates

**New States:**
- `initiating` - Caller creating call_session
- `ringing` - Callee receiving incoming call (replaces `incoming` for clarity)
- `connecting` - WebRTC negotiation in progress
- `connected` / `in_call` - WebRTC connected (aliases for compatibility)

**State Transitions:**
```
idle → initiating → calling (ringing) → connecting → connected (in_call) → ended
```

### 2. Call Creation Flow (Step A)

**Before:** Call created with `status="ringing"` immediately

**After:**
1. Call created with `status="initiating"`
2. Status updated to `status="ringing"` after creation
3. Caller UI shows "Calling..." screen
4. Ring timeout starts (30s)

**Files Modified:**
- `src/features/calls/hooks/modules/handlers/childOutgoingCallHandler.ts`
- `src/features/calls/hooks/modules/handlers/adultOutgoingCallHandler.ts`

### 3. Timers Implementation

**New Timer System:** `src/features/calls/utils/callTimers.ts`

- **Ring Timeout (30s)**: If no answer within 30s, end call with `reason="no_answer"`
- **Connect Timeout (15s)**: If WebRTC negotiation fails within 15s, end call with `reason="failed"`
- **ICE Restart Window (5-8s)**: Attempt recovery after disconnect, if fails end with `reason="network_lost"`

**Usage:**
```typescript
import { callTimers } from "@/features/calls/utils/callTimers";

// Start ring timeout when caller initiates
callTimers.startRingTimeout({
  callId,
  role,
  onRingTimeout: () => {
    // Handle timeout
  }
});

// Start connect timeout when callee accepts
callTimers.startConnectTimeout({
  callId,
  role,
  onConnectTimeout: () => {
    // Handle timeout
  }
});
```

### 4. Busy Detection & Double-Dial Prevention

**New Utility:** `src/features/calls/utils/busyDetection.ts`

**Features:**
- Checks if user has active call in `initiating|ringing|connecting|active|in_call` states
- Prevents double-dial by checking caller before initiating
- Auto-declines with `reason="busy"` if callee is busy

**Implementation:**
- Integrated into `childOutgoingCallHandler.ts` and `adultOutgoingCallHandler.ts`
- Checks callee before creating call_session

### 5. Incoming Call Flow (Step B)

**Improvements:**
- Accepts both `initiating` and `ringing` status for incoming calls
- Automatically updates `initiating` → `ringing` when callee receives
- Callee UI shows "Incoming call" screen with Accept/Decline buttons

**Files Modified:**
- `src/features/calls/hooks/modules/useIncomingCallSubscription.ts`

### 6. Call Acceptance Flow (Step C2)

**Status Transitions:**
1. Callee taps Accept
2. Status updated to `connecting` (WebRTC negotiation starts)
3. Answer created and saved to database
4. When WebRTC connects, status updated to `connected` / `in_call`

**Files Modified:**
- `src/features/calls/hooks/modules/useIncomingCall.ts`

### 7. Edge Cases Handled

#### Answered Elsewhere
- **Status:** Partially implemented (database supports it)
- **Future:** Track active devices, first accept wins, others get `reason="answered_elsewhere"`

#### Busy Detection
- ✅ Implemented - checks for active calls before initiating
- ✅ Auto-declines with `reason="busy"`

#### Double-Dial Prevention
- ✅ Implemented - busy check prevents multiple active calls per user

### 8. Event Contract (Minimal)

**Current Implementation:**
- Uses Supabase Realtime `postgres_changes` events
- INSERT events for `incoming_call`
- UPDATE events for `call_accepted`, `call_declined`, `call_ended`

**Channels:**
- `user:{userId}:calls` - Incoming call notifications (via INSERT filter)
- `call:{call_id}` - Call-specific signaling (offer/answer/ICE)

**Events:**
- `incoming_call` - Detected via INSERT event with `status="ringing"`
- `call_accepted` - Detected via UPDATE with `status="connecting"` and `answer` field
- `call_declined` - Detected via UPDATE with `status="ended"` and `end_reason="declined"`
- `call_ended` - Detected via UPDATE with `status="ended"`

### 9. WebRTC Negotiation (Pattern 1)

**Current Flow (Already Matches Spec):**
1. Caller creates RTCPeerConnection
2. Caller gets local media (audio + video if type=video)
3. Caller creates offer → setLocalDescription()
4. Caller publishes offer to database
5. Callee receives offer → setRemoteDescription()
6. Callee gets local media
7. Callee creates answer → setLocalDescription()
8. Callee publishes answer to database
9. Caller receives answer → setRemoteDescription()
10. Both sides exchange ICE candidates until connected

**Status:** ✅ Already implemented correctly

### 10. Call Ending (Step F)

**Improvements:**
- Properly sets `end_reason` field (hangup, declined, busy, no_answer, failed, network_lost)
- Properly sets `ended_by` field (parent, child, family_member)
- Sets `ended_at` timestamp

**Files:**
- `src/utils/callEnding.ts` - Already supports all end reasons

## Database Schema

**Status Values:**
- `initiating` - Call just created
- `ringing` - Caller waiting for answer
- `connecting` - WebRTC negotiation in progress
- `active` / `in_call` - WebRTC connected
- `ended` - Call terminated

**End Reasons:**
- `hangup` - User explicitly ended
- `declined` - Callee rejected
- `busy` - Callee in another call
- `no_answer` - Ring timeout (30s)
- `failed` - Connect timeout (15s)
- `network_lost` - ICE restart window expired (5-8s)
- `answered_elsewhere` - Accepted on another device (future)

## Testing Checklist

- [ ] Caller initiates call → status transitions: initiating → ringing
- [ ] Callee receives incoming call → shows Accept/Decline UI
- [ ] Callee accepts → status: connecting → connected
- [ ] Callee declines → status: ended, reason: declined
- [ ] Ring timeout (30s) → status: ended, reason: no_answer
- [ ] Connect timeout (15s) → status: ended, reason: failed
- [ ] Busy detection → prevents double-dial
- [ ] ICE restart recovery → network_lost if fails

## Next Steps (Future Improvements)

1. **Device Switching Support**
   - Track active devices per user
   - Ring all devices simultaneously
   - First accept wins, others get "answered elsewhere"

2. **Call Log / Missed Calls**
   - Query ended calls with `end_reason = 'no_answer'` or `'declined'`
   - Display in call history UI
   - Add "Call back" action

3. **Push Notifications**
   - Send push notification if callee not active
   - Handle notification actions (accept/decline)

4. **Presence Integration**
   - Use presence channel to detect if user is online
   - Only send push if offline

## Files Created

- `src/features/calls/utils/callTimers.ts` - Timer management
- `src/features/calls/utils/busyDetection.ts` - Busy detection utility

## Files Modified

- `src/features/calls/hooks/modules/useCallStateMachine.ts` - Added new states
- `src/features/calls/hooks/modules/handlers/childOutgoingCallHandler.ts` - Initiating state, busy check
- `src/features/calls/hooks/modules/handlers/adultOutgoingCallHandler.ts` - Initiating state, busy check
- `src/features/calls/hooks/modules/useIncomingCallSubscription.ts` - Handle initiating status
- `src/features/calls/hooks/modules/useIncomingCall.ts` - Status transitions on accept



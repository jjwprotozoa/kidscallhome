# Current Call Flow Implementation Summary

## Architecture Overview

Your call system uses a **modular, role-based architecture** with WebRTC for media and Supabase Realtime for signaling. The implementation follows a WhatsApp-like flow with proper state management, timers, and edge case handling.

---

## Core Components

### 1. **State Machine** (`useCallStateMachine.ts`)

**States:**

- `idle` - No active call
- `initiating` - Caller creating call_session (new)
- `calling` - Caller waiting for answer (ringing)
- `ringing` / `incoming` - Callee receiving incoming call (aliases)
- `connecting` - WebRTC negotiation in progress
- `connected` / `in_call` - WebRTC connected (aliases)
- `ended` - Call terminated

**State Transitions:**

```
idle → initiating → calling → connecting → connected → ended
                              ↑
                         (incoming/ringing)
```

### 2. **Call Engine** (`useCallEngine.ts`)

**Main Orchestration Hook:**

- Manages call lifecycle
- Routes to role-specific handlers (child/parent/family_member)
- Handles state transitions
- Manages WebRTC connection lifecycle
- Coordinates timers and cleanup

**Key Functions:**

- `startOutgoingCall(remoteId)` - Initiates outgoing call
- `acceptIncomingCall(callId)` - Accepts incoming call
- `rejectIncomingCall(callId)` - Declines incoming call
- `endCall()` - Ends active call
- `toggleMute()` / `toggleVideo()` - Media controls

### 3. **WebRTC Management** (`useWebRTC.ts`)

**Responsibilities:**

- Media acquisition (camera/microphone) via `mediaAccessLock`
- RTCPeerConnection creation and management
- ICE candidate handling
- Remote stream management
- Connection state monitoring
- Network quality monitoring
- Battery-aware quality adjustments

**Key Features:**

- Concurrency guards to prevent duplicate initialization
- Automatic cleanup on unmount
- ICE restart logic for network recovery
- Connection state monitoring with auto-end on failure

### 4. **Call Handlers**

#### Outgoing Call Handlers

- `childOutgoingCallHandler.ts` - Child calling parent/family_member
- `adultOutgoingCallHandler.ts` - Parent/family_member calling child

**Flow:**

1. Check if callee is busy (prevents double-dial)
2. Create call record with `status="initiating"`
3. Update to `status="ringing"` after creation
4. Create WebRTC offer
5. Save offer to database
6. Start ICE candidate gathering

#### Incoming Call Handlers

- `childIncomingCallHandler.ts` - Child receiving from parent/family_member
- `adultIncomingCallHandler.ts` - Parent/family_member receiving from child

**Flow:**

1. Validate incoming call
2. Set remote description (offer)
3. Create answer
4. Save answer to database
5. Update status to `connecting`
6. Exchange ICE candidates

---

## Complete Call Flow

### A) Outgoing Call (Caller Side)

1. **User Taps Call**
   - `startOutgoingCall(remoteId)` called
   - State: `idle` → `calling`

2. **Busy Check**
   - Checks if callee has active call in `connecting|active|in_call` states
   - Blocks if busy, throws error

3. **Call Creation**
   - Creates call record: `status="initiating"`
   - Updates to `status="ringing"` immediately after
   - Caller UI shows "Calling..." screen

4. **WebRTC Setup**
   - Acquires local media (audio + video)
   - Creates RTCPeerConnection
   - Creates offer → `setLocalDescription(offer)`
   - Saves offer to `calls.offer` field

5. **ICE Candidate Gathering**
   - `onicecandidate` handler fires
   - Writes candidates to role-specific field:
     - Parent: `parent_ice_candidates`
     - Child: `child_ice_candidates`
     - Family Member: `parent_ice_candidates` (same as parent)

6. **Waiting for Answer**
   - Subscribes to `call:{callId}` channel
   - Listens for UPDATE events with `answer` field
   - Polls every 2s as fallback (if realtime fails)

7. **Answer Received**
   - Sets remote description: `setRemoteDescription(answer)`
   - Processes queued ICE candidates
   - State: `calling` → `connecting`
   - When ICE connects: `connecting` → `connected` / `in_call`

### B) Incoming Call (Callee Side)

1. **Call Received**
   - Supabase Realtime INSERT event detected
   - Status: `initiating` or `ringing`
   - Auto-updates `initiating` → `ringing` if needed
   - State: `idle` → `ringing` / `incoming`

2. **Incoming Call UI**
   - Shows Accept/Decline buttons
   - Plays ringtone (if tab visible)
   - Shows push notification (if tab not visible)

3. **Pre-warming (Optional)**
   - Attempts to acquire media in background
   - Makes Accept feel instant
   - Fails gracefully if device busy

4. **User Accepts**
   - `acceptIncomingCall(callId)` called
   - State: `ringing` → `connecting`

5. **WebRTC Setup**
   - Acquires local media (if not pre-warmed)
   - Sets remote description: `setRemoteDescription(offer)`
   - Creates answer → `setLocalDescription(answer)`
   - Updates call: `status="connecting"`, saves `answer` field

6. **ICE Candidate Exchange**
   - Reads caller's ICE candidates
   - Writes own candidates
   - When ICE connects: `connecting` → `connected` / `in_call`

### C) Call Active (Both Sides)

- Media streams flowing
- Mute/unmute controls
- Video on/off controls
- Network quality monitoring
- Battery-aware quality adjustments

### D) Call Ending

**User Hangs Up:**

1. `endCall()` called
2. State: `connected` → `ended` (immediate UI feedback)
3. Updates database: `status="ended"`, `end_reason="hangup"`, `ended_by`, `ended_at`
4. Cleans up WebRTC (stops tracks, closes connection)
5. Redirects to dashboard

**Remote Disconnect:**

1. Detected via UPDATE event or WebRTC state change
2. State: `connected` → `ended`
3. Shows notification (if ended by remote party)

**Timeouts:**

- Ring timeout (30s) → `end_reason="no_answer"`
- Connect timeout (15s) → `end_reason="failed"`
- ICE restart window expired (5-8s) → `end_reason="network_lost"`

---

## Database Schema

### `calls` Table

**Fields:**

- `id` - UUID primary key
- `child_id` - Child profile ID
- `parent_id` - Parent profile ID (nullable if family_member)
- `family_member_id` - Family member ID (nullable)
- `caller_type` - `"parent" | "child" | "family_member"`
- `status` - `"initiating" | "ringing" | "connecting" | "active" | "in_call" | "ended"`
- `offer` - JSONB SDP offer from caller
- `answer` - JSONB SDP answer from callee
- `parent_ice_candidates` - JSONB array of parent's ICE candidates
- `child_ice_candidates` - JSONB array of child's ICE candidates
- `created_at` - Timestamp
- `ended_at` - Timestamp (nullable)
- `ended_by` - `"parent" | "child" | "family_member"` (nullable)
- `end_reason` - `"hangup" | "declined" | "busy" | "no_answer" | "failed" | "network_lost"` (nullable)
- `recipient_type` - `"parent" | "child" | "family_member"` (for filtering)

---

## Signaling Channels

### Supabase Realtime Channels

1. **Incoming Call Detection:**
   - Channel: `incoming-calls:{userId}:{role}`
   - Event: `postgres_changes` INSERT
   - Filter: `recipient_type=eq.{role}`

2. **Call Signaling:**
   - Channel: `call:{callId}`
   - Event: `postgres_changes` UPDATE
   - Monitors: `answer`, `status`, ICE candidates

3. **Call Status:**
   - Channel: `call-status:{callId}`
   - Event: `postgres_changes` UPDATE
   - Monitors: Status changes, termination

---

## Edge Cases & Safety Features

### 1. **Busy Detection**

- Checks for active calls before initiating
- Only blocks if callee in `connecting|active|in_call` states
- Excludes ended calls and stale calls (>5 minutes old)
- Prevents double-dial

### 2. **Media Access Lock**

- Prevents concurrent `getUserMedia()` calls
- Queues requests if device busy
- Retries with exponential backoff
- Force cleanup on persistent errors

### 3. **Connection Recovery**

- ICE restart on disconnect (5-8s window)
- Automatic reconnection attempts
- Network quality monitoring
- Graceful degradation (audio-only on poor network)

### 4. **State Synchronization**

- Polling fallback if realtime fails
- Idempotent event processing
- Duplicate ICE candidate filtering
- Race condition protection

### 5. **Cleanup & Resource Management**

- Automatic cleanup on unmount
- Force cleanup on errors
- Stops all media tracks
- Closes peer connections

---

## Timer System

### `callTimers.ts` Utility

**Timers:**

1. **Ring Timeout (30s)**
   - Starts when caller initiates
   - Ends call with `reason="no_answer"` if no answer

2. **Connect Timeout (15s)**
   - Starts when callee accepts
   - Ends call with `reason="failed"` if WebRTC doesn't connect

3. **ICE Restart Window (5-8s)**
   - Starts on disconnect
   - Ends call with `reason="network_lost"` if recovery fails

**Status:** ✅ Created but **not yet integrated** into `useCallEngine.ts`

---

## Current Issues & Known Problems

### 1. **"Device in use" Errors**

- **Cause:** Pre-warming conflicts with idle initialization
- **Fix Applied:** Skip idle init if `localStream` exists
- **Status:** Partially fixed, may still occur in edge cases

### 2. **"InvalidStateError: Called in wrong state: stable"**

- **Cause:** Trying to set remote description when signaling state is already `stable`
- **Location:** `useCallEngine.ts:1231` (answer processing)
- **Fix Needed:** Check signaling state before setting remote description
- **Status:** ⚠️ Needs fix

### 3. **Connection Failures**

- **Cause:** WebRTC connection fails during negotiation
- **Current Behavior:** Logs error, ICE restart attempts recovery
- **Status:** Working as designed, but may need better error handling

### 4. **Video Play Errors**

- **Cause:** Trying to play video after element removed from DOM
- **Location:** `VideoCallUI.tsx:424`
- **Fix Needed:** Check if element still in DOM before playing
- **Status:** ⚠️ Needs fix

---

## File Structure

```
src/features/calls/
├── hooks/
│   ├── useCallEngine.ts          # Main orchestration
│   ├── useWebRTC.ts               # WebRTC management
│   ├── useAudioNotifications.ts  # Ringtone/notifications
│   └── modules/
│       ├── useCallStateMachine.ts      # State management
│       ├── useIncomingCall.ts          # Accept/reject logic
│       ├── useIncomingCallSubscription.ts  # Incoming call detection
│       ├── useOutgoingCall.ts          # Outgoing call logic
│       ├── useCallTermination.ts       # End call logic
│       ├── useCallMedia.ts             # Mute/video controls
│       ├── useCallConnectionState.ts   # Connection monitoring
│       └── handlers/
│           ├── childOutgoingCallHandler.ts
│           ├── childIncomingCallHandler.ts
│           ├── adultOutgoingCallHandler.ts
│           └── adultIncomingCallHandler.ts
├── utils/
│   ├── callTimers.ts              # Timer management (created, not integrated)
│   ├── busyDetection.ts           # Busy detection
│   ├── callEnding.ts              # End call utility
│   ├── mediaAccessLock.ts         # Media acquisition lock
│   └── mediaCleanup.ts            # Media cleanup utilities
└── components/
    └── VideoCallUI.tsx            # Call UI component
```

---

## Integration Status

### ✅ Implemented

- State machine with all states
- Call creation with `initiating` → `ringing` transition
- Busy detection and double-dial prevention
- Incoming call detection and handling
- WebRTC offer/answer exchange
- ICE candidate exchange
- Call termination with proper end reasons
- Media access lock and cleanup
- Connection state monitoring

### ⚠️ Partially Implemented

- Timers (created but not integrated into call engine)
- Pre-warming (works but can conflict with idle init)
- Connection recovery (ICE restart exists but may need tuning)

### ❌ Not Yet Implemented

- Device switching support (answered elsewhere)
- Call log / missed calls UI
- Push notifications integration
- Presence-based call routing

---

## Next Steps

1. **Fix "InvalidStateError"**
   - Add signaling state check before setting remote description
   - Handle `stable` state gracefully

2. **Integrate Timers**
   - Add timer start/stop in `useCallEngine.ts`
   - Wire up timeout callbacks

3. **Fix Video Play Errors**
   - Check DOM before playing
   - Handle element removal gracefully

4. **Improve Pre-warming**
   - Better conflict resolution with idle init
   - More robust error handling

5. **Add Device Switching**
   - Track active devices per user
   - Handle "answered elsewhere" scenario

---

## Testing Checklist

- [x] Outgoing call creation
- [x] Incoming call detection
- [x] Call acceptance
- [x] Call rejection
- [x] WebRTC connection establishment
- [x] ICE candidate exchange
- [x] Call termination
- [ ] Ring timeout (30s)
- [ ] Connect timeout (15s)
- [ ] Busy detection
- [ ] Connection recovery
- [ ] Multi-device scenarios

---

## Key Design Decisions

1. **Pattern 1 (Caller Creates Offer)** - ✅ Implemented
2. **Database Signaling** - Uses Supabase Realtime + polling fallback
3. **Role-Based Routing** - Separate handlers for child/parent/family_member
4. **Modular Architecture** - Separated concerns into focused modules
5. **Graceful Degradation** - Handles errors without breaking UX
6. **Idempotent Operations** - Safe to retry operations

---

This implementation provides a solid foundation for WhatsApp-like call functionality with proper state management, error handling, and edge case coverage.


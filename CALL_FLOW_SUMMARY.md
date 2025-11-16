# Call Flow Summary: Child-to-Parent and Parent-to-Child

## Overview

Both call directions follow **identical patterns with reversed roles**. The key principle is symmetry - what one side does, the other side does in reverse.

---

## Common Initialization (Both Directions)

### Step 1: WebRTC Setup

1. **`initializeConnection()`** is called
   - Requests camera/microphone access via `getUserMedia()`
   - Creates `RTCPeerConnection` with STUN/TURN servers
   - Adds local media tracks to peer connection
   - Sets up event handlers (ontrack, onicecandidate, etc.)

### Step 2: Call Handler Selection

- **Child**: Calls `handleChildCallFlow()` → `handleChildCall()`
- **Parent**: Calls `handleParentCallFlow()` → `handleParentCall()`

---

## Flow 1: Child-to-Parent Call (Child Initiates)

### Phase 1: Child Initiates Call

1. **Check for Existing/Incoming Calls**

   - Check if child has existing call (`caller_type: "child"`, status: "ringing"/"active")
   - Check if parent has incoming call (`caller_type: "parent"`, status: "ringing")
   - If incoming call exists → Answer it (see Flow 2)
   - If no calls exist → Create new call

2. **Create Call Record**

   ```typescript
   INSERT INTO calls {
     child_id: child.id,
     parent_id: parentId,
     caller_type: "child",
     status: "ringing"
   }
   ```

3. **Verify Tracks** (CRITICAL GUARD)

   - Check `pc.getSenders()` has audio/video tracks
   - **FAIL FAST** if no tracks found (prevents silent failures)

4. **Create Offer**

   - `pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })`
   - Verify SDP includes `m=audio` and `m=video` lines
   - `pc.setLocalDescription(offer)`
   - Update call record: `calls.offer = { type, sdp }`

5. **Start ICE Candidate Gathering**

   - `onicecandidate` handler fires
   - Write candidates to `child_ice_candidates` field
   - Parent will read from this field

6. **Listen for Parent's Answer**
   - Subscribe to Supabase realtime channel: `call:${callId}`
   - Wait for `UPDATE` event with `answer` field

### Phase 2: Parent Receives & Answers

1. **Parent Receives Call**

   - Supabase realtime `INSERT` event triggers notification
   - Parent sees incoming call notification

2. **Parent Initializes WebRTC**

   - Same as child: `initializeConnection()` → tracks added

3. **Parent Finds Incoming Call**

   - Query: `calls WHERE child_id = X AND caller_type = "child" AND status = "ringing"`
   - Finds call with `offer` already set

4. **Parent Sets Remote Description**

   - `pc.setRemoteDescription(parent's offer)`
   - Signaling state → `have-remote-offer`

5. **Parent Verifies Tracks** (CRITICAL GUARD)

   - Check `pc.getSenders()` has tracks
   - **FAIL FAST** if no tracks

6. **Parent Creates Answer**

   - `pc.createAnswer()`
   - Verify SDP includes media tracks
   - `pc.setLocalDescription(answer)`
   - Update call: `calls.answer = { type, sdp }`, `status = "active"`

7. **Parent Starts ICE Gathering**
   - Write candidates to `parent_ice_candidates` field
   - Child will read from this field

### Phase 3: Child Receives Answer

1. **Child Receives Answer via Realtime**

   - `UPDATE` event received with `answer` field
   - `pc.setRemoteDescription(child's answer)`
   - Process queued ICE candidates
   - `setIsConnecting(false)` → Call connected!

2. **ICE Candidate Exchange**

   - **Child reads**: `parent_ice_candidates` (parent's candidates)
   - **Child writes**: `child_ice_candidates` (child's candidates)
   - **Parent reads**: `child_ice_candidates` (child's candidates)
   - **Parent writes**: `parent_ice_candidates` (parent's candidates)

3. **Media Flow**
   - ICE connection establishes → `iceConnectionState: "connected"`
   - Remote tracks received via `ontrack` event
   - Tracks unmute → `onunmute` fires
   - Video element plays → Video/audio visible

---

## Flow 2: Parent-to-Child Call (Parent Initiates)

### Phase 1: Parent Initiates Call

1. **Check for Existing/Incoming Calls**

   - Check if parent has existing call (`caller_type: "parent"`)
   - Check if child has incoming call (`caller_type: "child"`)
   - If incoming call exists → Answer it (see Flow 1)
   - If no calls exist → Create new call

2. **Create Call Record**

   ```typescript
   INSERT INTO calls {
     child_id: childId,
     parent_id: userId,
     caller_type: "parent",
     status: "ringing"
   }
   ```

3. **Verify Tracks** (CRITICAL GUARD)

   - Same as child: Check tracks, fail fast if missing

4. **Create Offer**

   - Same as child: Create offer, verify SDP, set local description
   - Update call: `calls.offer = { type, sdp }`

5. **Start ICE Gathering**

   - Write to `parent_ice_candidates` field
   - Child will read from this field

6. **Listen for Child's Answer**
   - Subscribe to realtime channel
   - Wait for `UPDATE` with `answer` field

### Phase 2: Child Receives & Answers

1. **Child Receives Call**

   - Supabase realtime `INSERT` event
   - Child sees notification (ringtone, push notification)

2. **Child Initializes WebRTC**

   - Same initialization process

3. **Child Finds Incoming Call**

   - Query: `calls WHERE child_id = X AND caller_type = "parent" AND status = "ringing"`
   - Finds call with `offer` already set

4. **Child Sets Remote Description**

   - `pc.setRemoteDescription(parent's offer)`
   - Signaling state → `have-remote-offer`

5. **Child Verifies Tracks** (CRITICAL GUARD)

   - Same verification as parent

6. **Child Creates Answer**

   - Same process as parent
   - Update call: `calls.answer = { type, sdp }`, `status = "active"`

7. **Child Starts ICE Gathering**
   - Write to `child_ice_candidates` field

### Phase 3: Parent Receives Answer

1. **Parent Receives Answer via Realtime**

   - Same as child: Set remote description, process candidates
   - `setIsConnecting(false)`

2. **ICE Candidate Exchange**

   - **Parent reads**: `child_ice_candidates` (child's candidates)
   - **Parent writes**: `parent_ice_candidates` (parent's candidates)
   - **Child reads**: `parent_ice_candidates` (parent's candidates)
   - **Child writes**: `child_ice_candidates` (child's candidates)

3. **Media Flow**
   - Same as child-to-parent flow

---

## Key Differences Between Flows

| Aspect                | Child-to-Parent         | Parent-to-Child         |
| --------------------- | ----------------------- | ----------------------- |
| **Initiator**         | Child                   | Parent                  |
| **Caller Type**       | `caller_type: "child"`  | `caller_type: "parent"` |
| **ICE Field (Write)** | `child_ice_candidates`  | `parent_ice_candidates` |
| **ICE Field (Read)**  | `parent_ice_candidates` | `child_ice_candidates`  |
| **Handler**           | `handleChildCall()`     | `handleParentCall()`    |
| **Everything Else**   | **IDENTICAL**           | **IDENTICAL**           |

---

## Critical Guards (Both Directions)

### 1. Track Verification

- **Before creating offer/answer**: Verify `pc.getSenders()` has tracks
- **Fail fast** if no tracks (prevents silent failures)
- **Verify SDP** includes `m=audio` and `m=video` lines

### 2. ICE Candidate Field Separation

- **Never mix fields**: Each role writes to its own field
- **Child writes**: `child_ice_candidates`
- **Parent writes**: `parent_ice_candidates`
- **Read opposite**: Each reads the other's field

### 3. Signaling State Management

- Wait for signaling state changes before proceeding
- Process queued ICE candidates after remote description is set
- Handle duplicate candidates gracefully

---

## Database Fields Used

### Call Record Fields

- `id`: Unique call identifier
- `child_id`: Child user ID
- `parent_id`: Parent user ID
- `caller_type`: "child" or "parent" (who initiated)
- `status`: "ringing", "active", "ended"
- `offer`: SDP offer (JSON)
- `answer`: SDP answer (JSON)
- `parent_ice_candidates`: Parent's ICE candidates (JSON array)
- `child_ice_candidates`: Child's ICE candidates (JSON array)
- `ended_at`: Timestamp when call ended

---

## Realtime Events

### INSERT Event

- Triggers when new call is created
- Used for incoming call notifications
- Both sides listen for this

### UPDATE Event

- Triggers when call is updated (offer, answer, ICE candidates, status)
- Used for signaling exchange
- Both sides listen for updates to their call

---

## WebRTC States

### Signaling States

- `stable`: Initial state
- `have-local-offer`: Local offer set (initiator)
- `have-remote-offer`: Remote offer received (answerer)
- `have-local-pranswer`: Local answer set (answerer)
- `have-remote-pranswer`: Remote answer received (initiator)
- `closed`: Connection closed

### ICE Connection States

- `new`: Initial state
- `checking`: Checking connectivity
- `connected`: Connection established
- `completed`: All candidates processed
- `failed`: Connection failed
- `disconnected`: Temporary disconnection
- `closed`: Connection closed

---

## Error Handling

### Track Verification Errors

- **No tracks found**: Throw error immediately
- **SDP missing media**: Throw error immediately
- **Prevents**: Silent failures that cause no video/audio

### ICE Candidate Errors

- **Duplicate candidates**: Silently ignore
- **Invalid candidates**: Skip with warning
- **Missing remote description**: Queue candidates for later

### Connection Errors

- **ICE failure**: Auto-end call
- **Connection closed**: Cleanup resources
- **Timeout**: Retry with exponential backoff

---

## Testing Checklist

### Child-to-Parent

- [ ] Child creates call successfully
- [ ] Parent receives notification
- [ ] Parent answers call
- [ ] Child receives answer
- [ ] ICE candidates exchange
- [ ] Video/audio works both directions

### Parent-to-Child

- [ ] Parent creates call successfully
- [ ] Child receives notification
- [ ] Child answers call
- [ ] Parent receives answer
- [ ] ICE candidates exchange
- [ ] Video/audio works both directions

---

## Console Logs to Watch

### Good Signs

- `✅ [CHILD/PARENT CALL] Tracks in peer connection before offer/answer`
- `📋 [CHILD/PARENT CALL] Offer/Answer SDP verification: { hasAudio: true, hasVideo: true }`
- `✅ [REMOTE TRACK] Track unmuted - MEDIA IS FLOWING!`
- `✅ ICE STATE: ICE connection established`
- `✅ [VIDEO STREAM] Remote video started playing`

### Bad Signs

- `❌ NO TRACKS FOUND in peer connection!`
- `❌ CRITICAL: Offer/Answer SDP has no media tracks!`
- `❌ CRITICAL: Tracks are muted even though ICE is connected!`
- `⚠️ [REMOTE TRACK] Track muted` (persistent, not just initial)

---

## Summary

**Both flows are identical except for:**

1. Who initiates (caller_type)
2. Which ICE candidate field they write to
3. Which ICE candidate field they read from

**Everything else is symmetric:**

- Track verification
- Offer/answer creation
- SDP verification
- ICE candidate processing
- Media flow handling

This symmetry ensures both directions work reliably and makes debugging easier - if one direction works, the other should work too.

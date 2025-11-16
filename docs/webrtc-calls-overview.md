# WebRTC Calls Overview

## Overview

KidsCallHome implements bidirectional video/audio calls between Parents and Children using WebRTC (Web Real-Time Communication). The implementation uses Supabase for signaling (exchanging SDP offers/answers and ICE candidates) and manages call state in the database.

## Call Flow Architecture

### Parent → Child Call Flow

1. **Parent Initiates Call**

   - Parent clicks "Call" button in ParentDashboard
   - `useCallEngine.startOutgoingCall()` or `callHandlers.initiateCall()` is called
   - Local media (camera + microphone) is acquired via `getUserMedia()`
   - RTCPeerConnection is created with audio + video tracks
   - WebRTC offer is created with `createOffer()`
   - Call record is created in `calls` table with:
     - `caller_type: "parent"`
     - `status: "ringing"`
     - `offer: { type: "offer", sdp: "..." }`
     - `parent_id: <parent_profile_id>`
     - `child_id: <child_profile_id>`
   - Parent's ICE candidates are written to `parent_ice_candidates` field

2. **Child Receives Incoming Call**

   - Child's Supabase realtime subscription detects new call with `status: "ringing"` and `caller_type: "parent"`
   - `useIncomingCallNotifications` hook triggers incoming call UI
   - Child sees incoming call banner/dialog

3. **Child Accepts Call**

   - Child clicks "Accept" button
   - `childCallHandler.handleIncomingCallFromParent()` is called
   - Local media (camera + microphone) is acquired
   - RTCPeerConnection is created with audio + video tracks
   - Remote description is set with parent's offer: `setRemoteDescription(offer)`
   - WebRTC answer is created with `createAnswer()`
   - Local description is set with answer: `setLocalDescription(answer)`
   - Answer is written to `calls` table: `answer: { type: "answer", sdp: "..." }`
   - Child's ICE candidates are written to `child_ice_candidates` field

4. **ICE Candidate Exchange**

   - Parent reads child's ICE candidates from `child_ice_candidates` field
   - Child reads parent's ICE candidates from `parent_ice_candidates` field
   - Each side adds remote candidates via `addIceCandidate()`
   - ICE connection state progresses: `new` → `checking` → `connected` (or `completed`)
   - Connection state reaches `connected`

5. **Call Active**

   - Both sides see remote video stream
   - Both sides hear remote audio
   - Video elements reach `readyState === 4` (HAVE_ENOUGH_DATA)
   - Call status in database is `status: "active"`

6. **Call End (Either Side)**
   - User clicks "Hang Up" button
   - `callEnding.endCall()` is called with `by: "parent"` or `by: "child"`
   - Call record is updated: `status: "ended"`, `ended_at: <timestamp>`, `ended_by: "parent"` or `"child"`
   - RTCPeerConnection is closed
   - Media tracks are stopped
   - Both sides navigate back to dashboard

### Child → Parent Call Flow

The flow is symmetric, with roles reversed:

1. **Child Initiates Call**

   - Call record created with `caller_type: "child"`
   - Child's ICE candidates written to `child_ice_candidates` field

2. **Parent Receives Incoming Call**

   - Parent's Supabase realtime subscription detects new call
   - Parent sees incoming call notification

3. **Parent Accepts Call**

   - `callHandlers.handleIncomingCallFromChild()` is called
   - Parent reads child's offer and creates answer
   - Parent's ICE candidates written to `parent_ice_candidates` field

4. **ICE Candidate Exchange**

   - Parent reads from `child_ice_candidates` (child's candidates)
   - Child reads from `parent_ice_candidates` (parent's candidates)

5. **Call Active** (same as Parent → Child)

6. **Call End** (same as Parent → Child)

## Role Detection and ICE Candidate Routing

### Role Detection Rules

- **Parent Role** (`role: "parent"`):

  - User has authenticated Supabase session (`session` exists)
  - Route path includes `/parent/`
  - Determined synchronously before WebRTC initialization

- **Child Role** (`role: "child"`):
  - User has `childSession` in localStorage but NO authenticated Supabase session
  - Route path includes `/child/`
  - Determined synchronously before WebRTC initialization

### ICE Candidate Routing (CRITICAL)

The routing logic ensures each side writes to its own field and reads from the remote field:

```typescript
// Parent side
if (role === "parent") {
  // Write ICE candidates to parent_ice_candidates
  // Read ICE candidates from child_ice_candidates (remote)
}

// Child side
if (role === "child") {
  // Write ICE candidates to child_ice_candidates
  // Read ICE candidates from parent_ice_candidates (remote)
}
```

**Database Schema:**

- `calls.parent_ice_candidates`: JSONB array of parent's ICE candidates
- `calls.child_ice_candidates`: JSONB array of child's ICE candidates

**Why This Matters:**

- If roles are swapped, ICE candidates won't be exchanged correctly
- Each side must process the OTHER side's candidates, not its own
- Incorrect routing prevents WebRTC connection establishment

## Database Schema

### `calls` Table

```sql
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL,
  child_id UUID NOT NULL,
  caller_type TEXT NOT NULL CHECK (caller_type IN ('parent', 'child')),
  status TEXT NOT NULL CHECK (status IN ('ringing', 'active', 'ended')),
  offer JSONB,
  answer JSONB,
  parent_ice_candidates JSONB DEFAULT '[]'::jsonb,
  child_ice_candidates JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ended_by TEXT CHECK (ended_by IN ('parent', 'child')),
  end_reason TEXT
);
```

### Key Fields

- `offer`: SDP offer from caller (`{ type: "offer", sdp: "..." }`)
- `answer`: SDP answer from callee (`{ type: "answer", sdp: "..." }`)
- `parent_ice_candidates`: Array of parent's ICE candidates
- `child_ice_candidates`: Array of child's ICE candidates
- `status`: Current call state (`ringing`, `active`, `ended`)
- `ended_at`: Timestamp when call ended (NULL for active calls)
- `ended_by`: Who ended the call (`parent` or `child`)

## WebRTC Connection States

### ICE Connection State

- `new`: Initial state
- `checking`: Gathering/checking candidates
- `connected`: Connection established
- `completed`: All candidates checked, connection stable
- `failed`: Connection failed
- `disconnected`: Temporary disconnection
- `closed`: Connection closed

### Connection State

- `new`: Initial state
- `connecting`: Establishing connection
- `connected`: Connection established
- `disconnected`: Temporary disconnection
- `failed`: Connection failed
- `closed`: Connection closed

## Key Implementation Files

### Core Hooks

- `src/hooks/useCallEngine.ts`: State machine for call management
- `src/hooks/useVideoCall.ts`: Legacy video call hook (used by VideoCall.tsx)
- `src/hooks/useWebRTC.ts`: Core WebRTC peer connection management

### Handlers

- `src/utils/callHandlers.ts`: Parent-side call handling
- `src/utils/childCallHandler.ts`: Child-side call handling
- `src/utils/callEnding.ts`: Idempotent call termination

### UI Components

- `src/components/call/VideoCallUI.tsx`: Video rendering and playback management
- `ParentCallScreen.tsx`: Parent call page (uses `useCallEngine`)
- `ChildCallScreen.tsx`: Child call page (uses `useCallEngine`)

### Notifications

- `src/hooks/useIncomingCallNotifications.ts`: Incoming call UI triggers
- `src/hooks/useAudioNotifications.ts`: Audio notification handling

## Troubleshooting

### Call Not Connecting

1. **Check Role Detection**

   - Verify `isChild` is correctly determined
   - Check console logs for `[ROLE DETECTION]` messages
   - Ensure route path matches expected role

2. **Check ICE Candidate Routing**

   - Verify parent writes to `parent_ice_candidates`
   - Verify child writes to `child_ice_candidates`
   - Check console logs for `[ICE CANDIDATE]` messages
   - Ensure each side reads from the OTHER side's field

3. **Check SDP Offer/Answer**

   - Verify offer contains `m=audio` and `m=video` lines
   - Verify answer contains `m=audio` and `m=video` lines
   - Check `setRemoteDescription` / `setLocalDescription` order

4. **Check Media Tracks**
   - Verify `getUserMedia()` succeeds
   - Verify tracks are added to RTCPeerConnection before creating offer/answer
   - Check `stream.getTracks()` returns audio + video tracks

### Video Not Rendering

1. **Check Video Element State**

   - Verify `remoteVideoRef.current.readyState === 4`
   - Check `loadedmetadata` and `playing` events fire
   - Verify `srcObject` is set correctly

2. **Check Browser Autoplay**
   - Some browsers require user interaction before playing video
   - Ensure video element has `playsInline` and `autoPlay` attributes
   - Check browser console for autoplay policy warnings

### Audio Not Audible

1. **Check Audio Tracks**

   - Verify audio tracks exist in remote stream
   - Check `stream.getAudioTracks().length > 0`
   - Verify tracks are not muted

2. **Check Browser Audio Policy**
   - Ensure user interaction occurred (call accept counts)
   - Check browser console for audio policy warnings
   - Verify audio element volume is not 0

## References

- Commit `b6c35a4`: "Fix: Critical WebRTC role detection and connection state tracking"
- WebRTC Specification: https://www.w3.org/TR/webrtc/
- Supabase Realtime: https://supabase.com/docs/guides/realtime

# WebRTC Call Engine Documentation

> ⚠️ **PROTECTED DIRECTORY**: This directory is protected from unauthorized changes.  
> **Before making any changes, read [PROTECTED.md](./PROTECTED.md) and get explicit user confirmation.**

## Overview

This directory contains the complete WebRTC call engine implementation for KidsCallHome, enabling real-time video and audio communication between parents and children. The system uses WebRTC for peer-to-peer media streaming and Supabase for signaling (SDP offer/answer exchange and ICE candidate routing).

**Status**: ✅ **RESTORED AND WORKING** - Restored from commit `b6c35a4` ("Fix: Critical WebRTC role detection and connection state tracking")

## Directory Structure

```
src/features/calls/
├── hooks/                    # React hooks for call management
│   ├── useVideoCall.ts      # Main orchestration hook
│   ├── useWebRTC.ts         # WebRTC peer connection management
│   ├── useCallEngine.ts     # Call state machine (alternative implementation)
│   ├── useIncomingCallNotifications.ts  # Incoming call notifications
│   └── useAudioNotifications.ts         # Audio notifications (ringtone, etc.)
├── utils/                    # Call handling logic
│   ├── callHandlers.ts      # Parent-side call handling
│   ├── childCallHandler.ts  # Child-side call handling
│   └── callEnding.ts        # Call termination utilities
├── components/               # UI components
│   ├── VideoCallUI.tsx      # Main video call UI layout
│   └── CallControls.tsx     # Call control buttons
├── types/                    # TypeScript types
│   └── call.ts              # Call-related type definitions
├── README.md                # This file (technical documentation)
└── PROTECTED.md             # Protection rules and verification process
```

## Architecture Overview

### Core Components

1. **useVideoCall** (`hooks/useVideoCall.ts`)

   - Main orchestration hook that coordinates call initialization and lifecycle
   - Handles role detection (parent vs child)
   - Manages call state and UI interactions
   - Coordinates between WebRTC connection and call handlers

2. **useWebRTC** (`hooks/useWebRTC.ts`)

   - Manages RTCPeerConnection lifecycle
   - Handles getUserMedia (camera/microphone access)
   - Processes ICE candidates and remote streams
   - Manages video element playback

3. **callHandlers** (`utils/callHandlers.ts`)

   - Parent-side call handling logic
   - Initiates parent-to-child calls
   - Answers child-initiated calls
   - Manages SDP offer/answer exchange for parents

4. **childCallHandler** (`utils/childCallHandler.ts`)

   - Child-side call handling logic
   - Initiates child-to-parent calls
   - Answers parent-initiated calls
   - Manages SDP offer/answer exchange for children

5. **callEnding** (`utils/callEnding.ts`)
   - Idempotent call termination utility
   - Ensures both sides clean up properly
   - Handles call state transitions

### Call Flow

#### Parent → Child Call Flow

1. **Parent Initiates Call**

   - Parent clicks "Call" button in ParentDashboard
   - Navigates to `/call/{childId}`
   - `useVideoCall` hook initializes
   - `handleParentCallFlow` is called
   - `handleParentCall` creates call record in Supabase with `status: "ringing"` and `caller_type: "parent"`
   - Parent creates WebRTC offer with media tracks
   - Offer is saved to `calls.offer` column
   - Parent starts listening for child's answer

2. **Child Receives Notification**

   - ChildDashboard subscribes to Supabase Realtime for INSERT events on `calls` table
   - When parent creates call, INSERT event fires
   - ChildDashboard shows incoming call notification
   - Audio ringtone plays (if tab is active)
   - Push notification shown (if tab is not active)

3. **Child Answers Call**

   - Child clicks "Answer" button
   - Navigates to `/call/{childId}?callId={callId}`
   - `useVideoCall` hook initializes
   - `handleChildCallFlow` is called
   - `handleChildCall` detects incoming call via `callId` URL parameter
   - Child fetches call record and finds parent's offer
   - Child sets remote description with parent's offer
   - Child creates answer with media tracks
   - Answer is saved to `calls.answer` column
   - Call status updated to `"active"`

4. **Connection Establishment**

   - Both sides exchange ICE candidates via Supabase
   - Parent writes candidates to `parent_ice_candidates` column
   - Child reads from `parent_ice_candidates` column
   - Child writes candidates to `child_ice_candidates` column
   - Parent reads from `child_ice_candidates` column
   - ICE connection state transitions: `new` → `checking` → `connected`
   - Media streams start flowing
   - Video elements begin playing

5. **Call Active**

   - Both sides see remote video and hear remote audio
   - Either side can toggle mute/video
   - Either side can hang up

6. **Call Termination**
   - When one side hangs up, `endCall` is called
   - Call status updated to `"ended"` in database
   - Both sides detect termination via Supabase Realtime UPDATE event
   - Resources cleaned up (media tracks stopped, peer connection closed)
   - Users redirected to their respective dashboards

#### Child → Parent Call Flow

The flow is symmetric but reversed:

1. Child initiates call (creates call record with `caller_type: "child"`)
2. Parent receives notification
3. Parent answers call
4. Connection establishment (same ICE candidate exchange)
5. Call active
6. Call termination

### Critical Design Decisions

#### Role Detection

Role detection is CRITICAL for correct ICE candidate routing. The system uses multiple signals:

1. **Route-based detection** (most reliable):

   - `/child/*` routes → child user
   - `/parent/*` routes → parent user
   - `/call/{childId}` → check `childSession` if present

2. **Session-based detection** (fallback):

   - Parent: Has Supabase auth session (`supabase.auth.getSession()` returns session)
   - Child: Has `childSession` in localStorage but NO auth session

3. **Call page priority**:
   - When on `/call/{childId}` route, prioritize `childSession` if present
   - This handles cases where child answers a call but might have stale auth cookies

**Why this matters**: ICE candidates MUST be written to the correct database column:

- Parent writes to `parent_ice_candidates`
- Child writes to `child_ice_candidates`
- Each side reads from the OTHER side's column
- If role detection is wrong, ICE candidates won't be exchanged correctly and connection will fail

#### ICE Candidate Routing

The system uses role-specific database columns to prevent overwriting:

```typescript
// Parent side
const candidateField = "parent_ice_candidates";
await supabase
  .from("calls")
  .update({ [candidateField]: candidates })
  .eq("id", callId);

// Child side
const candidateField = "child_ice_candidates";
await supabase
  .from("calls")
  .update({ [candidateField]: candidates })
  .eq("id", callId);
```

Each side reads from the opposite column:

- Parent reads from `child_ice_candidates`
- Child reads from `parent_ice_candidates`

#### SDP Offer/Answer Flow

The order of operations is critical:

1. **Initiator (Offerer)**:

   - Get media tracks (`getUserMedia`)
   - Add tracks to peer connection (`pc.addTrack`)
   - Create offer (`pc.createOffer`)
   - Set local description (`pc.setLocalDescription`)
   - Save offer to database

2. **Answerer**:

   - Get media tracks (`getUserMedia`)
   - Add tracks to peer connection (`pc.addTrack`)
   - Set remote description with offer (`pc.setRemoteDescription`)
   - Wait for signaling state to change to `have-remote-offer`
   - Create answer (`pc.createAnswer`)
   - Set local description (`pc.setLocalDescription`)
   - Save answer to database

3. **Offerer (after answer received)**:
   - Receive answer via Supabase Realtime UPDATE event
   - Set remote description with answer (`pc.setRemoteDescription`)
   - ICE candidates can now be processed

#### Media Track Verification

Before creating offers/answers, the code verifies that media tracks are present:

```typescript
const senderTracks = pc
  .getSenders()
  .map((s) => s.track)
  .filter(Boolean);
if (senderTracks.length === 0) {
  throw new Error("Cannot create offer: no media tracks found");
}
```

This prevents silent failures where calls connect but have no video/audio.

#### Video Playback

Video playback is handled carefully due to browser autoplay restrictions:

1. Local video plays immediately (no restrictions)
2. Remote video requires user interaction (user clicked "Answer")
3. Multiple attempts are made to play video:
   - When remote stream is received
   - When ICE connects
   - When tracks unmute
   - On video element events (`canplay`, `loadeddata`, etc.)

The system waits for `video.readyState >= 2` (have_current_data) before marking video as playing, but also checks for unmuted tracks which can indicate media is flowing even with low readyState.

## Database Schema

### `calls` Table

```sql
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parents(id),
  child_id UUID NOT NULL REFERENCES children(id),
  caller_type TEXT NOT NULL CHECK (caller_type IN ('parent', 'child')),
  status TEXT NOT NULL DEFAULT 'ringing',
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

**Key Fields**:

- `caller_type`: Determines who initiated the call
- `status`: `"ringing"` → `"active"` → `"ended"`
- `offer`: SDP offer (created by initiator)
- `answer`: SDP answer (created by answerer)
- `parent_ice_candidates`: Array of ICE candidates from parent
- `child_ice_candidates`: Array of ICE candidates from child

## File Descriptions

### Hooks

#### `useVideoCall.ts`

Main orchestration hook. Coordinates:

- Role detection
- Call initialization
- WebRTC connection setup
- Call handlers (parent vs child)
- Call termination
- UI state (mute, video off, etc.)

**Key Functions**:

- `initializeCall(isChildUser)`: Sets up call based on role
- `handleParentCallFlow(pc)`: Parent-specific call flow
- `handleChildCallFlow(pc)`: Child-specific call flow
- `setupCallTerminationListener(callId)`: Listens for remote termination
- `endCall()`: Ends call and cleans up

#### `useWebRTC.ts`

WebRTC peer connection management. Handles:

- `getUserMedia` (camera/microphone access)
- RTCPeerConnection creation and configuration
- ICE candidate generation and processing
- Remote stream handling (`ontrack` event)
- Video element playback
- Connection state monitoring

**Key Functions**:

- `initializeConnection()`: Gets media and creates peer connection
- `cleanup(force)`: Stops tracks and closes connection
- `playRemoteVideo()`: Attempts to play remote video element

**Key State**:

- `localStream`: User's camera/microphone stream
- `remoteStream`: Remote peer's stream
- `isConnecting`: True while establishing connection
- `isConnected`: True when ICE is connected/completed

#### `useCallEngine.ts`

Alternative call state machine implementation. Provides:

- Explicit state machine (`idle`, `calling`, `incoming`, `connecting`, `in_call`, `ended`)
- `startOutgoingCall(remoteId)`: Start a new call
- `acceptIncomingCall(callId)`: Accept incoming call
- `rejectIncomingCall(callId)`: Reject incoming call
- `endCall()`: End current call

**Note**: This is an alternative to `useVideoCall`. Currently, `useVideoCall` is the primary implementation used in `VideoCall.tsx`.

#### `useIncomingCallNotifications.ts`

Handles incoming call notifications:

- Shows push notification when tab is not active
- Plays ringtone when tab is active
- Handles notification clicks
- Manages notification lifecycle

**Key Functions**:

- `handleIncomingCall(callData)`: Process incoming call notification
- `stopIncomingCall(callId)`: Stop notifications for a call

#### `useAudioNotifications.ts`

Audio notification management:

- Ringtone playback (looping pattern)
- Vibration (mobile devices)
- Call answered sound
- Call ended sound
- Handles browser autoplay restrictions

**Key Functions**:

- `playRingtone()`: Start ringtone
- `stopRingtone()`: Stop ringtone
- `playCallAnswered()`: Play answered sound
- `playCallEnded()`: Play ended sound

### Utils

#### `callHandlers.ts`

Parent-side call handling. Exports:

- `handleParentCall(pc, childId, userId, setCallId, setIsConnecting, iceCandidatesQueue, specificCallId?)`

**Flow**:

1. Check for existing parent-initiated call
2. If found, continue existing call
3. If not, check for incoming child-initiated call
4. If incoming call found, answer it
5. If no incoming call, create new parent-initiated call

**Key Logic**:

- Creates offer when initiating call
- Creates answer when answering child-initiated call
- Processes ICE candidates from `child_ice_candidates` column
- Writes ICE candidates to `parent_ice_candidates` column

#### `childCallHandler.ts`

Child-side call handling. Exports:

- `handleChildCall(pc, child, childData, setCallId, setIsConnecting, iceCandidatesQueue, specificCallId?)`

**Flow**:

1. Check for incoming parent-initiated call (priority)
2. If found, answer it
3. If not, check for existing child-initiated call
4. If found, continue existing call
5. If not, create new child-initiated call

**Key Logic**:

- Creates offer when initiating call
- Creates answer when answering parent-initiated call
- Processes ICE candidates from `parent_ice_candidates` column
- Writes ICE candidates to `child_ice_candidates` column

#### `callEnding.ts`

Call termination utilities. Exports:

- `endCall({ callId, by, reason })`: Idempotent call termination
- `isCallTerminal(call)`: Check if call is in terminal state

**Key Features**:

- Idempotent: Safe to call multiple times
- Updates database with `status: "ended"`, `ended_at`, `ended_by`, `end_reason`
- Handles schema migration gracefully (falls back to simple status update if columns don't exist)

### Components

#### `VideoCallUI.tsx`

Main video call UI component. Displays:

- Remote video (full screen)
- Local video (picture-in-picture)
- Call controls (mute, video toggle, hang up)
- Connection status messages

**Props**:

- `localVideoRef`: Ref to local video element
- `remoteVideoRef`: Ref to remote video element
- `remoteStream`: Remote media stream
- `isConnecting`: Connection state
- `isMuted`: Mute state
- `isVideoOff`: Video off state
- `onToggleMute`: Mute toggle handler
- `onToggleVideo`: Video toggle handler
- `onEndCall`: End call handler

**Key Features**:

- Handles video playback state (`waiting`, `loading`, `playing`, `error`)
- Listens to video element events for state changes
- Monitors track unmute events (indicates ICE connection)
- Provides click-to-play fallback for autoplay restrictions

#### `CallControls.tsx`

Call control buttons component. Displays:

- Mute/unmute button
- Video on/off button
- Hang up button

### Types

#### `call.ts`

TypeScript type definitions:

- `ChildSession`: Child session data structure
- `CallRecord`: Call record from database

## Usage Examples

### Using `useVideoCall` Hook

```typescript
import { useVideoCall } from "@/features/calls/hooks/useVideoCall";
import { VideoCallUI } from "@/features/calls/components/VideoCallUI";

const VideoCall = () => {
  const {
    localVideoRef,
    remoteVideoRef,
    remoteStream,
    isConnecting,
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
    endCall,
  } = useVideoCall();

  return (
    <VideoCallUI
      localVideoRef={localVideoRef}
      remoteVideoRef={remoteVideoRef}
      remoteStream={remoteStream}
      isConnecting={isConnecting}
      isMuted={isMuted}
      isVideoOff={isVideoOff}
      onToggleMute={toggleMute}
      onToggleVideo={toggleVideo}
      onEndCall={endCall}
    />
  );
};
```

### Using `useCallEngine` Hook

```typescript
import { useCallEngine } from "@/features/calls/hooks/useCallEngine";

const CallScreen = () => {
  const callEngine = useCallEngine({
    role: "parent",
    localProfileId: parentId,
    remoteProfileId: childId,
    localVideoRef,
    remoteVideoRef,
  });

  // Start call
  callEngine.startOutgoingCall(childId);

  // Accept incoming call
  callEngine.acceptIncomingCall(callId);

  // End call
  callEngine.endCall();
};
```

### Handling Incoming Call Notifications

```typescript
import { useIncomingCallNotifications } from "@/features/calls/hooks/useIncomingCallNotifications";

const Dashboard = () => {
  const { handleIncomingCall, stopIncomingCall } =
    useIncomingCallNotifications();

  useEffect(() => {
    // Listen for incoming calls
    const channel = supabase
      .channel("incoming-calls")
      .on(
        "postgres_changes",
        { event: "INSERT", table: "calls" },
        (payload) => {
          const call = payload.new;
          handleIncomingCall({
            callId: call.id,
            callerName: "Parent",
            url: `/call/${call.child_id}?callId=${call.id}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleIncomingCall]);
};
```

## Technical Details for Cursor AI

### Key Implementation Patterns

1. **Role-Based Logic**: All call handling logic is split by role (parent vs child) to ensure correct ICE candidate routing and database column usage.

2. **Synchronous Role Detection**: Role is determined synchronously before WebRTC initialization to ensure ICE candidates go to the correct database columns.

3. **Idempotent Operations**: Call ending and state updates are idempotent to handle race conditions and multiple simultaneous updates.

4. **Event-Driven Architecture**: Uses Supabase Realtime for instant updates on call state changes, SDP exchange, and ICE candidate updates.

5. **Graceful Degradation**: Handles missing database columns, schema migrations, and browser autoplay restrictions gracefully.

### Critical Code Paths

1. **Call Initialization** (`useVideoCall.ts` → `initializeCall`):

   - Determines user role
   - Initializes WebRTC connection
   - Routes to appropriate handler (parent vs child)

2. **ICE Candidate Exchange** (`useWebRTC.ts` → `onicecandidate`):

   - Generates ICE candidates
   - Writes to role-specific database column
   - Processes remote candidates from opposite column

3. **SDP Exchange** (`callHandlers.ts` / `childCallHandler.ts`):

   - Creates offer/answer with media tracks
   - Verifies tracks are present before creating SDP
   - Sets local/remote descriptions in correct order

4. **Video Playback** (`useWebRTC.ts` → `ontrack` + `playRemoteVideo`):
   - Receives remote tracks
   - Sets stream to video element
   - Attempts playback with multiple fallbacks

### Error Handling

- Media access errors: Falls back to audio-only if camera fails
- ICE connection failures: Auto-ends call after timeout
- Database errors: Logs errors but continues with graceful degradation
- Browser restrictions: Handles autoplay restrictions with user interaction fallbacks

### Performance Considerations

- ICE candidate batching: Candidates are appended to arrays, not sent individually
- Realtime subscriptions: Single subscription per call, cleaned up on call end
- Video element updates: Only updates `srcObject` when stream changes
- Track monitoring: Uses event listeners instead of polling where possible

## Troubleshooting

### Common Issues

1. **No video/audio after connection**

   - Check that media tracks are added before creating offer/answer
   - Verify SDP includes `m=audio` and `m=video` lines
   - Check browser console for track state (muted/unmuted)
   - Verify ICE connection state is `connected` or `completed`

2. **ICE candidates not exchanging**

   - Verify role detection is correct (check console logs)
   - Check that candidates are written to correct database column
   - Verify Supabase Realtime subscription is active
   - Check network connectivity and firewall settings

3. **Call connects but immediately ends**

   - Check for premature cleanup (shouldn't cleanup during `new`/`checking` ICE states)
   - Verify call termination listener isn't firing incorrectly
   - Check database for call status changes

4. **Incoming call notifications not working**
   - Verify Supabase Realtime subscription status
   - Check browser notification permissions
   - Verify call INSERT events are being received
   - Check polling fallback (if Realtime fails)

### Debug Logging

The code includes extensive logging with emoji prefixes for easy filtering:

- 🔍 Role detection
- 🚀 Call initialization
- 📞 Call lifecycle
- 🧊 ICE candidates
- 🎬 Video playback
- ✅ Success operations
- ❌ Errors
- ⚠️ Warnings

Enable debug logging by filtering console for these emojis.

## Testing

See `CALLS_TEST_PLAN.md` in the project root for detailed manual testing procedures.

## Future Improvements

- [ ] Add unit tests for call handlers
- [ ] Add integration tests for WebRTC flows
- [ ] Implement call recording
- [ ] Add screen sharing support
- [ ] Improve error recovery (automatic reconnection)
- [ ] Add call quality metrics
- [ ] Implement adaptive bitrate based on network conditions

# Call-Related Pages and Components

## Pages (src/pages/)

### Parent Call Flow:

1. **ParentHome.tsx** (`/parent`)

   - Parent dashboard/home page
   - Quick actions to navigate to children list

2. **ParentChildrenList.tsx** (`/parent/children`)

   - Lists all children
   - "Call" button for each child
   - Navigates to `/parent/call/:childId`

3. **ParentCallScreen.tsx** (`/parent/call/:childId`)
   - Main call screen for parent calling child
   - Uses `useCallEngine` hook with role="parent"
   - Shows call UI based on state (idle, calling, incoming, in_call, ended)

### Child Call Flow:

4. **ChildHome.tsx** (`/child`)

   - Child dashboard/home page
   - Quick actions to navigate to parents list

5. **ChildParentsList.tsx** (`/child/parents`)

   - Lists parent(s)
   - "Call" button to call parent
   - Navigates to `/child/call/:parentId`

6. **ChildCallScreen.tsx** (`/child/call/:parentId`)
   - Main call screen for child calling parent
   - Uses `useCallEngine` hook with role="child"
   - Shows call UI based on state (idle, calling, incoming, in_call, ended)

### Legacy/Alternative:

7. **VideoCall.tsx** (`/call/:childId`)
   - Legacy video call page
   - Uses `useVideoCall` hook (older implementation)
   - Still functional but being replaced by new call screens

## Components (src/components/call/)

1. **VideoCallUI.tsx**

   - Main video call UI component
   - Handles video element rendering and playback
   - Shows local video (picture-in-picture) and remote video (full screen)
   - Manages video state (waiting, loading, playing, error)
   - Auto-fixes video playback issues
   - **Key Features:**
     - Monitors video state every 2 seconds
     - Auto-plays when tracks unmute (ICE connection established)
     - Handles autoplay policy issues
     - Shows status messages and debug info

2. **CallControls.tsx**
   - Call control buttons (mute, video toggle, end call)
   - Bottom overlay on video call screen

## Hooks (src/hooks/)

1. **useCallEngine.ts**

   - New call engine implementing state machine
   - States: idle → calling → in_call → ended (or incoming → in_call → ended)
   - Methods: startOutgoingCall, acceptIncomingCall, rejectIncomingCall, endCall
   - Integrates with useWebRTC for media handling
   - Supabase real-time subscriptions for call status

2. **useVideoCall.ts**

   - Legacy video call hook
   - Used by VideoCall.tsx page
   - Handles call initialization and lifecycle
   - Integrates with callHandlers and childCallHandler

3. **useWebRTC.ts**
   - WebRTC peer connection management
   - Handles getUserMedia, peer connection setup
   - ICE candidate handling
   - Remote stream management
   - Video playback logic
   - **Key Features:**
     - Creates RTCPeerConnection
   - Manages local and remote streams
   - Handles ICE connection state changes
   - Auto-plays video when ICE connects

## Utils (src/utils/)

1. **callHandlers.ts**

   - Parent call handling logic
   - Creates call records in Supabase
   - Handles offer/answer exchange
   - ICE candidate management

2. **childCallHandler.ts**

   - Child call handling logic
   - Handles incoming calls from parent
   - Creates outgoing calls to parent
   - Answer/reject logic

3. **callEnding.ts**
   - Call termination utilities
   - Updates call status to 'ended'
   - Cleanup logic

## Flow Summary

### Parent → Child Call:

1. Parent navigates: `/parent` → `/parent/children` → `/parent/call/:childId`
2. ParentCallScreen mounts, initializes useCallEngine(role="parent")
3. User clicks "Start Call" → startOutgoingCall()
4. Creates call record in Supabase with status='ringing', offer set
5. Child receives notification (ChildDashboard listens for incoming calls)
6. Child navigates to `/child/call/:parentId` or `/call/:childId?callId=...`
7. Child accepts → acceptIncomingCall()
8. Answer saved to Supabase, status='in_call'
9. ICE connection establishes → video/audio streams flow
10. VideoCallUI displays both streams

### Child → Parent Call:

1. Child navigates: `/child` → `/child/parents` → `/child/call/:parentId`
2. ChildCallScreen mounts, initializes useCallEngine(role="child")
3. User clicks "Start Call" → startOutgoingCall()
4. Creates call record in Supabase with status='ringing', offer set
5. Parent receives notification (ParentDashboard listens for incoming calls)
6. Parent accepts → acceptIncomingCall()
7. Answer saved to Supabase, status='in_call'
8. ICE connection establishes → video/audio streams flow
9. VideoCallUI displays both streams

## Current Issue: Video Stuck on Loading

The video is stuck on "loading" state because:

1. VideoCallUI waits for tracks to unmute (ICE connection)
2. When tracks unmute, it should auto-play but may not be triggering
3. The success check requires `readyState >= 2` OR tracks unmuted, but may not be updating state correctly

**Fix Applied:**

- Enhanced track unmute handler to immediately attempt play
- Updated success check to mark as playing when tracks unmute (even if readyState < 2)
- Added fallback to attempt play when tracks unmute but video is paused

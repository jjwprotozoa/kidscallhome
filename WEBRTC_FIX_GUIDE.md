# WebRTC Video Call Fix Guide

This guide documents the fixes needed to resolve black screen/no audio issues in the WebRTC video call implementation.

## Issues Identified

### 1. ICE Candidates Overwriting (CRITICAL)
**Problem**: Both parent and child are using the same `ice_candidates` field in the database, causing them to overwrite each other's candidates. This prevents proper peer-to-peer connection establishment.

**Location**: 
- `src/hooks/useWebRTC.ts` (lines 602-625)
- `src/utils/callHandlers.ts` (lines 206-248, 422-474)
- `src/utils/childCallHandler.ts` (lines 366-406, 567-600, 794-833)

**Solution**: Use separate `parent_ice_candidates` and `child_ice_candidates` fields.

### 2. Missing TURN Servers
**Problem**: The app only uses STUN servers, which won't work when users are behind restrictive NATs/firewalls (common in corporate/mobile networks).

**Location**: `src/hooks/useWebRTC.ts` (lines 171-177)

**Solution**: Add TURN servers for better NAT traversal. Use free TURN servers or set up your own.

### 3. Inverted Mute/Video Logic
**Problem**: The `toggleMute` and `toggleVideo` functions have inverted logic (setting `enabled = true` when muted).

**Location**: `src/hooks/useVideoCall.ts` (lines 363-380)

**Solution**: Fix the logic so that when muted/video off, `enabled = false`.

### 4. Incomplete ICE Candidate Exchange
**Problem**: The handlers need to process both `parent_ice_candidates` and `child_ice_candidates` fields.

**Location**: All call handlers need to read from the appropriate field based on role.

## Implementation Steps

### Step 1: Run Database Migration
```sql
-- Run fix_ice_candidates_schema.sql in Supabase SQL Editor
```

### Step 2: Update TypeScript Types
Update `src/integrations/supabase/types.ts` to include the new fields:
```typescript
parent_ice_candidates: Json | null
child_ice_candidates: Json | null
```

### Step 3: Update useWebRTC Hook
- Modify ICE candidate handler to use role-specific field
- Add TURN servers to ICE configuration
- Determine role (parent/child) and write to correct field

### Step 4: Update Call Handlers
- Update `callHandlers.ts` to read `child_ice_candidates` (parent reads child's candidates)
- Update `childCallHandler.ts` to read `parent_ice_candidates` (child reads parent's candidates)
- Both handlers should write to their respective fields

### Step 5: Fix Mute/Video Toggle Logic
- Fix `toggleMute` to set `enabled = !isMuted` (not `enabled = isMuted`)
- Fix `toggleVideo` to set `enabled = !isVideoOff` (not `enabled = isVideoOff`)

## Testing Checklist

After applying fixes, verify:

- [ ] Console shows "✅ ICE STATE: connected"
- [ ] Console shows "✅ REMOTE TRACK: Unmuted - media flowing"
- [ ] Video displays in both directions
- [ ] Audio works in both directions
- [ ] Mute button correctly mutes/unmutes audio
- [ ] Video toggle correctly turns video on/off
- [ ] Connection works behind NATs/firewalls (test on mobile networks)

## Expected Console Output

When working correctly, you should see:
```
✅ ICE STATE: ICE connection established - media should flow now!
✅ REMOTE TRACK: Track unmuted - MEDIA IS FLOWING!
✅ [VIDEO PLAY] Remote video playing successfully!
```

## TURN Server Options

### Free TURN Servers (for testing)
- `stun:stun.l.google.com:19302` (already in use)
- `turn:openrelay.metered.ca:80` (public, may have rate limits)
- `turn:openrelay.metered.ca:443` (TLS)

### Production TURN Servers
For production, consider:
1. **Twilio STUN/TURN** - Paid, reliable
2. **Metered TURN** - Paid, good performance
3. **Self-hosted Coturn** - Free but requires server setup

Example configuration:
```typescript
iceServers: [
  { urls: "stun:stun.l.google.com:19302" },
  { 
    urls: "turn:your-turn-server.com:3478",
    username: "your-username",
    credential: "your-credential"
  }
]
```

## Notes

- The old `ice_candidates` field is kept for backward compatibility but should not be used
- Both parties must use the new role-specific fields for proper candidate exchange
- TURN servers are essential for connections behind symmetric NATs (common on mobile networks)


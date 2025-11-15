# [KCH] Telemetry Logs Summary

Telemetry logs have been added to help debug WebRTC call issues. All logs use the `[KCH]` prefix for easy filtering.

## Log Locations

### 1. After getUserMedia
**Location**: `src/hooks/useWebRTC.ts` (line ~115)

**Log**: 
```javascript
console.log('[KCH]', role, 'media tracks', {
  audio: stream.getAudioTracks().length,
  video: stream.getVideoTracks().length,
});
```

**What it tells you**: Whether media permissions were granted and tracks are available.

---

### 2. When Creating Offer
**Locations**: 
- `src/utils/callHandlers.ts` (lines ~71, ~634)
- `src/utils/childCallHandler.ts` (lines ~235, ~291, ~329, ~948)

**Log**:
```javascript
console.log('[KCH]', role, 'created offer', !!offer?.sdp);
```

**What it tells you**: Whether offer creation succeeded and has SDP.

---

### 3. When Creating Answer
**Locations**:
- `src/utils/callHandlers.ts` (lines ~267, ~354)
- `src/utils/childCallHandler.ts` (line ~597)

**Log**:
```javascript
console.log('[KCH]', role, 'created answer', !!answer?.sdp);
```

**What it tells you**: Whether answer creation succeeded and has SDP.

---

### 4. When Saving to Supabase
**Locations**:
- `src/utils/callHandlers.ts` (lines ~76, ~387, ~661)
- `src/utils/childCallHandler.ts` (lines ~624, ~971)

**Logs**:
```javascript
console.log('[KCH]', role, 'saving offer for call', callId);
console.log('[KCH]', role, 'saving answer for call', callId);
```

**What it tells you**: Whether signaling data is being written to the database.

---

### 5. ICE Connection State
**Location**: `src/hooks/useWebRTC.ts` (line ~314)

**Log**:
```javascript
console.log('[KCH]', role, 'iceConnectionState', iceState);
```

**States**: `new`, `checking`, `connected`, `completed`, `failed`, `disconnected`, `closed`

**What it tells you**: Whether ICE candidates are being exchanged and connection is establishing.

---

### 6. Connection State
**Location**: `src/hooks/useWebRTC.ts` (line ~217)

**Log**:
```javascript
console.log('[KCH]', role, 'connectionState', state);
```

**States**: `new`, `connecting`, `connected`, `disconnected`, `failed`, `closed`

**What it tells you**: Overall peer connection health.

---

## How to Use

### Filter Console Logs

In browser DevTools console, filter for `[KCH]`:
```
[KCH]
```

### Expected Log Sequence (Working Call)

**Parent side:**
```
[KCH] parent media tracks { audio: 1, video: 1 }
[KCH] parent created offer true
[KCH] parent saving offer for call abc123
[KCH] parent iceConnectionState new
[KCH] parent iceConnectionState checking
[KCH] parent iceConnectionState connected
[KCH] parent connectionState connecting
[KCH] parent connectionState connected
```

**Child side:**
```
[KCH] child media tracks { audio: 1, video: 1 }
[KCH] child created answer true
[KCH] child saving answer for call abc123
[KCH] child iceConnectionState new
[KCH] child iceConnectionState checking
[KCH] child iceConnectionState connected
[KCH] child connectionState connecting
[KCH] child connectionState connected
```

### Debugging Failed Calls

**If you never see "created offer":**
- Engine never reaches offer creation branch
- Check if call handler is being called
- Check if peer connection has tracks

**If you see "created offer" but not "saving offer":**
- Bug in signaling write to Supabase
- Check Supabase RLS policies
- Check network tab for failed requests

**If offer + answer save, but `iceConnectionState` never leaves `checking`:**
- STUN/TURN server issue
- Network/firewall blocking ICE candidates
- ICE candidates not being exchanged via database

**If `connectionState` becomes `connected` but UI is black:**
- Binding of `remoteStream` to `<video>` element is broken
- Check if `remoteStream` is set on video element
- Check if video element has `autoplay` or user interaction

---

## Role Values

- `parent`: Parent user (has auth session)
- `child`: Child user (has childSession, no auth session)

---

## Notes

- All logs use `console.log()` - they won't break production
- Logs are prefixed with `[KCH]` for easy filtering
- Role is determined from `isChild` prop/flag
- Call IDs are included in Supabase write logs for tracing


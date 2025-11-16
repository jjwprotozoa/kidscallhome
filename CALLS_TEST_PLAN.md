# WebRTC Calls Test Plan

## Test Environment Setup

1. **Two Browser Windows/Devices**

   - Window 1: Parent session (authenticated Supabase user)
   - Window 2: Child session (localStorage `childSession`, no Supabase auth)

2. **Prerequisites**
   - Both windows/devices on same network (or use TURN server for NAT traversal)
   - Camera and microphone permissions granted
   - Supabase realtime subscriptions active
   - Database schema matches expected structure (see `docs/webrtc-calls-overview.md`)

## Manual Test Procedures

### Test A: Parent → Child Call (Accept)

**Steps:**

1. Parent logs in and opens ParentDashboard
2. Parent clicks "Call" button for a child
3. **Verify:** Parent sees "Calling..." state, local video preview appears
4. **Verify:** Child sees incoming call banner/dialog in ChildDashboard
5. Child clicks "Accept" button
6. **Verify:** Both sides navigate to call screen
7. **Verify:** Within 5-10 seconds:
   - ICE connection state reaches `connected` or `completed`
   - Connection state reaches `connected`
   - Remote video appears on both sides (`readyState === 4`)
   - Remote audio is audible on both sides
8. Child clicks "Hang Up" button
9. **Verify:** Call ends on both sides, status in database is `ended`
10. **Verify:** Both sides navigate back to dashboard

**Expected Results:**

- ✅ Call connects successfully
- ✅ 2-way audio + video works
- ✅ Hangup works from child side
- ✅ Database reflects `ended` status

**Console Checks:**

- `[ROLE DETECTION]` logs show correct roles
- `[ICE CANDIDATE]` logs show correct routing (parent → `parent_ice_candidates`, child → `child_ice_candidates`)
- No `getUserMedia` errors
- No `setLocalDescription` / `setRemoteDescription` errors
- No `addIceCandidate` errors

---

### Test B: Child → Parent Call (Accept)

**Steps:**

1. Child opens ChildDashboard
2. Child clicks "Call Parent" button
3. **Verify:** Child sees "Calling..." state, local video preview appears
4. **Verify:** Parent sees incoming call notification
5. Parent clicks "Accept" button
6. **Verify:** Both sides navigate to call screen
7. **Verify:** Within 5-10 seconds:
   - ICE connection state reaches `connected` or `completed`
   - Connection state reaches `connected`
   - Remote video appears on both sides
   - Remote audio is audible on both sides
8. Parent clicks "Hang Up" button
9. **Verify:** Call ends on both sides, status in database is `ended`
10. **Verify:** Both sides navigate back to dashboard

**Expected Results:**

- ✅ Call connects successfully (symmetric to Parent → Child)
- ✅ 2-way audio + video works
- ✅ Hangup works from parent side
- ✅ Database reflects `ended` status

**Console Checks:**

- `[ROLE DETECTION]` logs show correct roles
- `[ICE CANDIDATE]` logs show correct routing (child → `child_ice_candidates`, parent → `parent_ice_candidates`)
- No WebRTC errors

---

### Test C: Hangup from Parent (During Active Call)

**Steps:**

1. Establish an active call (Parent → Child or Child → Parent)
2. Wait for connection to stabilize (ICE `connected`, video rendering)
3. Parent clicks "Hang Up" button
4. **Verify:** Call ends immediately on parent side
5. **Verify:** Call ends within 2-3 seconds on child side (via realtime update)
6. **Verify:** Database shows `status: "ended"`, `ended_by: "parent"`
7. **Verify:** Both sides navigate back to dashboard
8. **Verify:** No zombie calls or stuck states

**Expected Results:**

- ✅ Hangup works from parent side
- ✅ Child receives hangup signal promptly
- ✅ Resources cleaned up (no memory leaks)
- ✅ No stuck "ringing" or "active" states

---

### Test D: Hangup from Child (During Active Call)

**Steps:**

1. Establish an active call (Parent → Child or Child → Parent)
2. Wait for connection to stabilize
3. Child clicks "Hang Up" button
4. **Verify:** Call ends immediately on child side
5. **Verify:** Call ends within 2-3 seconds on parent side (via realtime update)
6. **Verify:** Database shows `status: "ended"`, `ended_by: "child"`
7. **Verify:** Both sides navigate back to dashboard

**Expected Results:**

- ✅ Hangup works from child side (symmetric to parent)
- ✅ Parent receives hangup signal promptly
- ✅ Resources cleaned up

---

### Test E: Refresh Behavior

**Steps:**

1. Establish an active call (Parent → Child)
2. Wait for connection to stabilize
3. Refresh the child's browser window (F5 or Ctrl+R)
4. **Verify:** Child reconnects and sees call screen (if call still active)
   - OR: Child sees no call (if call was ended during refresh)
5. **Verify:** No zombie calls in database
6. **Verify:** No stuck "ringing" loops
7. Repeat test with parent refresh

**Expected Results:**

- ✅ Refresh doesn't create duplicate calls
- ✅ Refresh doesn't cause stuck "ringing" states
- ✅ If call was active, refresh doesn't break connection (or gracefully handles disconnection)

**Edge Cases to Check:**

- Refresh during "ringing" state (before accept)
- Refresh during "active" call
- Refresh after hangup (should not show call)

---

## Test Checklist

### Role Detection

- [ ] Parent role detected correctly (`role: "parent"`)
- [ ] Child role detected correctly (`role: "child"`)
- [ ] Role detection happens synchronously before WebRTC init
- [ ] Console logs show correct role verification

### ICE Candidate Routing

- [ ] Parent writes to `parent_ice_candidates`
- [ ] Child writes to `child_ice_candidates`
- [ ] Parent reads from `child_ice_candidates` (remote)
- [ ] Child reads from `parent_ice_candidates` (remote)
- [ ] Console logs verify correct routing

### WebRTC Connection

- [ ] Offer contains `m=audio` and `m=video` lines
- [ ] Answer contains `m=audio` and `m=video` lines
- [ ] `setRemoteDescription` called before `setLocalDescription` (answerer)
- [ ] ICE connection state reaches `connected` or `completed`
- [ ] Connection state reaches `connected`
- [ ] No `getUserMedia` errors
- [ ] No SDP errors
- [ ] No ICE candidate errors

### Media Rendering

- [ ] Local video preview appears
- [ ] Remote video appears (`readyState === 4`)
- [ ] Remote audio is audible
- [ ] Video element events fire (`loadedmetadata`, `playing`)

### Call State Management

- [ ] Database status transitions: `ringing` → `active` → `ended`
- [ ] `ended_at` timestamp set on hangup
- [ ] `ended_by` field set correctly (`parent` or `child`)
- [ ] No zombie calls in database
- [ ] No stuck states

### UI Behavior

- [ ] Incoming call dialogs show correctly
- [ ] Accept navigates to call screen quickly
- [ ] Hangup navigates back to dashboard
- [ ] Loading states show appropriately
- [ ] Error states handled gracefully

---

## Known Issues / Limitations

1. **Browser Autoplay Policies**

   - Some browsers require user interaction before playing audio/video
   - Solution: Ensure user clicks "Accept" before playing remote stream

2. **NAT Traversal**

   - Calls may fail if peers are behind restrictive NATs
   - Solution: Configure TURN server in WebRTC configuration

3. **Network Latency**
   - ICE candidate exchange may take 5-10 seconds
   - Solution: Pre-warm media on incoming call (already implemented)

---

## Test Results Template

```
Test Date: YYYY-MM-DD
Tester: [Name]
Browser: [Chrome/Firefox/Safari] [Version]
Network: [Same LAN / Different Networks]

Test A: Parent → Child Call
- Result: ✅ PASS / ❌ FAIL
- Notes: [Any issues observed]

Test B: Child → Parent Call
- Result: ✅ PASS / ❌ FAIL
- Notes: [Any issues observed]

Test C: Hangup from Parent
- Result: ✅ PASS / ❌ FAIL
- Notes: [Any issues observed]

Test D: Hangup from Child
- Result: ✅ PASS / ❌ FAIL
- Notes: [Any issues observed]

Test E: Refresh Behavior
- Result: ✅ PASS / ❌ FAIL
- Notes: [Any issues observed]

Overall Status: ✅ ALL PASS / ⚠️ SOME FAIL / ❌ ALL FAIL
```

---

## Debugging Commands

### Check Database State

```sql
-- Check recent calls
SELECT id, caller_type, status, ended_at, ended_by
FROM calls
ORDER BY created_at DESC
LIMIT 10;

-- Check ICE candidates
SELECT id,
       jsonb_array_length(parent_ice_candidates) as parent_candidates,
       jsonb_array_length(child_ice_candidates) as child_candidates
FROM calls
WHERE status IN ('ringing', 'active')
ORDER BY created_at DESC;
```

### Check Console Logs

- Filter for `[ROLE DETECTION]` to verify role
- Filter for `[ICE CANDIDATE]` to verify routing
- Filter for `[CALL ENGINE]` or `[CHILD CALL]` for call flow
- Check for WebRTC errors (getUserMedia, setLocalDescription, etc.)

---

## References

- `docs/webrtc-calls-overview.md`: Detailed architecture and flow documentation
- Commit `b6c35a4`: Source of truth for working implementation

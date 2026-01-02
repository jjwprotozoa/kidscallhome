# WhatsApp-Style Call Flow: Gap Analysis

## Overview

This document compares the current KidsCallHome call implementation against the ideal WhatsApp-style call flow specification.

---

## ✅ **IMPLEMENTED FEATURES**

### 1. State Machine

**Current:** `idle`, `calling`, `incoming`, `connecting`, `in_call`, `ended`
**Ideal:** `initiating`, `ringing`, `connecting`, `connected`, `ended`
**Status:** ✅ **Close match** - Minor naming differences but functionality exists

### 2. Signaling Infrastructure

**Current:** Supabase Realtime channels (`call:{callId}`)
**Ideal:** Same pattern
**Status:** ✅ **Implemented**

### 3. Ring Timeout

**Current:** 30 seconds timeout in `IncomingCallPage.tsx`
**Ideal:** 30 seconds ring timeout
**Status:** ✅ **Implemented**

### 4. WebRTC Integration

**Current:** Full WebRTC with offer/answer/ICE candidate exchange
**Ideal:** Same pattern
**Status:** ✅ **Implemented**

### 5. Presence System

**Current:** `usePresence` hook with Supabase Realtime presence channels
**Ideal:** `family:{familyId}:presence` with online/away/offline states
**Status:** ⚠️ **Partially implemented** - Presence exists but not fully integrated with call flow

### 6. Push Notifications

**Current:** Push notifications for incoming calls
**Ideal:** Push fallback when user not active
**Status:** ✅ **Implemented**

### 7. ICE Configuration

**Current:** STUN/TURN servers configured (Cloudflare TURN support)
**Ideal:** ICE config fetched and cached
**Status:** ✅ **Implemented**

---

## ❌ **MISSING FEATURES**

### 1. Database Schema Gaps

#### Missing: `call_session` table structure

**Current:** Uses `calls` table with different structure
**Ideal:**

```sql
call_session:
  - call_id (primary key)
  - family_id
  - from_user_id
  - to_user_id
  - call_type (audio|video)
  - state (initiating|ringing|connecting|connected|ended)
  - created_at
  - ended_at
  - ended_by_user_id
  - end_reason (hangup|declined|busy|no_answer|failed|network_lost)
```

#### Missing: `call_participants` table

**Ideal:**

```sql
call_participants:
  - call_id (foreign key)
  - user_id
  - role (caller|callee)
  - joined_at
  - left_at
```

**Action Required:**

- Review current `calls` table schema
- Add missing fields: `end_reason`, `ended_by_user_id`
- Consider adding `call_participants` table for multi-party support

### 2. Busy State Detection

**Current:** ❌ **Not implemented**
**Ideal:** Auto-detect if callee is already in a call and respond with `busy`

**Required Implementation:**

```typescript
// Before accepting incoming call, check for active calls
const checkForActiveCall = async (userId: string) => {
  const { data: activeCalls } = await supabase
    .from("calls")
    .select("*")
    .or(`parent_id.eq.${userId},child_id.eq.${userId},family_member_id.eq.${userId}`)
    .in("status", ["ringing", "connecting", "active"])
    .limit(1);
  
  return activeCalls && activeCalls.length > 0;
};
```

**Location:** `src/features/calls/hooks/modules/useIncomingCall.ts`

### 3. End Reason Tracking

**Current:** ❌ **Partially implemented** - No structured `end_reason` field
**Ideal:** Track all end reasons: `hangup`, `declined`, `busy`, `no_answer`, `failed`, `network_lost`

**Required Implementation:**

- Add `end_reason` field to `calls` table
- Update all call termination points to set appropriate reason
- Update `endCall` utility to accept and store reason

**Location:** `src/features/calls/utils/callEnding.ts`

### 4. Connect Timeout

**Current:** ⚠️ **Implicit** - 30 second disconnect timeout exists but no explicit connect timeout
**Ideal:** 15 second connect timeout after answer

**Required Implementation:**

```typescript
// After callee accepts, start 15s connect timeout
const connectTimeout = setTimeout(() => {
  if (pc.iceConnectionState !== "connected" && 
      pc.iceConnectionState !== "completed") {
    endCall({ callId, reason: "failed" });
  }
}, 15000);
```

**Location:** `src/features/calls/hooks/modules/useIncomingCall.ts` (accept path)

### 5. Idempotent Events

**Current:** ⚠️ **Partially implemented** - Some duplicate checks exist
**Ideal:** All signaling events should be idempotent (re-sending offer/answer shouldn't break)

**Required Implementation:**

- Add checks before setting remote description
- Verify signaling state before processing events
- Handle duplicate ICE candidates gracefully

**Status:** Mostly implemented but needs verification

### 6. Call Log / Missed Calls

**Current:** ❌ **Not implemented**
**Ideal:**

- Missed call notifications
- Call log with "Call back" button
- Call history view

**Required Implementation:**

- Query ended calls with `end_reason = 'no_answer'` or `'declined'`
- Display in call history UI
- Add "Call back" action

### 7. Device Switching Support

**Current:** ❌ **Not implemented**
**Ideal:** Ring all devices, first accept wins, others get "answered elsewhere"

**Required Implementation:**

- Track active devices per user
- Ring all devices simultaneously
- Cancel other devices when one accepts
- Show "answered elsewhere" on other devices

### 8. Anti-Double-Call Protection

**Current:** ⚠️ **Partially implemented** - Some checks exist but not enforced
**Ideal:** One active `call_session` per user

**Required Implementation:**

```typescript
// Before initiating call, check for existing active calls
const hasActiveCall = await checkForActiveCall(callerId);
if (hasActiveCall) {
  throw new Error("You are already in a call");
}
```

**Location:** Call initiation handlers

### 9. Presence Integration with Calls

**Current:** ⚠️ **Partially implemented** - Presence exists but not used for call routing
**Ideal:** Check presence before ringing, use for "fast path" (realtime beats push)

**Required Implementation:**

- Check presence before sending push notification
- If online in-app, use realtime only (faster)
- If offline, send push notification

**Location:** `src/features/calls/hooks/modules/useIncomingCallSubscription.ts`

### 10. Structured Signaling Events

**Current:** ⚠️ **Partially structured** - Events exist but naming may vary
**Ideal:** Standardized event names:

- `incoming_call`
- `call_ringing`
- `webrtc_offer`
- `webrtc_answer`
- `ice_candidate`
- `call_end`
- `call_failed`

**Action Required:** Audit current event names and standardize

---

## 🔧 **IMPLEMENTATION PRIORITY**

### High Priority (Core Functionality)

1. ✅ **Busy State Detection** - Prevents call conflicts
2. ✅ **End Reason Tracking** - Essential for call logs and analytics
3. ✅ **Connect Timeout** - Prevents hanging connections
4. ✅ **Anti-Double-Call Protection** - Prevents user confusion

### Medium Priority (User Experience)

1. ⚠️ **Call Log / Missed Calls** - Important for user retention
2. ⚠️ **Presence Integration** - Faster call delivery
3. ⚠️ **Structured Signaling Events** - Better debugging and reliability

### Low Priority (Advanced Features)

1. ⚠️ **Device Switching** - Nice-to-have for multi-device users
2. ⚠️ **Call Participants Table** - Needed for future group calls

---

## 📋 **NEXT STEPS**

1. **Audit Database Schema**
   - Review `calls` table structure
   - Add missing fields: `end_reason`, `ended_by_user_id`
   - Document current vs ideal schema

2. **Implement Busy State**
   - Add active call check before accepting
   - Auto-respond with busy if in call
   - Update UI to show "Busy" state

3. **Add End Reason Tracking**
   - Update `endCall` utility
   - Add reason to all termination points
   - Update database schema

4. **Add Connect Timeout**
   - Implement 15s timeout after accept
   - Handle timeout gracefully
   - Update UI feedback

5. **Enhance Call Log**
   - Query missed calls
   - Display in UI
   - Add "Call back" functionality

---

## 📝 **NOTES**

- Current implementation is **~70% aligned** with ideal flow
- Core WebRTC functionality is solid
- Main gaps are in state management and user experience features
- Database schema needs minor additions
- Most missing features are straightforward to implement





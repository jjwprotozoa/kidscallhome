# Video/Audio Call Fix - Enforced Guards

## Problem Statement

Video and audio calling keeps breaking despite multiple fixes. This document enforces the working pattern and adds guards to prevent regressions.

## Core Principle

**Child-to-parent and parent-to-child calls MUST work identically with reversed roles.**

## Critical Guards Added

### 1. Track Verification Before Offer/Answer (CRITICAL)

**Location**: Both `callHandlers.ts` and `childCallHandler.ts`

**Guard**: Fail immediately if no tracks are found when creating offer/answer.

```typescript
// CRITICAL GUARD: Fail if no tracks are found
if (senderTracks.length === 0) {
  throw new Error("Cannot create offer/answer: no media tracks found.");
}
```

**Why**: Silent failures (warnings only) allowed calls to proceed without video/audio. Now it fails fast with clear error.

### 2. ICE Candidate Field Separation (ENFORCED)

**Pattern**:
- **Parent writes to**: `parent_ice_candidates`
- **Child writes to**: `child_ice_candidates`
- **Parent reads from**: `child_ice_candidates` (reads child's candidates)
- **Child reads from**: `parent_ice_candidates` (reads parent's candidates)

**Location**: 
- `src/hooks/useWebRTC.ts` (line 812) - writes to correct field based on role
- `src/utils/callHandlers.ts` - reads `child_ice_candidates`
- `src/utils/childCallHandler.ts` - reads `parent_ice_candidates`

**Why**: Prevents ICE candidates from overwriting each other.

### 3. Identical Flow for Both Directions

**Child-to-Parent (Child Initiating)**:
1. Child creates call with `caller_type: "child"`
2. Child creates offer (with tracks verified)
3. Parent receives offer, creates answer (with tracks verified)
4. ICE candidates exchanged via separate fields

**Parent-to-Child (Parent Initiating)**:
1. Parent creates call with `caller_type: "parent"`
2. Parent creates offer (with tracks verified)
3. Child receives offer, creates answer (with tracks verified)
4. ICE candidates exchanged via separate fields

**Both directions now follow IDENTICAL pattern with reversed roles.**

## Verification Checklist

After any changes, verify:

- [ ] Child-to-parent calls work (child initiates)
- [ ] Parent-to-child calls work (parent initiates)
- [ ] Both directions have video
- [ ] Both directions have audio
- [ ] ICE candidates use separate fields
- [ ] Tracks are verified before offer/answer creation
- [ ] Errors are thrown (not just logged) when tracks are missing

## Files Modified

1. `src/utils/callHandlers.ts`
   - Added track verification guards (lines 327-342, 574-589)
   - Ensures parent-to-child calls fail fast if tracks missing

2. `src/utils/childCallHandler.ts`
   - Added track verification guards (lines 572-587, 903-918)
   - Ensures child-to-parent calls fail fast if tracks missing

## How to Keep It Working

1. **NEVER remove track verification** - It's now a hard requirement
2. **NEVER mix ICE candidate fields** - Always use role-specific fields
3. **NEVER change one direction without mirroring the other** - Both must be identical
4. **ALWAYS verify tracks before creating offer/answer** - This is now enforced

## Testing

Test both directions:
1. Child initiates call → Parent answers → Video/audio works
2. Parent initiates call → Child answers → Video/audio works

If either direction fails, check console for track verification errors.

## Common Issues

### "Cannot create offer/answer: no media tracks found"

**Cause**: `initializeConnection()` wasn't called or failed silently.

**Fix**: Ensure `initializeConnection()` is called and succeeds before creating offer/answer.

### "ICE connection stuck in 'checking'"

**Cause**: ICE candidates not being exchanged properly.

**Fix**: Verify both parties are using correct ICE candidate fields (`parent_ice_candidates` vs `child_ice_candidates`).

### "Video/audio works in one direction but not the other"

**Cause**: One direction is missing track verification or using wrong ICE candidate field.

**Fix**: Ensure both directions follow identical pattern with reversed roles.


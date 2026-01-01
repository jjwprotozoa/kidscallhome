# Call Breakage Analysis: What Changed and When It Broke

## Summary

Calls were working before but broke after recent changes. This document tracks what changed and identifies the breaking changes.

## Key Finding: mediaAccessLock Was Added Recently

The `mediaAccessLock.ts` file exists in the current codebase but was **NOT** in commit `f2430c4` (the deployment that's broken). This suggests:

1. **Either:** The lock was added to fix issues but introduced new problems
2. **Or:** The lock was added but not properly integrated everywhere
3. **Or:** Something else changed that broke the integration

## Timeline of Recent Call-Related Commits

### Recent Commits (Dec 20-29, 2024)

1. **b36a406b** (Dec 29) - "feat: optimize WebRTC for stability and smoothness over quality"
   - Changed codec preferences
   - Modified quality profiles
   - **Modified useWebRTC.ts** - Could have broken something

2. **0ebaa0a5** (Dec 28) - "Optimize call connection speed after accepting incoming calls"
   - Parallelized validation and connection
   - Reduced timeouts
   - **Modified useIncomingCall.ts** - Could have introduced race conditions

3. **065bda33** - "Add battery-aware call quality optimizations"
4. **e97eb3b9** - "feat: improve kid-friendly audio notifications and vibration patterns"
5. **e8538db7** - "Fix debug overlay and volume control, ensure camera cleanup on call end/decline"

## What Was Working Before (b36a406b)

At commit `b36a406b`, the `initializeConnection()` function:

- **Did NOT use mediaAccessLock** - Direct `getUserMedia()` calls
- **Did NOT have concurrency guard** - No protection against concurrent calls
- **Worked because:** Possibly fewer concurrent initialization attempts, or different timing

## Current State (After Our Fixes)

We added:

1. **mediaAccessLock** - To prevent "Device in use" errors
2. **Concurrency guard** - To prevent race conditions
3. **Vibrate handling** - To fix warnings

## Potential Issues

### 1. mediaAccessLock Integration Problem

If `mediaAccessLock` was added but:

- Not imported everywhere it's needed
- Not used consistently
- Has a bug in the lock logic

This could cause calls to fail.

### 2. Concurrency Guard Too Aggressive

If our concurrency guard:

- Blocks legitimate initialization attempts
- Doesn't properly share promises
- Has a race condition itself

This could prevent calls from starting.

### 3. Recent Changes Broke Something Else

The commits `b36a406b` and `0ebaa0a5` changed:

- WebRTC quality settings
- Connection timing
- Parallelization logic

These changes might have introduced bugs that weren't related to media acquisition.

## Investigation Steps

1. **Check if mediaAccessLock is used everywhere:**

   ```bash
   grep -r "getUserMedia" src/features/calls --exclude-dir=node_modules
   ```

   All `getUserMedia` calls should go through `mediaAccessLock.acquire()`

2. **Check if there are any direct getUserMedia calls:**
   - Should find: `mediaAccessLock.acquire()`
   - Should NOT find: `navigator.mediaDevices.getUserMedia()` (direct calls)

3. **Test the working commit:**

   ```bash
   git checkout b36a406b
   # Test calls
   ```

4. **Compare initializeConnection implementations:**
   - Working version (b36a406b) vs current version
   - Look for logic changes beyond just adding the lock

## Next Steps

1. Verify all `getUserMedia` calls go through the lock
2. Test with the lock temporarily disabled to see if that's the issue
3. Check if the concurrency guard is blocking legitimate calls
4. Review the recent commits for other breaking changes




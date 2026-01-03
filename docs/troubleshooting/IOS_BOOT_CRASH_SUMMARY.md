# iOS Safari Boot Crash Issue - Summary

## Symptom Pattern

**On iPhone Safari/Chrome (normal mode):**

1. ✅ Page renders correctly for ~1 second (initial React render succeeds)
2. ❌ Blank white screen for ~5–10 seconds (something crashes after initial render)
3. ❌ App shows fallback UI: "Loading issue… Reload Page / Go Home"

**Works correctly:**

- ✅ Incognito mode
- ✅ Android devices
- ✅ Desktop browsers

**User actions attempted (didn't help):**

- Cleared cache
- Restarted phone
- Hard refresh

## Root Cause Analysis

This is a **post-initial-render crash**, not a boot-time failure. The pattern indicates:

### What's Working

- ✅ Initial React render (`root.render(<App />)`)
- ✅ DOM mounting
- ✅ Initial component tree rendering

### What's Failing

- ❌ Something crashes **after** initial render completes
- ❌ Likely during:
  - Deferred component mounting (500ms delay on iOS)
  - Router context initialization
  - Storage reads (localStorage/IndexedDB) that happen after mount
  - Chunk loading for lazy-loaded components
  - Auth session refresh that triggers re-render

## Most Likely Causes (in order of probability)

### 1. **Corrupted Persisted State** (Most Likely)

- **Why incognito works**: No localStorage/IndexedDB state
- **Why it fails after initial render**: Components read storage in `useEffect` hooks
- **What happens**:
  - Initial render succeeds (no storage reads yet)
  - Component mounts → `useEffect` runs → reads corrupted storage → throws error
  - ErrorBoundary catches it → shows "Loading issue"

**Evidence:**

- Works in incognito (no persisted state)
- Fails in normal mode (has persisted state)
- Happens after initial render (when hooks run)

### 2. **Router Context Error** (Second Most Likely)

- **Why it happens**: Router context not ready when deferred components mount
- **What happens**:
  - Initial render succeeds (no Router hooks used yet)
  - DeferredGlobalComponents mounts after 500ms delay
  - Tries to use Router hooks → "Cannot destructure property 'basename'"
  - ErrorBoundary catches it → shows "Loading issue"

**Evidence:**

- ErrorBoundary already has Router context error detection
- DeferredGlobalComponents has iOS-specific delays
- Pattern matches: works briefly, then crashes

### 3. **Chunk Load Error** (Third Most Likely)

- **Why it happens**: Service worker or browser cache serves stale HTML for hashed JS chunks
- **What happens**:
  - Initial bundle loads fine
  - Lazy-loaded chunk requested → 404 or HTML returned instead of JS
  - Dynamic import fails → ErrorBoundary catches it

**Evidence:**

- BootGate has chunk error detection
- Service worker caching could cause this
- Pattern: initial load works, lazy chunks fail

### 4. **Auth Session Refresh Failure** (Less Likely)

- **Why it happens**: Expired/invalid refresh token triggers error during re-render
- **What happens**:
  - Initial render with default bootResult succeeds
  - Boot completes → updates app with real bootResult
  - Auth refresh fails → throws error → ErrorBoundary catches it

## Current Mitigations in Place

### ✅ BootGate System

- Boot logger tracks all phases
- Global error handlers catch chunk errors
- Boot watchdog (8 second timeout)
- Recovery functions (soft/reset)

### ✅ ErrorBoundary

- Catches React errors
- Shows "Loading issue" UI
- Retry/Reset & Reload buttons
- Debug mode (`?debug=1`) shows boot log

### ✅ Boot-Safe Initialization

- `initApp()` never throws
- Safe storage utilities
- Non-fatal auth handling

### ⚠️ Still Missing

- **Post-render error detection**: Errors happening after initial render aren't being logged to boot log
- **Storage read protection**: Components reading storage aren't wrapped in try-catch
- **Router context guard**: Deferred components don't check Router context before using hooks

## Diagnostic Steps

### 1. Check Boot Log

Add `?debug=1` to URL when error occurs:

- Open iPhone Safari
- Navigate to site
- When "Loading issue" appears, add `?debug=1` to URL
- Reload
- Check boot log in error screen

### 2. Check Browser Console

- Connect iPhone to Mac
- Open Safari → Develop → [Your iPhone] → [Your Site]
- Check console for errors after initial render

### 3. Check Storage

- Open Safari DevTools
- Application → Local Storage
- Look for corrupted entries (non-JSON values, invalid data)

## Next Steps to Fix

### Priority 1: Add Post-Render Error Logging

- Wrap deferred component mounting in try-catch
- Log errors to boot logger
- Ensure errors are captured even after initial render

### Priority 2: Protect Storage Reads

- Wrap all localStorage/IndexedDB reads in try-catch
- Clear corrupted keys automatically
- Fallback to safe defaults

### Priority 3: Guard Router Context Usage

- Check Router context availability before using hooks
- Delay deferred components until Router is ready
- Add retry logic for Router context errors

### Priority 4: Improve Chunk Error Recovery

- Detect chunk errors earlier
- Automatically trigger reset recovery
- Clear service worker cache on chunk errors

## Expected Behavior After Fix

- ✅ App loads normally
- ✅ If error occurs, it's logged to boot log
- ✅ Error is recoverable (no permanent white screen)
- ✅ iOS auto-recovery clears corrupted state
- ✅ Debug mode shows exact error in boot log

## Testing Checklist

- [ ] Fresh load works on iPhone Safari
- [ ] Corrupted storage doesn't crash app
- [ ] Router context errors are handled gracefully
- [ ] Chunk errors trigger recovery
- [ ] Debug mode shows boot log
- [ ] Reset & Reload clears corrupted state
- [ ] No infinite white screen

# Call Breakage Fixes Applied

## Issues Found

1. **Overly Aggressive Guard** - The concurrency guard was checking for flag OR promise, which could block legitimate calls
2. **Stream Reuse Bug** - When reusing existing stream, we weren't checking if peer connection had tracks before returning early

## Fixes Applied

### 1. Simplified Concurrency Guard
**Before:**
```typescript
if (isInitializingRef.current) {
  if (initializationPromiseRef.current) {
    return promise;
  } else {
    // Complex wait/retry logic
  }
}
```

**After:**
```typescript
if (isInitializingRef.current && initializationPromiseRef.current) {
  return initializationPromiseRef.current;
}
```

**Why:** Only wait if BOTH flag and promise exist. This prevents blocking when flag is set but promise creation failed.

### 2. Fixed Stream Reuse Logic
**Before:**
```typescript
if (peerConnectionRef.current) {
  return; // Might return even if peer connection has no tracks
}
```

**After:**
```typescript
if (peerConnectionRef.current) {
  const hasTracks = peerConnectionRef.current.getSenders().some(s => s.track !== null);
  if (hasTracks) {
    return; // Only return if peer connection is fully set up
  }
}
```

**Why:** Ensures we don't return early if peer connection exists but isn't properly initialized.

## Testing

Test the following scenarios:
1. Start outgoing call - should initialize without blocking
2. Accept incoming call - should reuse pre-warmed media if available
3. Multiple rapid calls - should handle gracefully without "Device in use" errors

## If Still Broken

If calls still don't work, we may need to:
1. Temporarily disable mediaAccessLock to test if that's the issue
2. Revert to direct `getUserMedia()` calls like the working version
3. Add the lock back incrementally with better testing



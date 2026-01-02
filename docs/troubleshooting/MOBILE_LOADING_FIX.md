# Mobile Loading Fix - Reverted Complex Router Context Logic

## Problem
- ✅ Domain and Vercel URL work on desktop
- ❌ Domain and Vercel URL fail to load on mobile devices
- Last working branch: `stable/v1.0.0-beta-stripe-fix`

## Root Cause
The current branch (`main`) had complex Router context checking logic in `DeferredGlobalComponents` that was trying to prevent "Cannot destructure property 'basename'" errors. This complex logic was causing issues on mobile devices where:
1. The Router context checking heuristics were unreliable
2. Progressive delays and retry logic were causing timing issues
3. Mobile device detection and delays were interfering with normal initialization

## Solution Applied
Reverted `DeferredGlobalComponents` in `src/App.tsx` to the simpler version from the working branch (`stable/v1.0.0-beta-stripe-fix`).

### Changes Made

**Before (Complex Logic):**
```typescript
const DeferredGlobalComponents = () => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // Complex Router context checking with:
    // - Mobile device detection
    // - Progressive delays (300ms mobile, 100ms desktop)
    // - Retry logic with up to 5 attempts
    // - Router context availability checks
    // - Document readyState checks
    // ... 40+ lines of complex logic
  }, []);
  // ...
};
```

**After (Simple Logic - Working Branch):**
```typescript
const DeferredGlobalComponents = () => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // Wait for initial paint then mount deferred components
    // Use requestIdleCallback for best performance, fallback to setTimeout
    const schedule = (callback: () => void) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, { timeout: 1000 });
      } else {
        setTimeout(callback, 100);
      }
    };
    
    schedule(() => setMounted(true));
  }, []);
  // ...
};
```

### Additional Changes
- Removed global error handler that was suppressing Router errors
  - This was hiding real issues instead of fixing them
  - Error boundaries already handle component-level errors

## Why This Works
1. **Simpler is better**: The working branch used simple timing logic that works reliably across all devices
2. **Error boundaries handle errors**: Components are wrapped in `ErrorBoundary`, so Router context errors are caught and handled gracefully
3. **No mobile-specific hacks**: The simple approach works on both desktop and mobile without special cases
4. **Proven approach**: This matches the code from the last working branch

## Components Still Protected
The following components still have their own Router context checking logic, but they're wrapped in ErrorBoundary components:
- `GlobalIncomingCall` - Has Router context checks + ErrorBoundary
- `GlobalMessageNotifications` - Has Router context checks + ErrorBoundary

These are safe because:
1. They're wrapped in `ErrorBoundary` in `DeferredGlobalComponents`
2. They have their own error boundaries internally
3. They're lazy-loaded, so they mount after the Router is initialized

## Testing
After deploying this fix:
1. ✅ Test on desktop (should still work)
2. ✅ Test on mobile device (should now work)
3. ✅ Test on tablet (should work)
4. ✅ Test on different mobile browsers (Chrome, Safari, Firefox)

## Related Files
- `src/App.tsx` - Main changes
- `src/components/GlobalIncomingCall/GlobalIncomingCall.tsx` - Still has Router checks (but wrapped in ErrorBoundary)
- `src/components/GlobalMessageNotifications.tsx` - Still has Router checks (but wrapped in ErrorBoundary)

## If Issues Persist
If mobile loading still fails after this fix:
1. Check browser console on mobile device (use remote debugging)
2. Look for specific error messages
3. Check if service worker is causing issues
4. Verify PWA manifest is loading correctly
5. Check if CSP (Content Security Policy) is blocking resources on mobile

## Commit Message
```
fix: Revert complex Router context logic to simple version from working branch

- Simplified DeferredGlobalComponents to match stable/v1.0.0-beta-stripe-fix
- Removed complex Router context checking that was causing mobile issues
- Removed global error handler that was suppressing Router errors
- Components are still protected by ErrorBoundary wrappers

Fixes mobile loading issues where domain worked on desktop but not mobile.
```


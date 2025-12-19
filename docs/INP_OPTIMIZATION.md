# Interaction to Next Paint (INP) Optimization

## Problem

Mobile INP score was **552ms P75 (Poor)** - above the 200ms threshold for good user experience. This indicates slow interactivity where user interactions take too long to show visual feedback.

## Root Causes Identified

1. **Heavy synchronous work in event handlers**

   - Audio context resumption (`resumeAudioContext()`) blocking main thread
   - Media pre-warming operations running synchronously
   - Console logging blocking event handlers

2. **Synchronous React state updates**

   - State updates causing blocking renders
   - No use of `useTransition` for non-urgent updates

3. **Long JavaScript tasks**
   - Event handlers doing too much work synchronously
   - No task splitting between immediate and deferred work

## Solutions Implemented

### 1. Created INP Optimization Utility (`src/utils/inpOptimization.ts`)

**Key Functions:**

- `deferTask()` - Uses `scheduler.postTask` (Chrome 94+) or `setTimeout` fallback to defer non-critical work
- `splitWork()` - Splits immediate work (visual feedback) from deferred work (heavy operations)
- `optimizeEventHandler()` - Wraps event handlers to optimize INP
- `deferredLog()` / `deferredError()` - Defers console logging to avoid blocking

**Benefits:**

- Uses modern Scheduler API when available
- Falls back gracefully for older browsers
- Allows immediate visual feedback while deferring heavy work

### 2. Optimized Mobile Click Handlers

**Before:**

```typescript
const executeHandler = async (e) => {
  e.preventDefault();
  await resumeAudioContext(); // Blocks main thread
  console.warn("..."); // Blocks main thread
  await handler();
};
```

**After:**

```typescript
const executeHandler = (e) => {
  // IMMEDIATE: Visual feedback
  e.preventDefault();
  handler(); // Execute immediately

  // DEFERRED: Heavy work
  setTimeout(async () => {
    await resumeAudioContext(); // Non-blocking
    deferredLog("..."); // Non-blocking
  }, 0);
};
```

### 3. Added React `useTransition` for Non-Urgent Updates

**Components Updated:**

- `IncomingCallUI.tsx` - Answer/decline handlers
- `ChildIncomingCallUI.tsx` - Answer/decline handlers
- `VideoCallUI.tsx` - Video click handler

**Before:**

```typescript
setIsTriggered(true); // Blocks render
setVideoState("playing"); // Blocks render
```

**After:**

```typescript
startTransition(() => {
  setIsTriggered(true); // Non-blocking
  setVideoState("playing"); // Non-blocking
});
```

### 4. Deferred Console Logging

**Before:**

```typescript
console.warn("📱 [Mobile] Button tapped..."); // Blocks
```

**After:**

```typescript
deferredLog("📱 [Mobile] Button tapped..."); // Non-blocking
```

### 5. Optimized Video Click Handler

**Key Changes:**

- Deferred logging to background priority
- Used `startTransition` for state updates
- Kept `video.play()` synchronous (required for user gesture)
- Deferred error handling and logging

## Expected Improvements

- **INP Score**: Should improve from 552ms to < 200ms (Good)
- **P75**: Less than 75% of visits should score "Good" (target: >75%)
- **User Experience**: Faster visual feedback on button taps/clicks

## Performance Strategy

### Immediate Work (Synchronous)

- `preventDefault()` / `stopPropagation()`
- Visual state updates (button disabled, loading state)
- Critical handler execution
- User gesture requirements (video.play())

### Deferred Work (Asynchronous)

- Audio context resumption
- Media pre-warming
- Console logging
- Non-critical state updates
- Error handling

## Browser Support

- **Modern browsers** (Chrome 94+, Edge 94+): Uses `scheduler.postTask` API
- **Older browsers**: Falls back to `setTimeout` with appropriate delays
- **All browsers**: Benefits from deferred work and `useTransition`

## Testing Recommendations

1. Test on real mobile devices (iOS Safari, Chrome Android)
2. Use Chrome DevTools Performance tab to measure INP
3. Monitor Web Vitals in production (Vercel Analytics)
4. Test with slow 3G throttling to see improvements

## Files Modified

- `src/utils/inpOptimization.ts` (new) - INP optimization utilities
- `src/utils/mobileCompatibility.ts` - Optimized `createMobileSafeClickHandler`
- `src/components/GlobalIncomingCall/IncomingCallUI.tsx` - Optimized answer/decline handlers
- `src/components/GlobalIncomingCall/ChildIncomingCallUI.tsx` - Optimized answer/decline handlers
- `src/features/calls/components/VideoCallUI.tsx` - Optimized video click handler

## Next Steps

1. Monitor INP scores in production
2. Identify other interactive components that need optimization
3. Consider adding more `useTransition` usage for heavy state updates
4. Profile with Chrome DevTools to identify remaining bottlenecks

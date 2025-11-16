# Incoming Call Notifications - WhatsApp Web-like Implementation

This document describes the WhatsApp Web-like incoming call notification system implemented for the Kids Call Home PWA.

## Overview

The system handles incoming calls with:
- **Push notifications** when the browser tab is not in focus
- **Ringtone and vibration** when the tab is active or after notification click
- **Proper browser autoplay compliance** - audio only plays after user gesture

## Architecture

### Core Components

1. **Service Worker** (`public/sw.js`)
   - Handles push notifications
   - Manages notification clicks
   - Communicates with the main app via messages

2. **PWA Manifest** (`public/manifest.json`)
   - Defines app metadata
   - Enables install as PWA
   - Requests notification and vibration permissions

3. **Hooks**
   - `useTabVisibility` - Detects if tab is visible/active
   - `usePushNotifications` - Manages push notification API
   - `useAudioNotifications` - Handles ringtone and vibration
   - `useIncomingCallNotifications` - Combined hook for incoming call handling

### Flow Diagram

```
Incoming Call Detected
    │
    ├─ Tab Visible & User Has Interacted?
    │   ├─ YES → Play Ringtone + Vibration Immediately
    │   └─ NO → Show Push Notification
    │       │
    │       └─ User Clicks Notification
    │           ├─ Focus/Open App
    │           └─ Play Ringtone + Vibration (User Gesture)
    │
    └─ Tab Becomes Visible (with active call)
        └─ Play Ringtone + Vibration
```

## Implementation Details

### Browser Autoplay Restrictions

**Problem**: Modern browsers block autoplay of audio without user interaction.

**Solution**: 
- Audio only plays when:
  1. Tab is visible AND user has interacted with the page
  2. User clicks a push notification (counts as user gesture)
  3. Tab becomes visible after user has previously interacted

### Tab Visibility Detection

Uses the Page Visibility API (`document.hidden`) and focus/blur events:
- `isVisible`: Current tab visibility state
- `hasBeenVisible`: Whether tab has ever been visible (indicates user interaction)

### Push Notifications

**When shown**: Tab is not visible or user hasn't interacted yet

**Notification includes**:
- Caller name
- Call ID
- URL to navigate to
- Vibration pattern
- Persistent until dismissed

**On click**:
- Focuses existing window or opens new one
- Sends message to app to start ringing
- Navigates to call page

### Ringtone & Vibration

**Ringtone**: 
- Web Audio API with oscillator
- Ring-ring pattern (800Hz tone, 250ms on, 250ms off, repeat every 2s)
- Loops until call is answered/declined

**Vibration**:
- Uses Navigator Vibration API
- Pattern: [200ms, 100ms, 200ms]
- Repeats every 2 seconds (matching ringtone)

## Usage

### In Dashboard Components

```typescript
import { useIncomingCallNotifications } from "@/hooks/useIncomingCallNotifications";

const { handleIncomingCall, stopIncomingCall } = useIncomingCallNotifications({
  enabled: true,
  volume: 0.7,
});

// When incoming call detected
handleIncomingCall({
  callId: call.id,
  callerName: "Mom/Dad",
  callerId: call.parent_id,
  url: `/call/${childId}?callId=${call.id}`,
});

// When call is answered/declined
stopIncomingCall(call.id);
```

## Browser Limitations & Best Practices

### Limitations

1. **Notification Permission Required**
   - User must grant notification permission
   - First-time users will see permission prompt
   - Some browsers require HTTPS for notifications

2. **Service Worker Registration**
   - Requires HTTPS (except localhost)
   - Must be served from root or subdirectory
   - Browser support varies

3. **Vibration API**
   - Only available on mobile devices
   - Desktop browsers don't support vibration
   - Gracefully degrades if not available

4. **Audio Context**
   - Starts in "suspended" state
   - Requires user interaction to resume
   - Some browsers are stricter than others

### Best Practices

1. **Request Permission Early**
   - Request notification permission on app load
   - Explain why permission is needed
   - Don't spam permission requests

2. **Handle Permission States**
   - Check permission before showing notifications
   - Provide fallback UI if permission denied
   - Guide users to enable notifications

3. **Test on Multiple Browsers**
   - Chrome/Edge: Full support
   - Firefox: Good support
   - Safari: Limited (iOS requires user interaction)
   - Mobile browsers: Varies

4. **Graceful Degradation**
   - Check feature availability before use
   - Provide fallbacks (e.g., visual indicators)
   - Log errors for debugging

## Testing

### Test Scenarios

1. **Tab Active, User Has Interacted**
   - Call should ring immediately
   - No notification shown

2. **Tab Inactive**
   - Push notification should appear
   - No ringtone until notification clicked

3. **Tab Becomes Active**
   - If call is active, ringtone should start
   - Notification should be closed

4. **Notification Click**
   - App should focus/open
   - Ringtone should start immediately
   - Should navigate to call page

5. **Call Answered/Declined**
   - Ringtone should stop
   - Notification should close
   - Vibration should stop

### Debugging

Check browser console for logs:
- `🔔 [CALL NOTIFICATIONS]` - Notification system
- `🔊 [AUDIO]` - Audio context and ringtone
- `📳 [AUDIO]` - Vibration
- `[SW]` - Service worker messages

## Files Created/Modified

### New Files
- `public/sw.js` - Service worker
- `public/manifest.json` - PWA manifest
- `src/hooks/useTabVisibility.ts` - Tab visibility detection
- `src/hooks/usePushNotifications.ts` - Push notification management
- `src/hooks/useIncomingCallNotifications.ts` - Combined incoming call handler

### Modified Files
- `src/hooks/useAudioNotifications.ts` - Added vibration support
- `src/pages/ChildDashboard.tsx` - Uses new notification system
- `src/pages/ParentDashboard.tsx` - Uses new notification system
- `index.html` - Added manifest link and PWA meta tags

## Next Steps

1. **Add PWA Icons**
   - Create `public/icon-192x192.png`
   - Create `public/icon-512x512.png`
   - Create `public/icon-96x96.png`

2. **Test on Real Devices**
   - Test on mobile devices
   - Test notification permissions
   - Test vibration patterns

3. **Optional Enhancements**
   - Custom ringtone files (replace oscillator)
   - Different sounds for different callers
   - Notification actions (Answer/Decline buttons)
   - Background sync for offline support

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Push Notifications | ✅ | ✅ | ⚠️ | ✅ |
| Vibration API | ✅ (Mobile) | ✅ (Mobile) | ❌ | ✅ (Mobile) |
| Web Audio API | ✅ | ✅ | ✅ | ✅ |
| Page Visibility API | ✅ | ✅ | ✅ | ✅ |

⚠️ = Limited support or requires additional setup


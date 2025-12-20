# iPhone Call Connection Verification Guide

## Overview
This document outlines the verification steps and diagnostics added to help troubleshoot iPhone call connection issues.

## Recent Changes

### 1. Connection Diagnostics Utility
Created `src/utils/callConnectionDiagnostics.ts` with comprehensive connection diagnostics:
- Platform and browser detection
- WebRTC support verification
- ICE server configuration checking
- Connection state monitoring
- Issue identification and recommendations

### 2. Enhanced Logging
Added enhanced logging for iPhone connections:
- iOS-specific connection state logging
- TURN server detection
- ICE candidate tracking
- Connection state transitions

### 3. Diagnostic Integration
Integrated diagnostics into:
- `useCallEngine` - Logs diagnostics on initialization failure
- `useIncomingCall` - Logs diagnostics after accepting calls
- `useWebRTC` - Enhanced iOS-specific logging for connection state changes

## Verification Steps

### 1. Check Browser Console
When testing on iPhone, open Safari's Web Inspector and check for:
- `🔍 [CONNECTION DIAGNOSTICS]` logs
- `📱 [iOS CONNECTION DIAGNOSTICS]` logs (on connection failures)
- ICE connection state changes
- TURN server configuration

### 2. Verify TURN Server Configuration
iPhone connections often require TURN servers due to NAT traversal. Check:

**Environment Variables:**
- `VITE_USE_CLOUDFLARE_TURN=true` (recommended)
- OR `VITE_TURN_SERVERS`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`

**In Console:**
Look for logs indicating TURN servers are configured:
- "Using Cloudflare TURN servers" or
- "Using production TURN servers from environment variables"

### 3. Check HTTPS Requirement
iOS requires HTTPS for getUserMedia. Verify:
- Using HTTPS in production
- OR testing on localhost/127.0.0.1
- OR using a tunneling service (ngrok) with HTTPS

### 4. Verify Permissions
On iPhone Safari:
1. Settings > Safari > Camera & Microphone
2. Ensure the website has permission
3. Check browser console for permission errors

### 5. Check Connection States
Monitor these connection states in console:
- `signalingState`: Should progress from "stable" → "have-local-offer"/"have-remote-offer" → "stable"
- `iceConnectionState`: Should progress from "new" → "checking" → "connected"/"completed"
- `connectionState`: Should progress from "new" → "connecting" → "connected"/"completed"

## Common iPhone Issues

### Issue 1: Connection Stuck in "checking"
**Symptoms:**
- ICE connection state stays in "checking"
- No TURN candidates gathered

**Solutions:**
- Verify TURN servers are configured
- Check network connectivity
- Ensure Cloudflare TURN credentials are valid

### Issue 2: Connection Fails Immediately
**Symptoms:**
- ICE connection state goes to "failed"
- Connection state goes to "failed"

**Solutions:**
- Check TURN server configuration
- Verify HTTPS is being used
- Check camera/microphone permissions
- Review console logs for specific error messages

### Issue 3: No Audio/Video
**Symptoms:**
- Connection establishes but no media tracks

**Solutions:**
- Check `localTracks` and `remoteTracks` in diagnostics
- Verify getUserMedia permissions
- Check if tracks are enabled/muted

### Issue 4: Answer Button Not Responding
**Symptoms:**
- Tap on Answer button doesn't trigger call acceptance

**Solutions:**
- Check mobile compatibility handlers (`onTouchEnd`)
- Verify `resumeAudioContext()` is called
- Check for JavaScript errors in console

## Diagnostic Commands

### Manual Diagnostics
In browser console (development mode):
```javascript
// Import diagnostics utility
import { logConnectionDiagnostics, diagnoseConnection } from '@/utils/callConnectionDiagnostics';

// Get peer connection reference (from React DevTools or component)
const pc = /* peer connection reference */;

// Run diagnostics
logConnectionDiagnostics(pc);

// Or get diagnostics object
const diagnostics = diagnoseConnection(pc);
console.warn('Diagnostics:', diagnostics);
```

### Check Connection Likelihood
```javascript
import { isConnectionLikelyToSucceed } from '@/utils/callConnectionDiagnostics';

const willSucceed = isConnectionLikelyToSucceed(pc);
console.warn('Connection likely to succeed:', willSucceed);
```

## Testing Checklist

- [ ] Test on iPhone Safari (latest iOS version)
- [ ] Test on iPhone Chrome (if applicable)
- [ ] Verify HTTPS is working
- [ ] Check TURN servers are configured
- [ ] Verify camera/microphone permissions
- [ ] Test incoming call acceptance
- [ ] Test outgoing call initiation
- [ ] Monitor connection state transitions
- [ ] Check for ICE candidate gathering
- [ ] Verify media tracks are present
- [ ] Test on different network types (WiFi, cellular)

## Next Steps

If connections still fail after verification:

1. **Check Console Logs**: Look for specific error messages
2. **Run Diagnostics**: Use `logConnectionDiagnostics()` in console
3. **Verify TURN Servers**: Ensure TURN servers are accessible
4. **Test Network**: Try different networks (WiFi vs cellular)
5. **Check Permissions**: Verify camera/microphone permissions
6. **Review Logs**: Check server-side logs for call status updates

## Related Files

- `src/utils/callConnectionDiagnostics.ts` - Diagnostic utility
- `src/features/calls/hooks/useWebRTC.ts` - WebRTC connection logic
- `src/features/calls/hooks/useCallEngine.ts` - Call engine orchestration
- `src/features/calls/hooks/modules/useIncomingCall.ts` - Incoming call handling
- `src/utils/mobileCompatibility.ts` - Mobile compatibility utilities


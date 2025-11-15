# Production Call Issues Debugging Guide

## Issues Reported

1. **Child to Parent**: No incoming call notification for parent
2. **Parent to Child**: Call connects but keeps ringing, no video/audio

Both work in development but not in production.

## Root Causes & Fixes

### Issue 1: Child to Parent - No Incoming Call Notification

**Possible Causes:**
1. Realtime subscription not connecting in production
2. RLS policies blocking SELECT operations needed for realtime
3. WebSocket connections blocked by firewall/CDN
4. Environment variables not set correctly

**Fixes Applied:**
- ✅ Added subscription error handling to ChildDashboard (was missing)
- ✅ Added retry logic for failed subscriptions
- ✅ Enhanced logging to diagnose subscription status

**Debugging Steps:**

1. **Check Browser Console** (on production site):
   - Look for: `📡 [PARENT DASHBOARD] Setting up realtime subscription`
   - Check status: Should see `✅ Successfully subscribed` or `❌ Subscription failed`
   - If failed, check error message

2. **Verify Environment Variables**:
   ```bash
   # In browser console on production site
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
   console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20));
   ```

3. **Test WebSocket Connection**:
   ```javascript
   // In browser console
   const ws = new WebSocket("wss://YOUR_PROJECT.supabase.co/realtime/v1/websocket");
   ws.onopen = () => console.log("✅ WebSocket connected");
   ws.onerror = (e) => console.error("❌ WebSocket error", e);
   ```

4. **Check Supabase Dashboard**:
   - Go to **Database** → **Replication**
   - Verify `calls` table has **Realtime enabled** (toggle ON)
   - Go to **Realtime** → **Channels** to see active connections

5. **Verify RLS Policies**:
   - Go to **Database** → **Policies**
   - Check that `calls` table has SELECT policies for both `anon` and `authenticated` roles
   - Realtime requires SELECT permissions to monitor changes

### Issue 2: Parent to Child - Call Connects But Keeps Ringing

**Possible Causes:**
1. Status update to "in_call" happens but UI doesn't reflect it
2. WebRTC connection established but status check fails
3. Realtime UPDATE event not received
4. Race condition between status update and WebRTC connection

**Fixes Applied:**
- ✅ Enhanced logging in call engine status monitoring
- ✅ Added fallback status check if realtime UPDATE missed
- ✅ Improved WebRTC connection state detection

**Debugging Steps:**

1. **Check Call Status Updates**:
   ```javascript
   // In browser console during call
   // Should see these logs:
   // "📞 [CALL ENGINE] Call accepted: <callId>"
   // "📞 [CALL ENGINE] Answer received, setting remote description"
   // "📞 [CALL ENGINE] Connection established, transitioning to in_call"
   ```

2. **Verify Database Status**:
   ```sql
   -- In Supabase SQL Editor
   SELECT id, status, caller_type, created_at, updated_at 
   FROM calls 
   WHERE id = '<callId>'
   ORDER BY updated_at DESC;
   ```
   - Status should be `in_call` after child accepts
   - If status is still `ringing`, the UPDATE query failed

3. **Check WebRTC Connection State**:
   ```javascript
   // In browser console during call
   const pc = /* get peer connection from React DevTools */;
   console.log({
     connectionState: pc.connectionState,
     iceConnectionState: pc.iceConnectionState,
     signalingState: pc.signalingState,
     hasLocalDescription: !!pc.localDescription,
     hasRemoteDescription: !!pc.remoteDescription,
     remoteStream: !!pc.getReceivers().find(r => r.track)
   });
   ```

4. **Verify Realtime UPDATE Events**:
   - Enable debug mode: Set `VITE_ENABLE_CALLS_REALTIME_DEBUG=true` in production (temporarily)
   - Watch console for `[CALLS REALTIME]` logs showing UPDATE events
   - If no UPDATE events, realtime subscription isn't working

## Common Production Issues

### 1. Realtime Not Enabled in Supabase

**Symptom**: No realtime events received, subscriptions show `CHANNEL_ERROR`

**Fix**: 
- Go to Supabase Dashboard → Database → Replication
- Enable Realtime for `calls` table
- Verify `supabase_realtime` publication includes `calls` table

### 2. RLS Policies Blocking Realtime

**Symptom**: Subscriptions connect but no events received

**Fix**:
- Ensure SELECT policies exist for both `anon` and `authenticated` roles
- Policies must allow reading calls where user is parent_id or child_id
- Realtime needs SELECT permissions to monitor changes

### 3. WebSocket Blocked by CDN/Firewall

**Symptom**: WebSocket connection fails, subscriptions timeout

**Fix**:
- Check CDN/firewall settings allow WebSocket connections
- Verify production URL is in Supabase redirect URLs
- Test WebSocket connection manually (see above)

### 4. Environment Variables Not Set

**Symptom**: Supabase client fails to initialize, no connections

**Fix**:
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set in production
- Redeploy after adding environment variables
- Check variable names match exactly (case-sensitive)

### 5. Status Update Race Condition

**Symptom**: Call status updates but UI doesn't reflect it

**Fix**:
- Check if realtime UPDATE event is received
- Verify WebRTC connection state detection logic
- Add manual status polling as fallback (already implemented)

## Enhanced Logging Added

The following logs help diagnose production issues:

### Parent Dashboard:
- `📡 [PARENT DASHBOARD] Setting up realtime subscription`
- `✅ [PARENT DASHBOARD] Successfully subscribed`
- `❌ [PARENT DASHBOARD] Subscription failed`
- `🔄 [PARENT DASHBOARD] Retrying subscription`

### Child Dashboard:
- `📡 [CHILD DASHBOARD] Setting up realtime subscription`
- `✅ [CHILD DASHBOARD] Successfully subscribed`
- `❌ [CHILD DASHBOARD] Subscription failed`
- `🔄 [CHILD DASHBOARD] Retrying subscription`

### Call Engine:
- `📞 [CALL ENGINE] Call accepted: <callId>`
- `📞 [CALL ENGINE] Answer received, setting remote description`
- `📞 [CALL ENGINE] Connection established, transitioning to in_call`

## Next Steps

1. **Deploy the fixes** (subscription error handling added)
2. **Monitor production logs** using browser console
3. **Check Supabase Dashboard** for realtime connection status
4. **Verify RLS policies** allow SELECT operations
5. **Test both call directions** and report which logs appear

## Temporary Debug Mode

To enable comprehensive realtime debugging in production (temporarily):

1. Set `VITE_ENABLE_CALLS_REALTIME_DEBUG=true` in production environment
2. Redeploy
3. Watch console for `[CALLS REALTIME]` logs
4. **Remove after debugging** - this logs all call events


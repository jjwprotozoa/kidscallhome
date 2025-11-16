# Vercel Production Deployment Checklist for WebRTC Calls

## ✅ Critical: Calls Require Supabase Realtime

**YES, calls MUST be part of realtime!** The entire call engine depends on Supabase Realtime for:

1. **SDP Exchange**: Offer/answer exchange between parent and child
2. **ICE Candidates**: Real-time ICE candidate routing (parent ↔ child)
3. **Call State Updates**: Status changes (ringing → active → ended)
4. **Incoming Call Notifications**: Instant notifications when calls are initiated

Without Realtime, calls **will not work** in production.

---

## 🔧 Pre-Deployment Checklist

### 1. Environment Variables in Vercel ✅

**Status**: ✅ **Already Configured** - Supabase API keys are set in Vercel environment variables

**Required Variables (Already Set):**
```env
VITE_SUPABASE_URL=https://itmhojbjfacocrpmslmt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

**Verify They're Working:**
After deployment, check in browser console on production site:
```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
// Should show: https://itmhojbjfacocrpmslmt.supabase.co
```

**Note**: If you make changes to environment variables, remember to redeploy.

---

### 2. Supabase Dashboard Configuration ✅

#### A. Enable Realtime for `calls` Table ✅

**Status**: ✅ **Already Configured** - Supabase Realtime is enabled

**Verify It's Working:**
After deployment, check browser console on production site for:
```
📡 [PARENT/CHILD DASHBOARD] Realtime subscription status: SUBSCRIBED
```

**Manual Verification (Optional):**
```sql
-- Run in Supabase SQL Editor
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'calls';
-- Should return 1 row
```

#### B. Add Production URL to Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add your production domain to **Redirect URLs**:
   ```
   https://www.kidscallhome.com/**
   https://kidscallhome.com/**
   https://kidscallhome.vercel.app/**
   ```
3. Set **Site URL** to your production domain:
   ```
   https://www.kidscallhome.com
   ```

**Why**: Auth must work for Realtime subscriptions to authenticate properly.

#### C. Verify RLS Policies

1. Go to **Database** → **Policies**
2. Verify policies exist for `calls` table:
   - Parents can read calls where `parent_id = auth.uid()`
   - Children can read calls where `child_id` matches their profile
   - Both can INSERT/UPDATE their own calls

**Verify:**
```sql
-- Check policies exist
SELECT * FROM pg_policies 
WHERE tablename = 'calls';
-- Should show policies for SELECT, INSERT, UPDATE
```

---

### 3. WebRTC Configuration

The code uses public STUN/TURN servers that work in production:

- **STUN**: Google's public STUN servers (works everywhere)
- **TURN**: Metered TURN (free tier, works for testing)

**For Production Scale**: Consider upgrading to a paid TURN service:
- Twilio TURN
- Metered TURN (paid tier)
- Custom TURN server

**Current Configuration** (`src/features/calls/hooks/useWebRTC.ts`):
```typescript
iceServers: [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
]
```

**No changes needed** - this works in production.

---

### 4. Code Configuration

✅ **Supabase Client**: Already configured with Realtime enabled  
✅ **No hardcoded URLs**: All URLs use environment variables  
✅ **WebRTC**: Uses public STUN/TURN servers (works in production)  
✅ **Polling Fallback**: 10-second polling ensures calls work even if Realtime temporarily fails

---

## 🚀 Deployment Steps

### Step 1: Verify Environment Variables

```bash
# In Vercel Dashboard, verify:
VITE_SUPABASE_URL=https://itmhojbjfacocrpmslmt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-key>
```

### Step 2: Deploy to Vercel

```bash
# Push to main branch (auto-deploys) or:
vercel --prod
```

### Step 3: Verify Deployment

After deployment, check:

1. **Environment Variables Loaded**:
   ```javascript
   // In browser console on production site
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
   // Should show: https://itmhojbjfacocrpmslmt.supabase.co
   ```

2. **Realtime Subscription Status**:
   - Open browser console (F12)
   - Navigate to Parent Dashboard or Child Dashboard
   - Look for:
     ```
     📡 [PARENT DASHBOARD] Setting up realtime subscription for incoming calls
     📡 [PARENT DASHBOARD] Realtime subscription status: {status: 'SUBSCRIBED', ...}
     ```

3. **WebSocket Connection**:
   ```javascript
   // Test WebSocket manually in browser console
   const ws = new WebSocket(
     "wss://itmhojbjfacocrpmslmt.supabase.co/realtime/v1/websocket"
   );
   ws.onopen = () => console.log("✅ WebSocket connected");
   ws.onerror = (e) => console.error("❌ WebSocket error", e);
   ```

---

## 🧪 Production Testing

### Test 1: Parent → Child Call

1. **Parent**: Log in on production site
2. **Child**: Log in on production site (different browser/device)
3. **Parent**: Initiate call to child
4. **Verify**:
   - ✅ Child receives incoming call notification (via Realtime)
   - ✅ Child accepts → call connects
   - ✅ Both see video and hear audio
   - ✅ Either side can hang up

### Test 2: Child → Parent Call

1. **Child**: Initiate call to parent
2. **Verify**:
   - ✅ Parent receives incoming call notification (via Realtime)
   - ✅ Parent accepts → call connects
   - ✅ Both see video and hear audio
   - ✅ Either side can hang up

### Test 3: Realtime Subscription Status

**In Browser Console**, verify:
- `📡 [PARENT DASHBOARD] Realtime subscription status: SUBSCRIBED`
- `📡 [CHILD DASHBOARD] Realtime subscription status: SUBSCRIBED`

If you see `CHANNEL_ERROR` or `TIMED_OUT`:
- Check environment variables
- Verify Realtime is enabled for `calls` table
- Check Supabase Dashboard → Realtime → Channels

---

## 🐛 Troubleshooting

### Issue: Calls Work in Dev But Not Production

**Most Common Causes:**

1. **Environment Variables Not Set**
   - ✅ Check Vercel Dashboard → Environment Variables
   - ✅ Verify variable names match exactly
   - ✅ Redeploy after adding variables

2. **Realtime Not Enabled**
   - ✅ Go to Supabase Dashboard → Database → Replication
   - ✅ Enable Realtime for `calls` table
   - ✅ Verify `supabase_realtime` publication includes `calls`

3. **RLS Policies Blocking**
   - ✅ Check Supabase Dashboard → Database → Policies
   - ✅ Verify SELECT policies exist for `calls` table
   - ✅ Realtime needs SELECT permissions to monitor changes

4. **WebSocket Blocked**
   - ✅ Check browser console for WebSocket errors
   - ✅ Verify production URL is in Supabase redirect URLs
   - ✅ Test WebSocket connection manually (see above)

5. **Auth Not Working**
   - ✅ Verify production URL is in Supabase redirect URLs
   - ✅ Check browser console for auth errors
   - ✅ Realtime subscriptions require authenticated users

### Issue: Realtime Subscriptions Not Connecting

**Debug Steps:**

1. **Check Browser Console**:
   - Look for `📡 [PARENT/CHILD DASHBOARD] Realtime subscription status`
   - If status is `CHANNEL_ERROR`, check error message

2. **Check Supabase Dashboard**:
   - Go to **Realtime** → **Channels**
   - Should see active connections
   - If empty, subscriptions aren't connecting

3. **Verify Environment Variables**:
   ```javascript
   // In browser console
   console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
   console.log('Key:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20));
   ```

4. **Test WebSocket Manually**:
   ```javascript
   const ws = new WebSocket(
     "wss://itmhojbjfacocrpmslmt.supabase.co/realtime/v1/websocket"
   );
   ws.onopen = () => console.log("✅ Connected");
   ws.onerror = (e) => console.error("❌ Error", e);
   ```

### Issue: No Video/Audio in Production

**Possible Causes:**

1. **Browser Permissions**: User must allow camera/microphone
2. **HTTPS Required**: WebRTC requires HTTPS (Vercel provides this ✅)
3. **TURN Server Issues**: If both users are behind strict NATs
   - Check browser console for ICE connection errors
   - Consider upgrading to paid TURN service

---

## 📊 Monitoring

### Key Metrics to Monitor:

1. **Realtime Subscription Status**:
   - Check browser console logs
   - Monitor Supabase Dashboard → Realtime → Channels

2. **Call Success Rate**:
   - Track calls that successfully connect
   - Monitor calls that fail to connect

3. **WebRTC Connection State**:
   - Monitor ICE connection state transitions
   - Track connection failures

### Logs to Watch:

**In Browser Console:**
- `📡 [PARENT/CHILD DASHBOARD] Realtime subscription status: SUBSCRIBED`
- `✅ [MEDIA] Media stream obtained`
- `🔗 [ICE] ICE connection state: connected`
- `📞 [CALL] Call connected successfully`

**In Supabase Dashboard:**
- Realtime → Channels (active connections)
- Database → Logs (for errors)

---

## ✅ Final Checklist

Before going live:

- [x] Environment variables set in Vercel (Production, Preview, Development) ✅ **Done**
- [x] Realtime enabled for `calls` table in Supabase ✅ **Done**
- [ ] Production URL added to Supabase redirect URLs ⚠️ **Verify This**
- [ ] RLS policies verified for `calls` table
- [ ] Tested Parent → Child call in production
- [ ] Tested Child → Parent call in production
- [ ] Verified Realtime subscriptions are connecting
- [ ] Verified WebSocket connections work
- [ ] Tested hangup from both sides
- [ ] Verified video and audio work in production

---

## 🔗 Related Documentation

- `PRODUCTION_SETUP.md` - Detailed production setup guide
- `PRODUCTION_CALL_DEBUGGING.md` - Production debugging guide
- `src/features/calls/README.md` - Call engine technical documentation
- `CALLS_TEST_PLAN.md` - Manual testing procedures

---

## 🎯 Summary

**YES, calls require Supabase Realtime!** The call engine is designed to work with Realtime subscriptions for:

- ✅ SDP offer/answer exchange
- ✅ ICE candidate routing
- ✅ Call state updates
- ✅ Incoming call notifications

**The code is production-ready** - just ensure:
1. Environment variables are set in Vercel
2. Realtime is enabled for `calls` table in Supabase
3. Production URL is in Supabase redirect URLs
4. RLS policies allow Realtime subscriptions

**Polling fallback** (10 seconds) ensures calls work even if Realtime temporarily fails, but Realtime is the primary mechanism and should be working for optimal performance.


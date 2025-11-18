# Online Status / Presence System

## Overview

The presence system uses **Supabase Realtime Presence API** - a client-side WebSocket feature that requires **no backend workers or deployment**. It works identically in development and production.

## How It Works

1. **Children track their presence** when they visit ChildDashboard or ChildHome
2. **Parents subscribe** to their children's presence channels
3. **Status updates in real-time** via WebSocket connections
4. **No database tables needed** - presence is ephemeral and managed by Supabase Realtime

## Requirements

### ✅ Supabase Realtime Must Be Enabled

**Check in Supabase Dashboard:**

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Verify **Realtime** is enabled (usually enabled by default)

**Or check via SQL:**

```sql
-- Check if Realtime is enabled
SELECT * FROM pg_publication 
WHERE pubname = 'supabase_realtime';
```

If this returns no rows, Realtime might not be enabled. Contact Supabase support or check your project settings.

### ✅ No Database Migrations Needed

Presence channels are **not database tables** - they're ephemeral WebSocket channels. No migrations required.

### ✅ Environment Variables

Make sure your `.env` file has:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

## Troubleshooting

### Status Dot Shows Gray When Child Is Online

**1. Check Browser Console**

Look for these logs:
- `🟢 [PRESENCE] Starting presence tracking` - Child is tracking
- `✅ [PRESENCE] Subscribed to presence channel` - Child subscribed
- `👀 [CHILDREN PRESENCE] Setting up presence subscriptions` - Parent subscribing
- `✅ [CHILDREN PRESENCE] Subscribed to child presence` - Parent subscribed
- `🔄 [CHILDREN PRESENCE] Presence synced` - Shows presence state

**2. Verify Realtime Connection**

Open browser console and run:

```javascript
// Check active channels
console.log(supabase.realtime.channels);

// Check connection state
console.log(supabase.realtime.isConnected());
```

**3. Check Network Tab**

- Look for WebSocket connections to `wss://your-project.supabase.co/realtime/v1/websocket`
- Connection should show as "101 Switching Protocols"

**4. Common Issues**

| Issue | Solution |
|-------|----------|
| No WebSocket connection | Check if Realtime is enabled in Supabase Dashboard |
| `CHANNEL_ERROR` in console | Verify Supabase URL and API key are correct |
| Presence sync but no status | Check browser console for presence state structure |
| Works in dev but not production | Same code - check environment variables are set correctly |

## Testing

**Test Presence Locally:**

1. Open **two browser windows** (or incognito + regular)
2. Window 1: Login as child → Go to ChildDashboard
3. Window 2: Login as parent → Go to ParentDashboard
4. Check console logs in both windows
5. Green dot should appear in parent window

**Expected Console Output:**

**Child Window:**
```
🟢 [PRESENCE] Starting presence tracking { channelName: "presence:child:...", userId: "...", userType: "child" }
✅ [PRESENCE] Subscribed to presence channel
```

**Parent Window:**
```
👀 [CHILDREN PRESENCE] Setting up presence subscriptions { childIds: [...], count: 1 }
✅ [CHILDREN PRESENCE] Subscribed to child presence { childId: "...", channelName: "presence:child:..." }
🔄 [CHILDREN PRESENCE] Presence synced { childId: "...", isOnline: true, childInState: true }
```

## Production Checklist

- [ ] Realtime is enabled in Supabase Dashboard
- [ ] Environment variables are set correctly
- [ ] Test presence with two browser windows
- [ ] Check browser console for errors
- [ ] Verify WebSocket connection in Network tab

## Architecture

```
┌─────────────┐                    ┌──────────────┐
│   Child     │                    │   Parent     │
│  Browser    │                    │   Browser    │
└──────┬──────┘                    └──────┬───────┘
       │                                   │
       │ WebSocket                         │ WebSocket
       │                                   │
       ▼                                   ▼
┌──────────────────────────────────────────────┐
│     Supabase Realtime (WebSocket Server)     │
│                                               │
│  Channel: presence:child:{childId}           │
│  - Child tracks presence                     │
│  - Parent subscribes to presence events      │
└──────────────────────────────────────────────┘
```

**No backend workers needed** - everything happens client-side via WebSockets!



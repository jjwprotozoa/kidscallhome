# Fix Messaging in Production

## Issue
Child-to-parent messaging works in dev but not in prod. Parent-to-child messaging works in both.

## Root Cause
The `messages` table likely doesn't have **Realtime enabled** in Supabase production, which means realtime subscriptions fail silently.

## Fix Steps

### 1. Enable Realtime for Messages Table

**CRITICAL**: Messages require realtime subscriptions to work properly!

1. Go to **Supabase Dashboard** → **Database** → **Replication**
2. Find the `messages` table in the list
3. Toggle **Enable Realtime** to **ON** ✅
4. This allows Supabase realtime to send INSERT events for new messages

**Verify It's Enabled:**
```sql
-- Run in Supabase SQL Editor
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'messages';
-- Should return 1 row
```

### 2. Verify RLS Policies Allow Realtime

Realtime subscriptions need SELECT permissions. Verify these policies exist:

**For Parents (authenticated):**
- Policy: "Parents can view messages for their children"
- Must allow SELECT where `child_id` belongs to parent's children

**For Children (anon):**
- Policy: "Children can view their messages"  
- Must allow SELECT where `child_id` matches child's ID

**Check Policies:**
```sql
-- Run in Supabase SQL Editor
SELECT 
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY policyname;
```

### 3. Test in Production

After enabling realtime:

1. **Open production site** in browser
2. **Open browser console** (F12)
3. **Navigate to Chat page** (as child or parent)
4. **Look for these logs:**
   ```
   📡 [CHAT] Setting up realtime subscription for messages
   📡 [CHAT] Realtime subscription status: SUBSCRIBED
   ✅ [CHAT] Successfully subscribed to messages
   ```

5. **Send a message** from one side
6. **Check console** for:
   ```
   📨 [CHAT] Received new message via realtime
   ```

### 4. Debugging

If messages still don't appear in real-time:

**Check Subscription Status:**
- Look for `CHANNEL_ERROR` in console logs
- If you see `CHANNEL_ERROR`, realtime isn't enabled or RLS is blocking

**Test WebSocket Connection:**
```javascript
// In browser console on production site
const ws = new WebSocket(
  "wss://YOUR_PROJECT.supabase.co/realtime/v1/websocket"
);
ws.onopen = () => console.log("✅ WebSocket connected");
ws.onerror = (e) => console.error("❌ WebSocket error", e);
```

**Check Environment Variables:**
```javascript
// In browser console
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20));
```

## Code Changes Made

✅ **Fixed Chat.tsx** to properly manage realtime subscriptions:
- Added `channelRef` to store subscription
- Added subscription status logging
- Proper cleanup in useEffect
- Unique channel names per conversation

The subscription now:
- Logs when it's set up
- Logs subscription status (SUBSCRIBED/CHANNEL_ERROR)
- Logs when messages are received via realtime
- Properly cleans up on unmount

## Why It Works in Dev But Not Prod

**Development:**
- Local Supabase might have realtime enabled by default
- Or you're testing with a different Supabase project that has it enabled

**Production:**
- Production Supabase project needs realtime explicitly enabled
- Each table must be added to the `supabase_realtime` publication
- This is a one-time configuration in Supabase Dashboard

## Summary

**YES, messaging needs realtime!** Without it:
- Messages can be sent (INSERT works)
- Messages won't appear in real-time (no INSERT events)
- Users must refresh to see new messages

**With realtime enabled:**
- Messages appear instantly when sent
- No page refresh needed
- Works exactly like calls (which already use realtime)


# Test Messaging Realtime in Production

## Quick Test Steps

1. **Open Production Site** in two browser windows/tabs:
   - Window 1: Parent logged in
   - Window 2: Child logged in (or use incognito)

2. **Open Browser Console** in both windows (F12)

3. **Navigate to Chat** in both windows:
   - Parent: Click on a child → Chat
   - Child: Click Chat button

4. **Check Console Logs** - You should see:

   **Parent Window:**
   ```
   📡 [CHAT] Setting up realtime subscription for messages
   📡 [CHAT] Creating realtime channel: messages-{childId}
   📡 [CHAT] Realtime subscription status: SUBSCRIBED
   ✅ [CHAT] Successfully subscribed to messages
   ✅ [CHAT] Will receive INSERT events for child_id: {childId}
   ```

   **Child Window:**
   ```
   📡 [CHAT] Setting up realtime subscription for messages
   📡 [CHAT] Creating realtime channel: messages-{childId}
   📡 [CHAT] Realtime subscription status: SUBSCRIBED
   ✅ [CHAT] Successfully subscribed to messages
   ```

5. **Send Message from Child**:
   - Child types message and clicks Send
   - Check child console: Should see `📤 [MESSAGE INSERT] Success`
   - Check parent console: Should see `📨 [CHAT] Received new message via realtime`

6. **If Parent Doesn't Receive Message**:
   - Check parent console for `CHANNEL_ERROR` or `TIMED_OUT`
   - Check if polling fallback is working: Look for `📨 [CHAT] Polling found new messages`
   - Messages should appear within 3 seconds via polling

## Expected Behavior

### ✅ Working (Realtime):
- Child sends message → Parent sees it instantly (< 1 second)
- Parent sends message → Child sees it instantly (< 1 second)
- Console shows: `📨 [CHAT] Received new message via realtime`

### ⚠️ Fallback (Polling):
- Child sends message → Parent sees it within 3 seconds
- Parent sends message → Child sees it within 3 seconds
- Console shows: `📨 [CHAT] Polling found new messages: 1`
- Console shows: `❌ [CHAT] Realtime subscription error` or `⚠️ [CHAT] Realtime subscription timed out`

## Debugging

### If Realtime Shows SUBSCRIBED but No Messages:

1. **Check RLS Policies**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT policyname, cmd, roles 
   FROM pg_policies 
   WHERE tablename = 'messages';
   ```
   Should see 4 policies (2 SELECT, 2 INSERT)

2. **Test Parent SELECT**:
   ```sql
   -- Replace CHILD_ID with actual child ID
   SELECT * FROM messages 
   WHERE child_id = 'CHILD_ID'
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
   Should return messages if parent SELECT policy works

3. **Check Realtime Status**:
   ```sql
   SELECT tablename 
   FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime' 
   AND tablename = 'messages';
   ```
   Should return 1 row

### If Subscription Shows CHANNEL_ERROR:

1. **Check WebSocket Connection**:
   ```javascript
   // In browser console
   const ws = new WebSocket("wss://YOUR_PROJECT.supabase.co/realtime/v1/websocket");
   ws.onopen = () => console.log("✅ WebSocket connected");
   ws.onerror = (e) => console.error("❌ WebSocket error", e);
   ```

2. **Check Environment Variables**:
   ```javascript
   // In browser console
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
   console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20));
   ```

## Summary

- **Realtime**: Best experience, instant updates
- **Polling Fallback**: Works but 3-second delay
- Both should work - if polling works but realtime doesn't, it's a realtime configuration issue
- If neither works, it's an RLS policy issue


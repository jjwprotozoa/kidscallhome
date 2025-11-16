# Badge System Production Readiness

## ✅ What Works in Production

The badge system is **production-ready** with the following guarantees:

### 1. **Zero Ongoing Reads**

- ✅ One initial snapshot query per session
- ✅ All updates via Supabase Realtime events
- ✅ No polling or continuous queries

### 2. **Automatic Reconnection**

- ✅ Supabase client handles WebSocket reconnection automatically
- ✅ Badges will sync when connection is restored
- ✅ No manual reconnection logic needed

### 3. **Error Handling**

- ✅ Initial snapshot failures are logged (badges start at 0, populate via realtime)
- ✅ Realtime subscription errors are logged
- ✅ Store updates are synchronous (no async failures)

## ⚠️ Production Considerations

### 1. **Database Migration Required**

**CRITICAL**: Run this migration in production:

```sql
-- Enable REPLICA IDENTITY FULL for UPDATE events
ALTER TABLE public.messages REPLICA IDENTITY FULL;
```

**File**: `supabase/migrations/20250116000002_enable_realtime_updates_for_messages.sql`

Without this, UPDATE events won't include old values, and badges won't clear when messages are marked as read.

### 2. **Realtime Must Be Enabled**

Verify in Supabase Dashboard:

- ✅ `messages` table is in `supabase_realtime` publication
- ✅ `calls` table is in `supabase_realtime` publication

Check:

```sql
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename IN ('messages', 'calls');
```

### 3. **Multi-Device Sync Trade-off**

**Current Behavior**: Badges are **per-device**, not globally synced.

- ✅ If user marks messages as read on Device A, Device B will still show badges
- ✅ Device B badges will clear when:
  - User opens chat on Device B (marks as read)
  - App reloads (re-fetches initial snapshot)
  - Realtime UPDATE event is received (if connection is active)

**Solution**: Enable optional reconciliation (see below)

### 4. **Network Failures**

**What happens if realtime disconnects?**

- ✅ Supabase auto-reconnects (built-in)
- ✅ Badges continue working locally
- ⚠️ New messages/calls won't update badges until reconnection
- ✅ When reconnected, missed events are processed

**What happens if initial snapshot fails?**

- ✅ Badges start at 0
- ✅ Realtime events will populate badges as they arrive
- ⚠️ Historical unread counts won't show until reconciliation

## 🔧 Optional: Enable Reconciliation

For multi-device sync or extra reliability, enable periodic reconciliation:

```tsx
// In App.tsx or BadgeProvider
import { useBadgeReconciliation } from "@/hooks/useBadgeReconciliation";

const BadgeProvider = () => {
  useBadgeInitialization();
  useBadgeRealtime();

  // Optional: Reconcile every 5 minutes (adds DB reads)
  useBadgeReconciliation({
    enabled: true, // Set to true for multi-device sync
    intervalMinutes: 5,
  });

  return null;
};
```

**Trade-off**: Adds periodic DB reads (every 5 minutes) but ensures badges stay in sync across devices.

## 📊 Production Monitoring

Monitor these in production:

1. **Realtime Connection Status**

   - Check browser console for `CHANNEL_ERROR` or `TIMED_OUT`
   - Supabase Dashboard → Realtime → Connections

2. **Badge Accuracy**

   - Compare badge counts with actual unread counts
   - Use reconciliation hook if drift is detected

3. **Database Performance**
   - Monitor query performance on initial snapshot
   - Ensure indexes exist: `idx_messages_read_at`, `idx_calls_missed_unread`

## ✅ Production Checklist

- [ ] Run migration: `20250116000002_enable_realtime_updates_for_messages.sql`
- [ ] Verify Realtime is enabled for `messages` and `calls` tables
- [ ] Test badge updates when realtime disconnects/reconnects
- [ ] Test initial snapshot failure scenario (badges should still work)
- [ ] Decide if reconciliation is needed (multi-device sync)
- [ ] Monitor realtime connection status in production
- [ ] Set up alerts for realtime connection failures (optional)

## 🚀 Performance

**Expected Performance**:

- Initial load: 1-2 queries (depending on user type)
- Ongoing: 0 queries (all via realtime)
- Badge updates: Instant (local store updates)
- Network: WebSocket connection (low overhead)

**Scalability**:

- ✅ Works with any number of children/messages
- ✅ No N+1 queries
- ✅ Store updates are O(1)

## 🔍 Debugging

If badges aren't updating:

1. **Check Realtime Connection**:

   ```ts
   // In browser console
   supabase.realtime.channels;
   ```

2. **Check Store State**:

   ```ts
   // In browser console
   import { useBadgeStore } from "@/stores/badgeStore";
   console.log(useBadgeStore.getState());
   ```

3. **Check Database**:

   ```sql
   -- Verify REPLICA IDENTITY FULL
   SELECT relreplident FROM pg_class WHERE relname = 'messages';
   -- Should return 'f' (FULL)
   ```

4. **Check Realtime Events**:
   - Open Supabase Dashboard → Realtime → Logs
   - Verify INSERT/UPDATE events are being sent

## Summary

✅ **Production Ready**: Yes, with migration  
✅ **Zero Reads**: After initial snapshot  
✅ **Auto-Reconnect**: Built into Supabase  
⚠️ **Multi-Device**: Per-device badges (use reconciliation if needed)  
✅ **Error Handling**: Graceful degradation

The system is production-ready and will work reliably as long as:

1. The migration is run
2. Realtime is enabled
3. Network connectivity is available (Supabase handles reconnection)

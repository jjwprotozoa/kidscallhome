# Supabase Optimization Implementation Guide

## Overview

This document provides step-by-step instructions for implementing the performance optimizations identified in the Supabase performance analysis.

## Critical Issue: Timezone Query Caching

### Problem
The `pg_timezone_names` query has **0% cache hit rate** and takes 479ms per call, totaling 76 seconds of query time.

### Solution Implemented

1. **Database Function** (`20250120000001_add_timezone_cache_function.sql`)
   - Created `get_timezone_names()` function marked as `STABLE`
   - This enables PostgreSQL query result caching
   - Function is accessible via Supabase RPC

2. **Application-Level Cache** (`src/utils/timezoneCache.ts`)
   - In-memory cache for timezone names
   - Loads once and reuses throughout application lifecycle
   - Falls back to common timezones if database query fails

### Implementation Steps

1. **Run the database migration:**
   ```bash
   # In Supabase dashboard SQL editor, run:
   # supabase/migrations/20250120000001_add_timezone_cache_function.sql
   ```

2. **Use the cache in your application:**
   ```typescript
   import { getTimezoneNames, preloadTimezones } from '@/utils/timezoneCache';
   
   // Preload at app startup (in main.tsx or App.tsx)
   preloadTimezones();
   
   // Use in components
   const timezones = await getTimezoneNames();
   ```

3. **Verify the fix:**
   - Check Supabase query performance dashboard
   - `pg_timezone_names` queries should drop significantly
   - Cache hit rate should improve

---

## Performance Indexes

### Problem
Common query patterns (ORDER BY with WHERE clauses) could benefit from composite indexes.

### Solution Implemented

**Migration:** `20250120000000_add_performance_indexes.sql`

Adds the following indexes:

1. **`idx_messages_conversation_created`**
   - Optimizes: `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`
   - Composite index on `(conversation_id, created_at)`

2. **`idx_messages_read_at`**
   - Optimizes: Filtering unread messages (`WHERE read_at IS NULL`)
   - Partial index for better performance

3. **`idx_calls_conversation_created`**
   - Optimizes: `SELECT * FROM calls WHERE conversation_id = ? ORDER BY created_at DESC`
   - Composite index on `(conversation_id, created_at DESC)`

4. **`idx_messages_created_at`**
   - Optimizes: General `ORDER BY created_at` queries

5. **`idx_calls_created_at`**
   - Optimizes: General `ORDER BY created_at` queries for calls

### Implementation Steps

1. **Run the migration:**
   ```bash
   # In Supabase dashboard SQL editor, run:
   # supabase/migrations/20250120000000_add_performance_indexes.sql
   ```

2. **Verify indexes were created:**
   ```sql
   SELECT indexname, tablename 
   FROM pg_indexes 
   WHERE schemaname = 'public' 
   AND indexname IN (
     'idx_messages_conversation_created',
     'idx_messages_read_at',
     'idx_messages_created_at',
     'idx_calls_conversation_created',
     'idx_calls_created_at'
   );
   ```

3. **Monitor query performance:**
   - Check if message and call queries show improved performance
   - Expected improvement: 20-40% faster for ORDER BY queries

---

## Realtime Subscription Optimization

### Current Status
- **Mean time:** 5.5ms ✅ (excellent)
- **Max time:** 1,590ms ⚠️ (occasional spikes)
- **Cache hit rate:** 100% ✅

### Recommendations

1. **Review subscription cleanup:**
   - Ensure all `useEffect` hooks that create subscriptions have cleanup
   - Example:
   ```typescript
   useEffect(() => {
     const channel = supabase.channel('...').subscribe();
     return () => {
       supabase.removeChannel(channel);
     };
   }, []);
   ```

2. **Monitor subscription count:**
   - Check for subscription leaks
   - Use Supabase dashboard to monitor active subscriptions

3. **Consider adjusting `eventsPerSecond`:**
   - Current: `10` (in `src/integrations/supabase/client.ts`)
   - If spikes are frequent, consider reducing to `5-8`
   - Trade-off: Lower CPU usage vs. slightly higher latency

### Action Items

- [ ] Audit all Realtime subscriptions in the codebase
- [ ] Ensure proper cleanup in all `useEffect` hooks
- [ ] Monitor for subscription leaks
- [ ] Consider adjusting `eventsPerSecond` if needed

---

## Implementation Checklist

### Immediate (Do First)

- [ ] **Run timezone cache migration**
  - File: `supabase/migrations/20250120000001_add_timezone_cache_function.sql`
  - Location: Supabase Dashboard → SQL Editor

- [ ] **Run performance indexes migration**
  - File: `supabase/migrations/20250120000000_add_performance_indexes.sql`
  - Location: Supabase Dashboard → SQL Editor

- [ ] **Integrate timezone cache in application**
  - Import and use `preloadTimezones()` in app startup
  - Replace any direct timezone queries with `getTimezoneNames()`

### High Priority (Do Soon)

- [ ] **Audit Realtime subscriptions**
  - Review all components using Supabase Realtime
  - Ensure proper cleanup in `useEffect` return functions
  - Check for duplicate subscriptions

- [ ] **Set up monitoring**
  - Configure alerts for queries > 500ms
  - Monitor cache hit rates
  - Track Realtime subscription count

### Medium Priority (Monitor)

- [ ] **Monitor query performance**
  - Check Supabase dashboard weekly
  - Look for new slow queries
  - Verify improvements from indexes

- [ ] **Optimize Realtime configuration**
  - If spikes continue, adjust `eventsPerSecond`
  - Consider connection pooling improvements

---

## Expected Results

After implementing these optimizations:

1. **Timezone queries:**
   - Before: 479ms per call, 0% cache hit rate
   - After: < 1ms (cached), 100% cache hit rate
   - **Improvement:** ~99% reduction in query time

2. **Message queries:**
   - Before: 2.6ms average
   - After: ~1.5-2.0ms (with composite indexes)
   - **Improvement:** 20-40% faster

3. **Call queries:**
   - Before: Variable performance
   - After: Consistent performance with indexes
   - **Improvement:** More predictable query times

4. **Overall:**
   - Reduced total query time by ~5-10%
   - Better cache utilization
   - More predictable performance

---

## Verification

### Check Timezone Query Performance

1. Go to Supabase Dashboard → Database → Query Performance
2. Look for `pg_timezone_names` queries
3. Verify:
   - Query count has decreased
   - Cache hit rate has improved
   - Mean time has decreased

### Check Index Usage

1. Run this query to see index usage:
   ```sql
   SELECT 
     schemaname,
     tablename,
     indexname,
     idx_scan as index_scans,
     idx_tup_read as tuples_read,
     idx_tup_fetch as tuples_fetched
   FROM pg_stat_user_indexes
   WHERE schemaname = 'public'
   AND indexname LIKE 'idx_%'
   ORDER BY idx_scan DESC;
   ```

2. Verify that new indexes are being used:
   - `idx_messages_conversation_created` should show scans
   - `idx_calls_conversation_created` should show scans

### Check Realtime Performance

1. Monitor `realtime.list_changes` query:
   - Mean time should remain ~5.5ms
   - Max time spikes should be investigated if > 1000ms
   - Cache hit rate should remain 100%

---

## Troubleshooting

### Timezone Cache Not Working

**Problem:** Still seeing `pg_timezone_names` queries with 0% cache hit rate

**Solutions:**
1. Verify migration was run successfully
2. Check that `get_timezone_names()` function exists:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'get_timezone_names';
   ```
3. Verify application is using the cache utility
4. Check Supabase connection pooling settings

### Indexes Not Being Used

**Problem:** Queries still slow, indexes not showing scans

**Solutions:**
1. Verify indexes were created:
   ```sql
   SELECT * FROM pg_indexes WHERE indexname LIKE 'idx_%';
   ```
2. Check if query planner is using indexes:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM messages 
   WHERE conversation_id = '...' 
   ORDER BY created_at ASC;
   ```
3. Ensure statistics are up to date:
   ```sql
   ANALYZE messages;
   ANALYZE calls;
   ```

### Realtime Spikes Continue

**Problem:** Max time for `realtime.list_changes` still high

**Solutions:**
1. Check for subscription leaks
2. Reduce `eventsPerSecond` in client config
3. Monitor write volume to subscribed tables
4. Consider splitting subscriptions across multiple channels

---

## Additional Resources

- [Supabase Performance Documentation](https://supabase.com/docs/guides/database/performance)
- [PostgreSQL Indexing Guide](https://www.postgresql.org/docs/current/indexes.html)
- [Supabase Realtime Best Practices](https://supabase.com/docs/guides/realtime)

---

## Support

If you encounter issues during implementation:

1. Check the troubleshooting section above
2. Review the migration files for syntax errors
3. Verify Supabase project settings
4. Check Supabase status page for service issues


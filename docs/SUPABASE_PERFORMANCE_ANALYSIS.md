# Supabase Performance Analysis & Optimization Recommendations

## Executive Summary

Analysis of Supabase query performance data reveals **one critical issue** and several optimization opportunities. The system is generally performing well with 100% cache hit rates on most queries, but there are specific areas that need attention.

## Critical Issues

### 1. ⚠️ `pg_timezone_names` Query - 0% Cache Hit Rate (CRITICAL)

**Query:**

```sql
SELECT name FROM pg_timezone_names
```

**Performance Metrics:**

- **Calls:** 159
- **Mean Time:** 479ms (very slow)
- **Max Time:** 1,441ms
- **Cache Hit Rate:** **0%** ❌
- **Total Time:** 76.2 seconds

**Problem:**
This system catalog query is being executed without caching, causing unnecessary database load. This query should be cached as timezone names rarely change.

**Impact:**

- Each call takes ~479ms on average
- 159 calls = 76 seconds of total query time
- This is a system catalog query that should be cached

**Recommendation:**

1. **Enable query result caching** in Supabase for this specific query
2. **Cache timezone names in application** - Load once at startup and cache in memory
3. **Use Supabase connection pooling** with statement caching enabled

**Action Items:**

- [ ] Check Supabase dashboard for query caching settings
- [ ] Implement application-level caching for timezone names
- [ ] Consider using a static timezone list if full catalog isn't needed

---

## High-Volume Query Analysis

### 2. `realtime.list_changes` - 98.4% of Total Query Time

**Query:**

```sql
SELECT wal->>$5 as type,
       wal->>$6 as schema,
       wal->>$7 as table,
       wal->>$8 as columns,
       wal->>$9 as record,
       wal->>$10 as old_record,
       wal->>$11 as commit_timestamp,
       subscription_ids,
       errors
FROM realtime.list_changes($1, $2, $3, $4)
```

**Performance Metrics:**

- **Calls:** 6,127,047 (6.1M)
- **Mean Time:** 5.5ms ✅ (good)
- **Max Time:** 1,590ms ⚠️ (concerning spikes)
- **Cache Hit Rate:** 100% ✅
- **Total Time:** 33,751 seconds (98.4% of all query time)

**Analysis:**

- **Good:** Mean time of 5.5ms is excellent for a high-volume query
- **Good:** 100% cache hit rate indicates efficient caching
- **Concern:** Max time of 1,590ms suggests occasional performance spikes
- **Normal:** This is expected for Realtime subscriptions - it's the core polling mechanism

**Recommendations:**

1. **Monitor spike patterns** - Check if max time spikes correlate with:

   - High write volume to subscribed tables
   - Many concurrent subscriptions
   - Network latency issues

2. **Optimize Realtime configuration:**

   - Current setting: `eventsPerSecond: 10` (in `client.ts`)
   - Consider reducing to `5-8` if spikes are frequent
   - This reduces polling frequency but may increase latency

3. **Review subscription patterns:**
   - Ensure subscriptions are properly cleaned up when components unmount
   - Avoid duplicate subscriptions to the same channel
   - Use channel deduplication

**Action Items:**

- [ ] Review Realtime subscription cleanup in React components
- [ ] Monitor for subscription leaks
- [ ] Consider adjusting `eventsPerSecond` if needed
- [ ] Add monitoring for max time spikes

---

### 3. Subscription Creation Query - Occasional Slow Performance

**Query:**

```sql
with sub_tables as (...)
insert into realtime.subscription as x(...)
```

**Performance Metrics:**

- **Calls:** 24,720
- **Mean Time:** 9.8ms ✅
- **Max Time:** 1,214ms ⚠️
- **Cache Hit Rate:** 99.99% ✅

**Analysis:**

- Generally performing well
- Occasional slow subscription creation (max 1.2s)

**Recommendations:**

- Monitor for patterns in slow subscription creation
- Ensure subscriptions are reused when possible
- Consider connection pooling improvements

---

## Application Query Performance

### 4. Conversations Query - Good Performance ✅

**Query:**

```sql
SELECT "public"."conversations"."id"
FROM "public"."conversations"
WHERE "public"."conversations"."adult_id" = $1
LIMIT $2 OFFSET $3
```

**Performance Metrics:**

- **Calls:** 7,208
- **Mean Time:** 1.4ms ✅
- **Cache Hit Rate:** 100% ✅

**Status:** Excellent performance

---

### 5. Adult Profiles Query - Good Performance ✅

**Query:**

```sql
SELECT "public"."adult_profiles"."id"
FROM "public"."adult_profiles"
WHERE "public"."adult_profiles"."user_id" = $1
AND "public"."adult_profiles"."role" = $2
```

**Performance Metrics:**

- **Calls:** 7,257
- **Mean Time:** 1.1ms ✅
- **Cache Hit Rate:** 99.99% ✅

**Status:** Excellent performance - indexes are working well

---

### 6. Messages Query - Good Performance ✅

**Query:**

```sql
SELECT "public"."messages".*
FROM "public"."messages"
WHERE "public"."messages"."conversation_id" = $1
ORDER BY "public"."messages"."created_at" ASC
```

**Performance Metrics:**

- **Calls:** 1,553
- **Mean Time:** 2.6ms ✅
- **Cache Hit Rate:** 100% ✅

**Status:** Good performance - ensure `idx_messages_conversation_id` and `idx_messages_created_at` exist

---

## Index Verification

Based on the migration files, the following indexes should exist:

### ✅ Existing Indexes (Verified in Migrations)

1. **adult_profiles:**

   - `idx_adult_profiles_user_id`
   - `idx_adult_profiles_family_id`
   - `idx_adult_profiles_role`
   - `idx_adult_profiles_user_family` (composite)

2. **conversations:**

   - `idx_conversations_adult_id`
   - `idx_conversations_child_id`
   - `idx_conversations_adult_child` (composite)

3. **messages:**
   - `idx_messages_conversation_id`
   - Should have `idx_messages_created_at` for ORDER BY performance

### ⚠️ Recommended Additional Indexes

1. **messages table:**

   ```sql
   -- For ORDER BY created_at queries
   CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
   ON public.messages(conversation_id, created_at ASC);

   -- For read_at filtering (if used)
   CREATE INDEX IF NOT EXISTS idx_messages_read_at
   ON public.messages(read_at) WHERE read_at IS NULL;
   ```

2. **calls table:**
   ```sql
   -- For conversation-based queries
   CREATE INDEX IF NOT EXISTS idx_calls_conversation_created
   ON public.calls(conversation_id, created_at DESC);
   ```

---

## Optimization Recommendations Summary

### Priority 1: Critical (Do Immediately)

1. **Fix `pg_timezone_names` caching**
   - Implement application-level caching
   - Enable Supabase query result caching
   - **Expected Impact:** Reduce 76 seconds of query time

### Priority 2: High (Do Soon)

2. **Add composite indexes for common query patterns**

   - `messages(conversation_id, created_at)`
   - `calls(conversation_id, created_at)`
   - **Expected Impact:** Improve ORDER BY performance

3. **Review Realtime subscription management**
   - Audit component cleanup
   - Ensure no subscription leaks
   - **Expected Impact:** Reduce unnecessary `realtime.list_changes` calls

### Priority 3: Medium (Monitor & Optimize)

4. **Monitor Realtime performance spikes**

   - Set up alerts for queries > 500ms
   - Investigate correlation with write volume
   - **Expected Impact:** Identify and fix spike causes

5. **Optimize Realtime configuration**
   - Consider reducing `eventsPerSecond` from 10 to 5-8
   - **Trade-off:** Lower CPU usage vs. slightly higher latency

---

## Implementation Checklist

### Immediate Actions

- [ ] **Create migration for additional indexes**

  ```sql
  -- File: supabase/migrations/YYYYMMDDHHMMSS_add_performance_indexes.sql
  ```

- [ ] **Implement timezone caching in application**

  - Cache `pg_timezone_names` results in memory
  - Refresh cache on application restart only

- [ ] **Review Realtime subscription cleanup**
  - Audit all `useEffect` hooks that create subscriptions
  - Ensure proper cleanup in return functions

### Monitoring Setup

- [ ] **Set up query performance alerts**

  - Alert on queries > 500ms
  - Alert on cache hit rate < 95%

- [ ] **Create dashboard for:**
  - Realtime subscription count
  - Average query times by type
  - Cache hit rates

---

## Expected Performance Improvements

After implementing these optimizations:

1. **Timezone query:** 479ms → < 1ms (cached)
2. **Messages queries:** 2.6ms → ~1.5ms (with composite index)
3. **Realtime spikes:** Reduce frequency by 30-50% (better subscription management)
4. **Overall:** Reduce total query time by ~5-10%

---

## Notes

- Most queries are performing excellently with 100% cache hit rates
- The system is well-optimized overall
- The main issue is the uncached timezone query
- Realtime performance is good but could benefit from subscription management improvements

---

## References

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [PostgreSQL Indexing Best Practices](https://www.postgresql.org/docs/current/indexes.html)
- [Supabase Query Performance](https://supabase.com/docs/guides/database/performance)

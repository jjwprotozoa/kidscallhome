# Slow Query Optimization Summary

## Overview

This document summarizes optimizations for 200+ slow queries identified in the Supabase performance analysis.

## Critical Issues Addressed

### 1. ⚠️ `pg_timezone_names` - 0% Cache Hit Rate (CRITICAL)

**Current Performance:**

- Mean Time: 477ms
- Cache Hit Rate: 0%
- Calls: 162
- Total Time: 77.3 seconds

**Solution:**

- Created materialized view `timezone_names_cache` for persistent caching
- Updated `get_timezone_names()` function to use materialized view
- Added refresh function for periodic updates

**Expected Improvement:**

- Cache hit rate: 0% → 100%
- Query time: 477ms → <1ms (after first load)
- Total time saved: ~77 seconds

**Maintenance:**

- Refresh monthly: `SELECT public.refresh_timezone_cache();`

---

### 2. Calls Table UPDATE Queries

**Current Performance:**

- UPDATE queries with `WHERE id = $2` pattern
- Mean Time: 1.4ms (acceptable, but can be optimized)

**Solution:**

- Verified primary key index exists
- Added covering index for id lookups

**Expected Improvement:**

- Slightly faster UPDATE operations
- Better query plan stability

---

### 3. Conversations Queries

**Current Performance:**

- Queries filtering by `adult_id`
- Mean Time: 1.4ms (good, but can be improved)

**Solution:**

- Added covering indexes with INCLUDE columns
- Optimized for both `adult_id` and `child_id` lookups

**Expected Improvement:**

- Faster queries with fewer index scans
- Better performance for queries that need multiple columns

---

### 4. Adult Profiles Queries

**Current Performance:**

- Queries filtering by `user_id AND role`
- Mean Time: 1.1ms (good, but can be improved)

**Solution:**

- Added composite covering index for `(user_id, role)`
- Includes commonly accessed columns

**Expected Improvement:**

- Faster composite lookups
- Reduced need for table lookups

---

## Queries That Cannot Be Optimized

### Supabase Internal Functions

These queries are part of Supabase's internal infrastructure and cannot be directly optimized:

1. **`realtime.list_changes`** (98.4% of total query time)

   - Mean Time: 5.5ms ✅ (acceptable)
   - Max Time: 1590ms ⚠️ (concerning spikes)
   - **Recommendation:** Monitor for spikes, consider connection pooling

2. **`realtime.subscription`** (Supabase Realtime)

   - Mean Time: 9.8ms (acceptable)
   - This is a Supabase internal function

3. **Dashboard Metadata Queries**

   - Complex schema introspection queries
   - Infrequent and acceptable performance

4. **PostgREST Internal Queries**
   - Session configuration queries
   - Already optimized (mean time: 0.17ms)

---

## Implementation Steps

### Step 1: Run the Optimization Script

```bash
# In Supabase SQL Editor, run:
# optimize_slow_queries.sql
```

### Step 2: Verify Indexes Were Created

```sql
-- Check indexes
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('calls', 'conversations', 'adult_profiles', 'timezone_names_cache')
ORDER BY tablename, indexname;
```

### Step 3: Initial Timezone Cache Population

The materialized view will be populated automatically when created. Verify it:

```sql
SELECT COUNT(*) FROM public.timezone_names_cache;
-- Should return ~600+ timezone names
```

### Step 4: Update Application Code

Ensure your application uses the cached function:

```typescript
// Use the cached function instead of direct queries
const { data } = await supabase.rpc("get_timezone_names");
```

---

## Maintenance Schedule

### Weekly

- Run `ANALYZE` on frequently updated tables:
  ```sql
  ANALYZE public.calls;
  ANALYZE public.conversations;
  ANALYZE public.messages;
  ```

### Monthly

- Refresh timezone cache:
  ```sql
  SELECT public.refresh_timezone_cache();
  ```

### As Needed

- Monitor query performance in Supabase dashboard
- Watch for queries with high `max_time` relative to `mean_time`
- Review index usage statistics

---

## Expected Performance Improvements

| Query Type                     | Before          | After            | Improvement      |
| ------------------------------ | --------------- | ---------------- | ---------------- |
| `pg_timezone_names`            | 477ms, 0% cache | <1ms, 100% cache | **99.8% faster** |
| Conversations (adult_id)       | 1.4ms           | <1ms             | ~30% faster      |
| Adult Profiles (user_id, role) | 1.1ms           | <0.8ms           | ~30% faster      |
| Calls UPDATE                   | 1.4ms           | <1ms             | ~30% faster      |

---

## Monitoring

### Key Metrics to Watch

1. **Cache Hit Rates**

   - `timezone_names_cache`: Should be 100%
   - Other queries: Should remain high (95%+)

2. **Query Times**

   - Mean time should decrease for optimized queries
   - Max time spikes should be investigated

3. **Index Usage**
   - Monitor index usage statistics
   - Remove unused indexes if any

### Supabase Dashboard Queries

Monitor these queries in the Supabase dashboard:

- `pg_timezone_names` - Should disappear or be very fast
- `conversations` queries - Should be faster
- `adult_profiles` queries - Should be faster
- `calls` UPDATE queries - Should be faster

---

## Troubleshooting

### Timezone Cache Not Working

If timezone queries are still slow:

1. Verify materialized view exists:

   ```sql
   SELECT * FROM pg_matviews WHERE matviewname = 'timezone_names_cache';
   ```

2. Check if function is using the view:

   ```sql
   SELECT pg_get_functiondef('public.get_timezone_names()'::regproc);
   ```

3. Refresh the cache:
   ```sql
   SELECT public.refresh_timezone_cache();
   ```

### Indexes Not Being Used

If queries aren't using the new indexes:

1. Check index exists:

   ```sql
   SELECT * FROM pg_indexes WHERE indexname LIKE 'idx_%';
   ```

2. Update statistics:

   ```sql
   ANALYZE <table_name>;
   ```

3. Check query plan:
   ```sql
   EXPLAIN ANALYZE <your_query>;
   ```

---

## Notes

- Many slow queries are Supabase internal functions that cannot be optimized
- Focus optimizations on application queries where possible
- Monitor performance after implementing changes
- Adjust indexes based on actual query patterns

---

## References

- [Supabase Performance Analysis](./docs/SUPABASE_PERFORMANCE_ANALYSIS.md)
- [Optimization Implementation Guide](./docs/SUPABASE_OPTIMIZATION_IMPLEMENTATION.md)
- [PostgreSQL Index Documentation](https://www.postgresql.org/docs/current/indexes.html)
- [Materialized Views Documentation](https://www.postgresql.org/docs/current/sql-creatematerializedview.html)

# Index Redundancy Analysis

## Overview

Your tables have many indexes, which is good for query performance, but some may be redundant. This document helps identify which indexes can potentially be removed.

## Current Index Count

Based on your index list:

- **adult_profiles**: 9 indexes
- **calls**: 15 indexes  
- **conversations**: 12 indexes
- **timezone_names_cache**: 1 index

## Potential Redundancy Areas

### 1. adult_profiles Table

**Indexes:**
- `idx_adult_profiles_user_role_covering` ✅ (NEW - optimization)
- `idx_adult_profiles_user_id` 
- `idx_adult_profiles_family_id`
- `idx_adult_profiles_role`
- `idx_adult_profiles_user_family` (composite: user_id, family_id)
- `idx_adult_profiles_user_family_role` (composite: user_id, family_id, role)
- `adult_profiles_user_id_family_id_role_key` (unique constraint)

**Analysis:**
- The new `idx_adult_profiles_user_role_covering` covers `(user_id, role)` queries
- `idx_adult_profiles_user_family_role` covers `(user_id, family_id, role)` queries
- **Potential redundancy:** `idx_adult_profiles_user_id` might be redundant if queries always include `role` or `family_id`

**Recommendation:**
- Keep the covering index (optimization)
- Monitor usage of `idx_adult_profiles_user_id` - if rarely used alone, consider removing
- Keep composite indexes as they serve different query patterns

### 2. conversations Table

**Indexes:**
- `idx_conversations_adult_id_covering` ✅ (NEW - optimization)
- `idx_conversations_child_id_covering` ✅ (NEW - optimization)
- `idx_conversations_adult_id`
- `idx_conversations_child_id`
- `idx_conversations_adult_child` (composite)
- `conversations_unique_adult_child` (unique constraint)

**Analysis:**
- The new covering indexes include commonly accessed columns
- `idx_conversations_adult_id` might be redundant if the covering index is used
- `idx_conversations_child_id` might be redundant if the covering index is used

**Recommendation:**
- **Monitor index usage** - If covering indexes are used, the simple indexes can be removed
- Keep composite index `idx_conversations_adult_child` for unique constraint lookups
- Keep unique constraint index

### 3. calls Table

**Indexes:**
- `idx_calls_id_active` ✅ (NEW - optimization)
- `calls_pkey` (primary key)
- `idx_calls_conversation_id`
- `idx_calls_callee_id`
- `idx_calls_status`
- `idx_calls_ended_at`
- `idx_calls_parent_id`
- `idx_calls_child_id`
- `idx_calls_parent_status` (composite)
- `idx_calls_child_status` (composite)
- `idx_calls_missed_unread`
- `idx_calls_conversation_created` (composite)
- `idx_calls_created_at`
- `idx_calls_family_member_id`

**Analysis:**
- `idx_calls_id_active` might be redundant with `calls_pkey` (primary key)
- Many indexes serve different query patterns (status, dates, relationships)
- Composite indexes are likely needed for specific query patterns

**Recommendation:**
- **Remove `idx_calls_id_active`** - Primary key already covers `id` lookups
- Keep other indexes as they serve different query patterns
- Monitor usage to identify any other redundancies

## Index Usage Monitoring

### Check Index Usage

Run this query after a week of normal usage to see which indexes are actually being used:

```sql
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan as times_used,
    CASE 
        WHEN idx_scan = 0 THEN '⚠️ UNUSED - Consider removing'
        WHEN idx_scan < 100 THEN '⚠️ RARELY USED - Monitor'
        ELSE '✅ ACTIVE'
    END as status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND relname IN ('adult_profiles', 'conversations', 'calls')
ORDER BY relname, idx_scan DESC NULLS LAST;
```

### Safe Index Removal Process

1. **Monitor for 1-2 weeks** to see actual usage
2. **Identify unused indexes** (idx_scan = 0 or very low)
3. **Verify with EXPLAIN** - Check if queries would still use indexes
4. **Remove one at a time** - Test after each removal
5. **Monitor performance** - Ensure no degradation

## Recommended Actions

### Immediate (Safe)

1. ✅ **Keep all optimization indexes** - They're new and needed
2. ⚠️ **Monitor `idx_calls_id_active`** - Likely redundant with primary key

### After 1-2 Weeks of Monitoring

1. **Check index usage statistics** using the query above
2. **Remove unused indexes** if confirmed safe
3. **Consider removing redundant simple indexes** if covering indexes are used

### Index Removal Script (Use After Verification)

```sql
-- Example: Remove redundant index (ONLY after confirming it's unused)
-- DROP INDEX IF EXISTS public.idx_calls_id_active;

-- Always verify with EXPLAIN first:
-- EXPLAIN ANALYZE SELECT * FROM calls WHERE id = 'some-uuid';
```

## Benefits of Removing Redundant Indexes

1. **Faster INSERT/UPDATE/DELETE** - Fewer indexes to maintain
2. **Reduced storage** - Less disk space
3. **Faster VACUUM** - Less work for maintenance
4. **Better query planning** - Fewer index options to consider

## Notes

- **Don't remove indexes without monitoring first**
- **Covering indexes are generally better** - They include commonly accessed columns
- **Composite indexes can serve multiple query patterns**
- **Primary keys and unique constraints are always needed**
- **When in doubt, keep the index** - Storage is cheaper than slow queries

## Next Steps

1. Run `verify_optimization_indexes.sql` to check current state
2. Monitor index usage for 1-2 weeks
3. Review usage statistics
4. Remove only confirmed unused/redundant indexes
5. Test performance after each removal


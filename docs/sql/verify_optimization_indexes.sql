-- =====================================================
-- Verification Script: Check Optimization Indexes
-- Purpose: Verify all optimization indexes exist and check for redundancy
-- Date: 2025-01-21
-- =====================================================

-- =====================================================
-- STEP 1: Verify Critical Optimization Indexes
-- =====================================================

SELECT 
    '✅ OPTIMIZATION INDEXES' as section,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    -- Timezone cache index
    indexname = 'idx_timezone_names_cache_name'
    -- Adult profiles covering index
    OR indexname = 'idx_adult_profiles_user_role_covering'
    -- Conversations covering indexes
    OR indexname = 'idx_conversations_adult_id_covering'
    OR indexname = 'idx_conversations_child_id_covering'
    -- Calls optimization index
    OR indexname = 'idx_calls_id_active'
  )
ORDER BY tablename, indexname;

-- =====================================================
-- STEP 2: Check for Index Redundancy
-- =====================================================
-- Some tables have multiple indexes on similar columns
-- This section helps identify potential redundancy

SELECT 
    '⚠️ POTENTIAL REDUNDANCY' as section,
    tablename,
    array_agg(indexname ORDER BY indexname) as indexes,
    COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('adult_profiles', 'conversations', 'calls')
GROUP BY tablename
HAVING COUNT(*) > 5  -- Tables with many indexes
ORDER BY index_count DESC;

-- =====================================================
-- STEP 3: Check Index Usage Statistics
-- =====================================================
-- This shows which indexes are actually being used
-- Run this after some time to see index usage

SELECT 
    '📊 INDEX USAGE STATISTICS' as section,
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    CASE 
        WHEN idx_scan = 0 THEN '⚠️ UNUSED'
        WHEN idx_scan < 100 THEN '⚠️ RARELY USED'
        ELSE '✅ ACTIVE'
    END as status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND relname IN ('adult_profiles', 'conversations', 'calls', 'timezone_names_cache')
ORDER BY 
    relname,
    idx_scan DESC NULLS LAST;

-- =====================================================
-- STEP 4: Check Materialized View
-- =====================================================

SELECT 
    '✅ MATERIALIZED VIEW' as section,
    schemaname,
    matviewname,
    hasindexes,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname = 'timezone_names_cache';

-- Check row count
SELECT 
    '✅ TIMEZONE CACHE DATA' as section,
    COUNT(*) as timezone_count,
    MIN(name) as first_timezone,
    MAX(name) as last_timezone
FROM public.timezone_names_cache;

-- =====================================================
-- STEP 5: Check Function Definition
-- =====================================================

SELECT 
    '✅ TIMEZONE FUNCTION' as section,
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'get_timezone_names'
  AND pronamespace = 'public'::regnamespace;

-- =====================================================
-- SUMMARY
-- =====================================================

SELECT 
    '📋 SUMMARY' as section,
    'Total Optimization Indexes' as metric,
    COUNT(*)::text as value
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname = 'idx_timezone_names_cache_name'
    OR indexname = 'idx_adult_profiles_user_role_covering'
    OR indexname = 'idx_conversations_adult_id_covering'
    OR indexname = 'idx_conversations_child_id_covering'
    OR indexname = 'idx_calls_id_active'
  )

UNION ALL

SELECT 
    '📋 SUMMARY',
    'Materialized View Exists',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_matviews 
            WHERE schemaname = 'public' 
            AND matviewname = 'timezone_names_cache'
        ) THEN '✅ YES'
        ELSE '❌ NO'
    END

UNION ALL

SELECT 
    '📋 SUMMARY',
    'Timezone Cache Rows',
    COUNT(*)::text
FROM public.timezone_names_cache;


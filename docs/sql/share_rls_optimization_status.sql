-- Quick Status Query: Share Results
-- Run this and share the results
-- This returns a simple summary you can copy/paste

-- =====================================================
-- SUMMARY RESULTS (Share this section)
-- =====================================================

SELECT 
    'SUMMARY' as section,
    'Total Policies' as metric,
    COUNT(*)::text as value
FROM pg_policies
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'SUMMARY',
    'Optimized Policies',
    COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    -- PostgreSQL normalizes (select auth.uid()) to ( SELECT auth.uid() AS uid)
    COALESCE(qual::text, '') LIKE '%SELECT auth.uid()%'
    OR COALESCE(qual::text, '') LIKE '%select auth.uid()%'
    OR COALESCE(with_check::text, '') LIKE '%SELECT auth.uid()%'
    OR COALESCE(with_check::text, '') LIKE '%select auth.uid()%'
    OR (COALESCE(qual::text, '') NOT LIKE '%auth.uid()%' 
        AND COALESCE(with_check::text, '') NOT LIKE '%auth.uid()%')
  )

UNION ALL

SELECT 
    'SUMMARY',
    'Unoptimized Policies',
    COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    -- Check for unoptimized: auth.uid() without SELECT wrapper
    -- Note: PostgreSQL normalizes (select auth.uid()) to ( SELECT auth.uid() AS uid)
    (COALESCE(qual::text, '') LIKE '%auth.uid()%' 
     AND COALESCE(qual::text, '') NOT LIKE '%SELECT auth.uid()%'
     AND COALESCE(qual::text, '') NOT LIKE '%select auth.uid()%')
    OR
    (COALESCE(with_check::text, '') LIKE '%auth.uid()%' 
     AND COALESCE(with_check::text, '') NOT LIKE '%SELECT auth.uid()%'
     AND COALESCE(with_check::text, '') NOT LIKE '%select auth.uid()%')
  )

UNION ALL

SELECT 
    'SUMMARY',
    'Tables with Multiple Permissive Policies',
    COUNT(DISTINCT tablename)::text
FROM (
    SELECT 
        tablename,
        cmd,
        roles,
        COUNT(*) as policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
    GROUP BY tablename, cmd, roles
    HAVING COUNT(*) > 1
) multiple_policies

ORDER BY section, metric;

-- =====================================================
-- DETAILED ISSUES (If any exist, share these too)
-- =====================================================

-- Unoptimized policies list
-- Note: PostgreSQL normalizes (select auth.uid()) to ( SELECT auth.uid() AS uid)
-- So we check for the subquery pattern, not the exact string
SELECT 
    'ISSUES' as section,
    'Unoptimized Policy' as metric,
    tablename || '.' || policyname || ' (' || cmd || ')' as value
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    -- Check for unoptimized: auth.uid() without SELECT wrapper
    (COALESCE(qual::text, '') LIKE '%auth.uid()%' 
     AND COALESCE(qual::text, '') NOT LIKE '%SELECT auth.uid()%'
     AND COALESCE(qual::text, '') NOT LIKE '%select auth.uid()%')
    OR
    (COALESCE(with_check::text, '') LIKE '%auth.uid()%' 
     AND COALESCE(with_check::text, '') NOT LIKE '%SELECT auth.uid()%'
     AND COALESCE(with_check::text, '') NOT LIKE '%select auth.uid()%')
  )
ORDER BY tablename, policyname;

-- Multiple permissive policies list
SELECT 
    'ISSUES' as section,
    'Multiple Permissive Policies' as metric,
    tablename || ' (' || cmd || ' for ' || array_to_string(roles, ', ') || ')' as value
FROM (
    SELECT 
        tablename,
        cmd,
        roles,
        COUNT(*) as policy_count,
        array_agg(policyname ORDER BY policyname) as policy_names
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
    GROUP BY tablename, cmd, roles
    HAVING COUNT(*) > 1
) multiple_policies
ORDER BY tablename, cmd;


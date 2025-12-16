-- Verification Script: Check RLS Performance Optimizations
-- Purpose: Verify that auth.uid() optimizations and policy consolidations have been applied
-- Date: 2025-01-20
-- Run this in Supabase SQL Editor to check implementation status

-- =====================================================
-- STEP 1: Check if policies use optimized (select auth.uid()) pattern
-- =====================================================
-- This query finds policies that still use unoptimized auth.uid() calls

SELECT 
    '❌ Unoptimized auth.uid() Usage' as check_type,
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN COALESCE(qual::text, '') LIKE '%auth.uid()%' 
             AND COALESCE(qual::text, '') NOT LIKE '%SELECT auth.uid()%'
             AND COALESCE(qual::text, '') NOT LIKE '%select auth.uid()%' THEN 'USING clause'
        WHEN COALESCE(with_check::text, '') LIKE '%auth.uid()%' 
             AND COALESCE(with_check::text, '') NOT LIKE '%SELECT auth.uid()%'
             AND COALESCE(with_check::text, '') NOT LIKE '%select auth.uid()%' THEN 'WITH CHECK clause'
        ELSE 'Both'
    END as issue_location,
    LEFT(COALESCE(qual::text, ''), 200) as policy_preview
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
ORDER BY tablename, policyname;

-- =====================================================
-- STEP 2: Check if policies use optimized pattern
-- =====================================================
-- Count policies that ARE optimized

SELECT 
    '✅ Optimized Policies Count' as check_type,
    COUNT(*) as optimized_policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    -- Check for optimized: uses SELECT auth.uid() (PostgreSQL normalizes to SELECT auth.uid() AS uid)
    COALESCE(qual::text, '') LIKE '%SELECT auth.uid()%'
    OR COALESCE(qual::text, '') LIKE '%select auth.uid()%'
    OR COALESCE(with_check::text, '') LIKE '%SELECT auth.uid()%'
    OR COALESCE(with_check::text, '') LIKE '%select auth.uid()%'
    OR (COALESCE(qual::text, '') NOT LIKE '%auth.uid()%' 
        AND COALESCE(with_check::text, '') NOT LIKE '%auth.uid()%')
  );

-- =====================================================
-- STEP 3: Check for multiple permissive policies (should be consolidated)
-- =====================================================
-- Find tables with multiple permissive policies for same role/action

WITH policy_counts AS (
    SELECT 
        schemaname,
        tablename,
        cmd,
        roles,
        COUNT(*) as policy_count,
        array_agg(policyname ORDER BY policyname) as policy_names
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
    GROUP BY schemaname, tablename, cmd, roles
    HAVING COUNT(*) > 1
)
SELECT 
    '⚠️ Multiple Permissive Policies' as check_type,
    tablename,
    cmd as action,
    roles,
    policy_count,
    policy_names
FROM policy_counts
ORDER BY tablename, cmd, roles;

-- =====================================================
-- STEP 4: Check specific tables mentioned in linter output
-- =====================================================
-- Verify key tables have optimized policies

SELECT 
    '📊 Key Tables Status' as check_type,
    tablename,
    COUNT(*) as total_policies,
    COUNT(CASE WHEN COALESCE(qual::text, '') LIKE '%SELECT auth.uid()%' 
                OR COALESCE(qual::text, '') LIKE '%select auth.uid()%'
                OR COALESCE(with_check::text, '') LIKE '%SELECT auth.uid()%'
                OR COALESCE(with_check::text, '') LIKE '%select auth.uid()%'
                OR (COALESCE(qual::text, '') NOT LIKE '%auth.uid()%' 
                    AND COALESCE(with_check::text, '') NOT LIKE '%auth.uid()%') 
           END) as optimized_policies,
    COUNT(CASE WHEN (COALESCE(qual::text, '') LIKE '%auth.uid()%' 
                AND COALESCE(qual::text, '') NOT LIKE '%SELECT auth.uid()%'
                AND COALESCE(qual::text, '') NOT LIKE '%select auth.uid()%')
                OR (COALESCE(with_check::text, '') LIKE '%auth.uid()%' 
                AND COALESCE(with_check::text, '') NOT LIKE '%SELECT auth.uid()%'
                AND COALESCE(with_check::text, '') NOT LIKE '%select auth.uid()%')
           END) as unoptimized_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'conversations', 'profiles', 'families', 'family_members', 
    'parents', 'calls', 'messages', 'reports', 'blocked_contacts',
    'devices', 'family_feature_flags', 'stripe_checkout_sessions',
    'children', 'child_family_memberships', 'child_connections',
    'adult_profiles', 'child_profiles', 'conversation_participants'
  )
GROUP BY tablename
ORDER BY tablename;

-- =====================================================
-- STEP 5: Check for specific policies that should exist
-- =====================================================
-- Verify that key optimized policies exist

SELECT 
    '✅ Key Policies Status' as check_type,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN COALESCE(qual::text, '') LIKE '%SELECT auth.uid()%' 
             OR COALESCE(qual::text, '') LIKE '%select auth.uid()%'
             OR COALESCE(with_check::text, '') LIKE '%SELECT auth.uid()%'
             OR COALESCE(with_check::text, '') LIKE '%select auth.uid()%' THEN '✅ Optimized'
        WHEN COALESCE(qual::text, '') LIKE '%auth.uid()%' 
             OR COALESCE(with_check::text, '') LIKE '%auth.uid()%' THEN '❌ Not Optimized'
        ELSE '✅ No auth.uid() (OK)'
    END as optimization_status
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (tablename = 'conversations' AND policyname LIKE '%view%conversations%')
    OR (tablename = 'messages' AND policyname LIKE '%readable%participants%')
    OR (tablename = 'calls' AND policyname LIKE '%readable%participants%')
    OR (tablename = 'adult_profiles' AND policyname LIKE '%view%profile%')
    OR (tablename = 'children' AND policyname LIKE '%view%children%')
  )
ORDER BY tablename, policyname;

-- =====================================================
-- STEP 6: Summary Report
-- =====================================================
-- Overall status of optimizations

SELECT 
    '📋 SUMMARY REPORT' as report_section,
    '' as details;

SELECT 
    'Total Policies Checked' as metric,
    COUNT(*)::text as value
FROM pg_policies
WHERE schemaname = 'public';

SELECT 
    'Optimized Policies' as metric,
    COUNT(*)::text as value
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    COALESCE(qual::text, '') LIKE '%SELECT auth.uid()%'
    OR COALESCE(qual::text, '') LIKE '%select auth.uid()%'
    OR COALESCE(with_check::text, '') LIKE '%SELECT auth.uid()%'
    OR COALESCE(with_check::text, '') LIKE '%select auth.uid()%'
    OR (COALESCE(qual::text, '') NOT LIKE '%auth.uid()%' 
        AND COALESCE(with_check::text, '') NOT LIKE '%auth.uid()%')
  );

SELECT 
    'Unoptimized Policies' as metric,
    COUNT(*)::text as value
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (COALESCE(qual::text, '') LIKE '%auth.uid()%' 
     AND COALESCE(qual::text, '') NOT LIKE '%SELECT auth.uid()%'
     AND COALESCE(qual::text, '') NOT LIKE '%select auth.uid()%')
    OR
    (COALESCE(with_check::text, '') LIKE '%auth.uid()%' 
     AND COALESCE(with_check::text, '') NOT LIKE '%SELECT auth.uid()%'
     AND COALESCE(with_check::text, '') NOT LIKE '%select auth.uid()%')
  );

SELECT 
    'Tables with Multiple Permissive Policies' as metric,
    COUNT(DISTINCT tablename)::text as value
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
) multiple_policies;

-- =====================================================
-- STEP 7: Check if consolidation migrations were applied
-- =====================================================
-- Look for consolidated policy names

SELECT 
    '🔍 Consolidated Policies Check' as check_type,
    tablename,
    policyname,
    CASE 
        WHEN policyname LIKE '%and%' OR policyname LIKE '%or%' THEN '✅ Likely Consolidated'
        ELSE 'ℹ️ Individual Policy'
    END as consolidation_status
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname LIKE '%and%'
    OR policyname LIKE '%or%'
    OR policyname LIKE '%own profile and%'
    OR policyname LIKE '%parents and family%'
  )
ORDER BY tablename, policyname;

-- =====================================================
-- STEP 8: Detailed policy analysis for critical tables
-- =====================================================
-- Show detailed policy information for tables with most issues

SELECT 
    '🔍 Detailed Policy Analysis' as check_type,
    tablename,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN COALESCE(qual::text, '') LIKE '%SELECT auth.uid()%' 
             OR COALESCE(qual::text, '') LIKE '%select auth.uid()%'
             OR COALESCE(with_check::text, '') LIKE '%SELECT auth.uid()%'
             OR COALESCE(with_check::text, '') LIKE '%select auth.uid()%' THEN '✅ Optimized'
        WHEN COALESCE(qual::text, '') LIKE '%auth.uid()%' 
             OR COALESCE(with_check::text, '') LIKE '%auth.uid()%' THEN '❌ Needs Optimization'
        ELSE '✅ No auth.uid()'
    END as status,
    LEFT(COALESCE(qual::text, with_check::text, ''), 150) as policy_snippet
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('calls', 'messages', 'conversations', 'adult_profiles', 'children')
ORDER BY tablename, cmd, policyname;

-- =====================================================
-- Instructions
-- =====================================================
-- 
-- INTERPRETATION GUIDE:
-- 
-- ✅ If Step 1 returns NO ROWS: All policies are optimized!
-- ❌ If Step 1 returns rows: Those policies need optimization
-- 
-- ✅ If Step 3 returns NO ROWS: All multiple policies consolidated!
-- ⚠️ If Step 3 returns rows: Some policies could still be consolidated
-- 
-- ✅ Step 4 shows per-table status - look for 0 unoptimized_policies
-- ✅ Step 5 shows key policies - all should show "✅ Optimized"
-- 
-- The SUMMARY REPORT (Step 6) gives you the overall status:
-- - If "Unoptimized Policies" = 0, you're good!
-- - If "Tables with Multiple Permissive Policies" = 0, consolidation is complete!
--
-- =====================================================


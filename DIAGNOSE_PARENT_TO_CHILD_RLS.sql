-- DIAGNOSE_PARENT_TO_CHILD_RLS.sql
-- Comprehensive diagnostic for parent-to-child call RLS issues
-- Run this in Supabase SQL Editor to check why parent can't read child's answer
-- If issues are found, run FIX_RLS_POLICIES_MANUAL.sql

-- ============================================
-- STEP 1: Check if verification function exists (optional)
-- ============================================
SELECT 
    'Verification Function Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' 
            AND p.proname = 'verify_call_rls_policies'
        ) THEN '✅ Function exists - you can use it'
        ELSE 'ℹ️ Function missing - use CHECK_RLS_POLICIES_NOW.sql instead'
    END as status;

-- ============================================
-- STEP 2: Run verification (if function exists)
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'verify_call_rls_policies'
    ) THEN
        RAISE NOTICE 'Verification function exists. Results:';
    ELSE
        RAISE NOTICE 'Verification function does not exist. Using direct policy check instead.';
    END IF;
END $$;

-- Try to run verification if it exists, otherwise skip
DO $$
BEGIN
    EXECUTE 'SELECT * FROM public.verify_call_rls_policies()';
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'Verification function not available - using direct checks below';
END $$;

-- ============================================
-- STEP 3: Check current policies in detail
-- ============================================
SELECT 
    'Current Policies Detail' as check_type,
    policyname,
    cmd as command,
    roles::text as roles,
    CASE 
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '❌ MISSING WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check IS NOT NULL THEN '✅ Has WITH CHECK'
        ELSE '✅ OK'
    END as insert_status,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY 
  CASE 
    WHEN policyname LIKE 'Children%' THEN 1
    WHEN policyname LIKE 'Parents%' THEN 2
    ELSE 3
  END,
  policyname,
  cmd;

-- ============================================
-- STEP 4: Check if children table has anon read policy
-- ============================================
-- CRITICAL: Parent SELECT policy uses EXISTS subquery on children table
-- If children table doesn't allow anon reads, the EXISTS will fail silently
SELECT 
    'Children Table Anon Policy' as check_type,
    policyname,
    cmd as command,
    roles::text as roles,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'children'
            AND roles::text LIKE '%anon%'
            AND cmd = 'SELECT'
        ) THEN '✅ Anon SELECT policy exists'
        ELSE '❌ MISSING - This will break parent SELECT policy!'
    END as status
FROM pg_policies
WHERE tablename = 'children'
AND roles::text LIKE '%anon%'
AND cmd = 'SELECT';

-- ============================================
-- STEP 5: Test parent SELECT policy directly
-- ============================================
-- This simulates what happens when parent tries to read a call
-- Replace 'YOUR_PARENT_USER_ID' with an actual parent user ID for testing
SELECT 
    'Parent SELECT Policy Test' as check_type,
    'Run this with an actual parent user ID to test' as note,
    'SELECT * FROM calls WHERE parent_id = auth.uid() AND id = ''CALL_ID''' as test_query;

-- ============================================
-- STEP 6: Check for common issues
-- ============================================
SELECT 
    'Common Issues Check' as check_type,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'children'
            AND roles::text LIKE '%anon%'
            AND cmd = 'SELECT'
        ) THEN '❌ CRITICAL: Children table missing anon SELECT policy'
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'calls'
            AND policyname = 'Parents can view calls for their children'
        ) THEN '❌ CRITICAL: Parent SELECT policy missing'
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'calls'
            AND policyname = 'Parents can view calls for their children'
            AND qual IS NULL
        ) THEN '❌ CRITICAL: Parent SELECT policy has no USING clause'
        ELSE '✅ No obvious issues found'
    END as issue_status;


-- Diagnostic SQL: Inspect RLS Policies on children table
-- Purpose: Verify policies and identify why parents can't see their children
-- Run this in Supabase SQL Editor

-- =====================================================
-- STEP 1: Check if RLS is enabled on children table
-- =====================================================
SELECT 
    'RLS Status' as check_type,
    relname as table_name,
    relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'children' 
  AND relnamespace = 'public'::regnamespace;

-- =====================================================
-- STEP 2: List all RLS policies on children table
-- =====================================================
SELECT 
    'Policy List' as check_type,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
ORDER BY cmd, policyname;

-- =====================================================
-- STEP 3: Check if parent user exists and has children
-- =====================================================
-- Replace with actual parent_id from your investigation
-- parent_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'
SELECT 
    'Parent Children Count' as check_type,
    COUNT(*) as child_count,
    array_agg(id ORDER BY created_at) as child_ids,
    array_agg(name ORDER BY created_at) as child_names
FROM public.children
WHERE parent_id = '70888a10-ad5e-4764-8dff-537ad2da34d1';

-- =====================================================
-- STEP 4: Test policy evaluation (simulate auth.uid())
-- =====================================================
-- This shows what the policy would evaluate to
-- Note: This is a simulation - actual RLS uses auth.uid() from JWT
SELECT 
    'Policy Simulation' as check_type,
    id as child_id,
    name,
    parent_id,
    CASE 
        WHEN parent_id = '70888a10-ad5e-4764-8dff-537ad2da34d1' THEN 'ALLOWED'
        ELSE 'BLOCKED'
    END as policy_result
FROM public.children
WHERE parent_id = '70888a10-ad5e-4764-8dff-537ad2da34d1';

-- =====================================================
-- STEP 5: Check for conflicting policies
-- =====================================================
-- Look for policies that might be too restrictive or conflict
SELECT 
    'Policy Conflicts' as check_type,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NULL OR qual = '' THEN 'NO USING CLAUSE - POTENTIALLY PERMISSIVE'
        WHEN qual LIKE '%true%' THEN 'ALWAYS TRUE - PERMISSIVE'
        WHEN qual LIKE '%auth.uid()%' THEN 'USES AUTH.UID() - GOOD'
        ELSE 'OTHER'
    END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
  AND cmd = 'SELECT';

-- =====================================================
-- STEP 6: Verify auth.uid() function exists and works
-- =====================================================
-- This should return the current authenticated user's ID
-- If NULL, the user is not authenticated
SELECT 
    'Auth Check' as check_type,
    auth.uid() as current_user_id,
    CASE 
        WHEN auth.uid() IS NULL THEN 'NOT AUTHENTICATED'
        WHEN auth.uid() = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid THEN 'MATCHES PARENT ID'
        ELSE 'DIFFERENT USER'
    END as auth_status;


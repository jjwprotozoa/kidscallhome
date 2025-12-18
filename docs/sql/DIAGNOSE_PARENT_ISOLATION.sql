-- Diagnostic Query: Parent Children Isolation
-- Purpose: Help diagnose why parents might see other parents' children
-- Run this as an authenticated parent user in Supabase SQL Editor

-- =====================================================
-- STEP 1: Check current user and their parent record
-- =====================================================
SELECT 
    'Current User Info' as section,
    auth.uid() as user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as user_email,
    (SELECT id FROM public.parents WHERE id = auth.uid()) as parent_record_id,
    (SELECT name FROM public.parents WHERE id = auth.uid()) as parent_name;

-- =====================================================
-- STEP 2: Count children visible through RLS
-- =====================================================
-- This query respects RLS policies - should only show your own children
SELECT 
    'Children Visible Through RLS' as section,
    COUNT(*) as total_visible_children,
    COUNT(DISTINCT parent_id) as distinct_parent_ids,
    array_agg(DISTINCT parent_id) as parent_ids_visible
FROM public.children;

-- =====================================================
-- STEP 3: Show all children visible (with parent info if accessible)
-- =====================================================
-- This should only show your own children
SELECT 
    'Children Details' as section,
    c.id,
    c.name,
    c.parent_id,
    c.login_code,
    c.created_at,
    -- Try to get parent email (should only work for your own children)
    (SELECT email FROM public.parents WHERE id = c.parent_id) as parent_email,
    -- Check if this child belongs to current user
    CASE 
        WHEN c.parent_id = auth.uid() THEN 'OWN CHILD ✓'
        ELSE 'OTHER PARENT CHILD ⚠️ SECURITY ISSUE'
    END as ownership_status
FROM public.children c
ORDER BY c.created_at DESC;

-- =====================================================
-- STEP 4: Check if you're also a family member
-- =====================================================
-- This could explain seeing other children if you're a family member
SELECT 
    'Family Member Status' as section,
    COUNT(*) as family_member_records,
    array_agg(DISTINCT parent_id) as family_parent_ids
FROM public.family_members
WHERE id = auth.uid()
AND status = 'active';

-- =====================================================
-- STEP 5: Verify RLS policies are active
-- =====================================================
SELECT 
    'RLS Policy Status' as section,
    policyname,
    cmd as command,
    roles,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- =====================================================
-- STEP 6: Check if RLS is enabled
-- =====================================================
SELECT 
    'RLS Enabled Check' as section,
    relname as table_name,
    relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'children'
AND relnamespace = 'public'::regnamespace;

-- =====================================================
-- INTERPRETATION GUIDE
-- =====================================================
-- 
-- Expected Results:
-- 1. "Children Visible Through RLS" should show:
--    - total_visible_children = number of YOUR children only
--    - distinct_parent_ids = 1 (only your parent_id)
--    - parent_ids_visible = array containing only your auth.uid()
--
-- 2. "Children Details" should show:
--    - Only rows where ownership_status = 'OWN CHILD ✓'
--    - No rows with 'OTHER PARENT CHILD ⚠️ SECURITY ISSUE'
--
-- 3. "Family Member Status" should show:
--    - If you're a parent, this should be 0 (you shouldn't be a family member)
--    - If you ARE a family member, that explains seeing other children
--
-- If you see other parents' children:
-- 1. Check if you're also a family member (Step 4)
-- 2. Verify RLS is enabled (Step 6)
-- 3. Check that policies are correct (Step 5)
-- 4. Try refreshing your session or logging out/in
--
-- If issues persist:
-- 1. Run migration: 20251205000000_fix_parent_children_isolation.sql
-- 2. Run migration: 20251205000001_tighten_children_policies_and_test.sql
-- 3. Run test function: SELECT * FROM test_parent_children_isolation();















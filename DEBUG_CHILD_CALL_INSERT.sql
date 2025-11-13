-- DEBUG_CHILD_CALL_INSERT.sql
-- Debug why child call insert is failing
-- Run this to test the policy directly

-- ============================================
-- STEP 1: Get a real child_id and parent_id to test
-- ============================================
SELECT 
    'Test Data' as info,
    id as child_id,
    parent_id,
    name,
    login_code
FROM children
LIMIT 1;

-- ============================================
-- STEP 2: Test if anon can read from children table
-- ============================================
-- This should work if the policy is correct
-- Replace <child_id> with actual value from above

-- First, let's see what anon can actually see:
-- (Run this in Supabase SQL Editor as anon role, or use the REST API)

-- ============================================
-- STEP 3: Check the exact policy expression
-- ============================================
SELECT 
    'Current INSERT Policy' as info,
    policyname,
    cmd,
    roles::text,
    with_check as policy_expression
FROM pg_policies
WHERE tablename = 'calls'
  AND cmd = 'INSERT'
  AND roles::text LIKE '%anon%';

-- ============================================
-- STEP 4: Test the EXISTS subquery manually
-- ============================================
-- Replace <child_id> and <parent_id> with actual values
-- This will show if the EXISTS check would pass

-- SELECT 
--     'Testing EXISTS check' as info,
--     EXISTS (
--         SELECT 1 FROM public.children
--         WHERE children.id = '<child_id>'::uuid
--         AND children.parent_id = '<parent_id>'::uuid
--     ) as exists_check_passes;

-- ============================================
-- STEP 5: Try a simplified policy temporarily
-- ============================================
-- If the above shows the EXISTS check should work, but INSERT still fails,
-- there might be an issue with how the policy is evaluated.
-- Try this simplified version:

-- DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
-- 
-- CREATE POLICY "Children can insert calls they initiate"
-- ON public.calls
-- FOR INSERT
-- TO anon
-- WITH CHECK (
--     caller_type = 'child'
--     -- Temporarily remove the EXISTS check to see if that's the issue
-- );

-- ============================================
-- STEP 6: Check for policy conflicts
-- ============================================
-- Sometimes multiple policies can interfere
SELECT 
    'All INSERT policies on calls' as info,
    policyname,
    roles::text,
    with_check
FROM pg_policies
WHERE tablename = 'calls'
  AND cmd = 'INSERT'
ORDER BY policyname;


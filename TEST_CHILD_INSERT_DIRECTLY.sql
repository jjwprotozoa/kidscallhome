-- TEST_CHILD_INSERT_DIRECTLY.sql
-- Test if we can insert as an anonymous user
-- This helps diagnose if the issue is with the policy or something else

-- ============================================
-- STEP 1: Check current user context
-- ============================================
SELECT 
    'Current Context' as info,
    current_user as current_user,
    session_user as session_user,
    current_setting('request.jwt.claims', true)::json->>'role' as jwt_role;

-- ============================================
-- STEP 2: Try to see what an anonymous user can see
-- ============================================
-- This simulates what an anonymous user (child) would see
-- We need to check if they can read from children table

-- First, get a real child_id and parent_id from your database
SELECT 
    'Sample Child Data' as info,
    id as child_id,
    parent_id,
    name
FROM public.children
LIMIT 1;

-- ============================================
-- STEP 3: Test the subquery that the policy uses
-- ============================================
-- Replace CHILD_ID and PARENT_ID with actual values from step 2
-- This tests if the IN subquery would return the child_id

/*
-- Example (uncomment and replace with real values):
SELECT 
    'Testing Policy Subquery' as test,
    'CHILD_ID_HERE'::uuid as test_child_id,
    'PARENT_ID_HERE'::uuid as test_parent_id,
    CASE 
        WHEN 'CHILD_ID_HERE'::uuid IN (
            SELECT id 
            FROM public.children 
            WHERE parent_id = 'PARENT_ID_HERE'::uuid
        )
        THEN '✅ Child ID found in subquery - policy should allow'
        ELSE '❌ Child ID NOT found in subquery - policy will reject'
    END as subquery_result;
*/

-- ============================================
-- STEP 4: Check if RLS is blocking the children table read
-- ============================================
-- The policy needs to read from children table, but anon might not be able to
SELECT 
    'Children Table Policies for Anon' as info,
    policyname,
    cmd,
    roles::text,
    qual as using_clause
FROM pg_policies
WHERE tablename = 'children'
  AND 'anon' = ANY(roles::text[]);


-- TEST_CHILD_CALL_POLICY.sql
-- Test the child call insert policy directly
-- This will help us see if the policy is working or if there's another issue

-- ============================================
-- STEP 1: Check all call policies for anon role
-- ============================================
SELECT 
    'All Call Policies for anon' as info,
    policyname,
    cmd as command,
    roles::text as roles,
    CASE 
        WHEN cmd = 'INSERT' THEN with_check
        WHEN cmd = 'SELECT' THEN qual
        WHEN cmd = 'UPDATE' THEN 'USING: ' || qual || E'\nWITH CHECK: ' || with_check
    END as policy_expression
FROM pg_policies
WHERE tablename = 'calls'
  AND roles::text LIKE '%anon%'
ORDER BY 
    CASE cmd 
        WHEN 'SELECT' THEN 1 
        WHEN 'INSERT' THEN 2 
        WHEN 'UPDATE' THEN 3 
    END,
    policyname;

-- ============================================
-- STEP 2: Check if there are conflicting policies
-- ============================================
-- Sometimes multiple policies can conflict
SELECT 
    'All Call Policies (check for conflicts)' as info,
    policyname,
    cmd as command,
    roles::text as roles
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY cmd, policyname;

-- ============================================
-- STEP 3: Test the policy with a real child_id
-- ============================================
-- Replace '<child_id>' and '<parent_id>' with actual values from your database
-- This will show if the policy works when executed directly

-- First, get a real child_id and parent_id to test with
SELECT 
    'Test Data - Get a child_id and parent_id' as info,
    id as child_id,
    parent_id,
    name
FROM children
LIMIT 1;

-- Then test the insert (uncomment and use the values from above):
-- 
-- SET LOCAL ROLE anon;
-- 
-- INSERT INTO calls (child_id, parent_id, caller_type, status)
-- VALUES (
--     '<child_id_from_above>',
--     '<parent_id_from_above>',
--     'child',
--     'ringing'
-- );
-- 
-- RESET ROLE;

-- ============================================
-- STEP 4: Check if RLS is actually enabled
-- ============================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'calls'
AND schemaname = 'public';

-- ============================================
-- STEP 5: Verify the children table policy is accessible
-- ============================================
-- Test if anon can actually read from children table
-- (This should work if the policy is correct)

-- SET LOCAL ROLE anon;
-- 
-- SELECT id, parent_id 
-- FROM children 
-- WHERE id = '<child_id_from_above>'
-- LIMIT 1;
-- 
-- RESET ROLE;

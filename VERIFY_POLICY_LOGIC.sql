-- VERIFY_POLICY_LOGIC.sql
-- Shows the FULL with_check clause and tests the policy logic
-- Run this to see exactly what's in the policies

-- ============================================
-- STEP 1: Show full WITH CHECK clauses
-- ============================================
SELECT 
    policyname,
    cmd as command,
    roles::text as roles,
    -- Show the full with_check clause (might be long)
    with_check as full_with_check_clause,
    -- Show length to see if it's complete
    length(with_check::text) as clause_length
FROM pg_policies
WHERE tablename = 'calls'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- ============================================
-- STEP 2: Test if a child can insert (simulate the check)
-- ============================================
-- This will help us understand if the policy logic is correct
-- Replace these UUIDs with actual values from your database if needed

-- First, let's see what children exist
SELECT 
    'Available Children' as info,
    id as child_id,
    parent_id,
    name
FROM public.children
LIMIT 5;

-- ============================================
-- STEP 3: Check if the policy would allow an insert
-- ============================================
-- This simulates what the policy checks
-- Replace the UUIDs with actual values from your children table

/*
-- Example test (uncomment and modify with real UUIDs):
SELECT 
    'Policy Test' as test_type,
    'child'::text as caller_type,
    'YOUR_CHILD_ID_HERE'::uuid as child_id,
    'YOUR_PARENT_ID_HERE'::uuid as parent_id,
    CASE 
        WHEN 'child'::text = 'child'::text 
        AND 'YOUR_CHILD_ID_HERE'::uuid IN (
            SELECT id 
            FROM public.children 
            WHERE parent_id = 'YOUR_PARENT_ID_HERE'::uuid
        )
        THEN '✅ Policy would ALLOW this insert'
        ELSE '❌ Policy would REJECT this insert'
    END as policy_result;
*/

-- ============================================
-- STEP 4: Verify the exact policy definition
-- ============================================
-- Get the complete policy definition from pg_policies
SELECT 
    'Complete Policy Definition' as info,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles::text,
    cmd,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'calls'
  AND cmd = 'INSERT'
ORDER BY policyname;


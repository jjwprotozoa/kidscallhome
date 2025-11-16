-- =====================================================
-- VERIFY POLICY WAS CREATED AND TEST FINAL INSERT
-- =====================================================

-- =====================================================
-- STEP 1: Verify the policy exists and is correct
-- =====================================================
SELECT 
    'Message INSERT Policy Verification' as check_type,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN with_check IS NOT NULL THEN '✅ Has WITH CHECK clause'
        ELSE '❌ Missing WITH CHECK clause'
    END as has_with_check,
    with_check as policy_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
  AND 'anon' = ANY(roles);

-- =====================================================
-- STEP 2: Verify all message policies exist
-- =====================================================
SELECT 
    'All Message Policies' as check_type,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN cmd = 'INSERT' AND 'anon' = ANY(roles) THEN 'Child INSERT'
        WHEN cmd = 'SELECT' AND 'anon' = ANY(roles) THEN 'Child SELECT'
        WHEN cmd = 'INSERT' AND 'authenticated' = ANY(roles) THEN 'Parent INSERT'
        WHEN cmd = 'SELECT' AND 'authenticated' = ANY(roles) THEN 'Parent SELECT'
        ELSE 'Other'
    END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
ORDER BY cmd, policyname;

-- Expected: 4 policies total
-- 1. "Children can send messages" (INSERT, anon)
-- 2. "Children can view their messages" (SELECT, anon)
-- 3. "Parents can send messages" (INSERT, authenticated)
-- 4. "Parents can view messages for their children" (SELECT, authenticated)

-- =====================================================
-- STEP 3: Verify RLS is enabled on messages table
-- =====================================================
SELECT 
    'RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS is enabled'
        ELSE '❌ RLS is NOT enabled'
    END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'messages';

-- =====================================================
-- STEP 4: Final test - simulate the exact policy check
-- =====================================================
-- This simulates what happens when you try to insert
WITH test_row AS (
    SELECT 
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid as child_id,
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid as sender_id,
        'child'::text as sender_type,
        'Test message'::text as content
)
SELECT 
    'Final Policy Check Simulation' as test_name,
    child_id,
    sender_id,
    sender_type,
    -- Simulate the WITH CHECK clause
    CASE 
        WHEN sender_type = 'child'::text 
         AND sender_id = child_id
         AND child_id IN (
            SELECT id 
            FROM public.children
            WHERE id = sender_id
        ) THEN '✅✅✅ POLICY CHECK PASSES - INSERT SHOULD WORK ✅✅✅'
        ELSE '❌❌❌ POLICY CHECK FAILS ❌❌❌'
    END as policy_check_result
FROM test_row;

-- =====================================================
-- STEP 5: Check for any conflicting policies or issues
-- =====================================================
-- Check if there are multiple INSERT policies for anon role
SELECT 
    'Policy Conflict Check' as check_type,
    COUNT(*) as anon_insert_policy_count,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ Correct - One INSERT policy for anon'
        WHEN COUNT(*) = 0 THEN '❌ ERROR - No INSERT policy for anon!'
        ELSE '⚠️ WARNING - Multiple INSERT policies for anon (may cause conflicts)'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
  AND 'anon' = ANY(roles);


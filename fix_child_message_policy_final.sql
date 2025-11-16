-- =====================================================
-- FIX CHILD MESSAGE INSERT POLICY - FINAL VERSION
-- =====================================================
-- Issue: Policy expression may have incorrect column references
-- In WITH CHECK clauses for INSERT, columns should be referenced directly
-- =====================================================

-- =====================================================
-- STEP 1: Drop existing child message INSERT policy
-- =====================================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- =====================================================
-- STEP 2: Recreate with explicit column references
-- =====================================================
-- In WITH CHECK clauses, reference columns directly (child_id, not messages.child_id)
-- The EXISTS subquery can reference the outer table columns directly
CREATE POLICY "Children can send messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child'::text 
    AND sender_id = child_id
    AND EXISTS (
      SELECT 1 
      FROM public.children
      WHERE children.id = child_id
        AND children.id = sender_id
    )
  );

-- =====================================================
-- STEP 3: Verify policy was created correctly
-- =====================================================
SELECT 
    'Child Message INSERT Policy' as check_type,
    policyname,
    cmd as command,
    roles,
    with_check as policy_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
  AND 'anon' = ANY(roles);

-- =====================================================
-- STEP 4: Test the policy logic with your actual UUID
-- =====================================================
-- This simulates exactly what the policy checks
WITH test_insert AS (
    SELECT 
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid as test_sender_id,
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid as test_child_id,
        'child'::text as test_sender_type
)
SELECT 
    'Policy Logic Test' as test_name,
    test_sender_id,
    test_child_id,
    test_sender_type,
    -- Check 1: sender_type
    CASE 
        WHEN test_sender_type = 'child'::text THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as check1_sender_type,
    -- Check 2: sender_id = child_id
    CASE 
        WHEN test_sender_id = test_child_id THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as check2_sender_id_equals_child_id,
    -- Check 3: EXISTS check
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM public.children
            WHERE children.id = test_child_id
              AND children.id = test_sender_id
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as check3_exists,
    -- Final combined check
    CASE 
        WHEN test_sender_type = 'child'::text 
         AND test_sender_id = test_child_id
         AND EXISTS (
            SELECT 1 
            FROM public.children
            WHERE children.id = test_child_id
              AND children.id = test_sender_id
        ) THEN '✅✅✅ ALL CHECKS PASS ✅✅✅'
        ELSE '❌❌❌ SOME CHECK FAILED ❌❌❌'
    END as final_result
FROM test_insert;

-- =====================================================
-- STEP 5: Verify children table policy still exists
-- =====================================================
SELECT 
    'Children Table Policy Check' as check_type,
    policyname,
    cmd,
    roles,
    '✅ Policy exists' as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
  AND policyname = 'Anyone can verify login codes';


-- =====================================================
-- FIX CHILD MESSAGE INSERT USING IN PATTERN
-- =====================================================
-- Based on working calls table pattern: Uses IN instead of EXISTS
-- EXISTS sometimes doesn't work reliably in WITH CHECK clauses
-- =====================================================

-- =====================================================
-- STEP 1: Ensure children table policy exists
-- =====================================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- =====================================================
-- STEP 2: Drop existing child message INSERT policy
-- =====================================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- =====================================================
-- STEP 3: Create policy using IN subquery pattern (like calls table)
-- =====================================================
-- This pattern works reliably in WITH CHECK clauses
-- Verifies:
-- 1. sender_type = 'child'
-- 2. sender_id = child_id
-- 3. child exists in children table (using IN instead of EXISTS)
CREATE POLICY "Children can send messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child'::text 
    AND sender_id = child_id
    AND child_id IN (
      SELECT id 
      FROM public.children
      WHERE id = sender_id
    )
  );

-- =====================================================
-- STEP 4: Verify policy was created correctly
-- =====================================================
SELECT 
    'Child Message INSERT Policy' as check_type,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN with_check IS NOT NULL THEN '✅ Has WITH CHECK clause'
        ELSE '❌ Missing WITH CHECK clause'
    END as status,
    with_check as policy_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
  AND 'anon' = ANY(roles);

-- =====================================================
-- STEP 5: Test the policy logic with your actual UUID
-- =====================================================
WITH test_insert AS (
    SELECT 
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid as test_sender_id,
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid as test_child_id,
        'child'::text as test_sender_type
)
SELECT 
    'Policy Logic Test (IN Pattern)' as test_name,
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
    -- Check 3: IN subquery check
    CASE 
        WHEN test_child_id IN (
            SELECT id 
            FROM public.children
            WHERE id = test_sender_id
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as check3_in_subquery,
    -- Final combined check
    CASE 
        WHEN test_sender_type = 'child'::text 
         AND test_sender_id = test_child_id
         AND test_child_id IN (
            SELECT id 
            FROM public.children
            WHERE id = test_sender_id
        ) THEN '✅✅✅ ALL CHECKS PASS ✅✅✅'
        ELSE '❌❌❌ SOME CHECK FAILED ❌❌❌'
    END as final_result
FROM test_insert;


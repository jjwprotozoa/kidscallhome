-- =====================================================
-- FIX CHILD MESSAGE INSERT POLICY
-- =====================================================
-- Issue: Policy might be using incorrect column references
-- In WITH CHECK clauses, columns should be referenced directly
-- =====================================================

-- =====================================================
-- STEP 1: Drop existing child message INSERT policy
-- =====================================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- =====================================================
-- STEP 2: Recreate with correct column references
-- =====================================================
-- In WITH CHECK clauses, reference columns directly (not messages.column)
CREATE POLICY "Children can send messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child' AND
    sender_id = child_id AND
    EXISTS (
      SELECT 1 FROM public.children
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
-- STEP 4: Test the policy logic
-- =====================================================
-- This simulates what the policy checks
SELECT 
    'Policy Logic Test' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid
            AND id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid
        ) THEN '✅ EXISTS check passes'
        ELSE '❌ EXISTS check fails'
    END as exists_check_result;


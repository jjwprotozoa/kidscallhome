-- =====================================================
-- FIX CHILD POLICY TO MATCH PARENT PATTERN EXACTLY
-- =====================================================
-- Parent policy works and uses: EXISTS with messages.child_id
-- Child policy should use the same pattern
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
-- STEP 3: Create policy matching parent pattern EXACTLY
-- =====================================================
-- Parent uses: EXISTS with messages.child_id reference
-- Child should use: EXISTS with messages.child_id AND messages.sender_id
-- Key: Use messages. prefix in the EXISTS subquery (like parent does)
CREATE POLICY "Children can send messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child'::text 
    AND sender_id = child_id
    AND EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
      AND children.id = messages.sender_id
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
    with_check::text as policy_expression,
    -- Check if it matches parent pattern
    CASE 
        WHEN with_check::text LIKE '%messages.child_id%' THEN '✅ Uses messages.child_id (matches parent pattern)'
        ELSE '❌ Does not use messages.child_id'
    END as pattern_check,
    CASE 
        WHEN with_check::text LIKE '%EXISTS%' THEN '✅ Uses EXISTS (matches parent pattern)'
        ELSE '❌ Does not use EXISTS'
    END as exists_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
  AND 'anon' = ANY(roles);

-- =====================================================
-- STEP 5: Show both policies side by side
-- =====================================================
SELECT 
    'Side-by-Side Comparison' as check_type,
    policyname,
    CASE 
        WHEN 'authenticated' = ANY(roles) THEN 'Parent'
        WHEN 'anon' = ANY(roles) THEN 'Child'
    END as policy_type,
    with_check::text as policy_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
ORDER BY 
    CASE WHEN 'authenticated' = ANY(roles) THEN 1 ELSE 2 END;

-- =====================================================
-- STEP 6: Test the policy logic
-- =====================================================
-- Simulate what the policy checks
WITH test_row AS (
    SELECT 
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid as test_child_id,
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid as test_sender_id,
        'child'::text as test_sender_type
)
SELECT 
    'Policy Logic Test' as test_name,
    test_child_id,
    test_sender_id,
    test_sender_type,
    -- Simulate the WITH CHECK clause
    CASE 
        WHEN test_sender_type = 'child'::text 
         AND test_sender_id = test_child_id
         AND EXISTS (
            SELECT 1 FROM public.children
            WHERE children.id = test_child_id
            AND children.id = test_sender_id
        ) THEN '✅✅✅ POLICY CHECK PASSES ✅✅✅'
        ELSE '❌❌❌ POLICY CHECK FAILS ❌❌❌'
    END as policy_check_result
FROM test_row;


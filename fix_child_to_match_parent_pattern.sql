-- =====================================================
-- FIX CHILD POLICY TO MATCH PARENT PATTERN
-- =====================================================
-- Parent policy uses EXISTS with messages.child_id reference
-- Let's try the exact same pattern for children
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
-- STEP 3: Create policy matching parent pattern exactly
-- =====================================================
-- Parent uses: EXISTS with messages.child_id reference
-- Child should use: EXISTS with messages.child_id AND messages.sender_id
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
-- STEP 4: Verify policy was created
-- =====================================================
SELECT 
    'Child Message INSERT Policy' as check_type,
    policyname,
    cmd as command,
    roles,
    with_check as policy_expression,
    with_check::text as expression_text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
  AND 'anon' = ANY(roles);

-- =====================================================
-- STEP 5: Show both policies side by side for comparison
-- =====================================================
SELECT 
    'Policy Comparison' as check_type,
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


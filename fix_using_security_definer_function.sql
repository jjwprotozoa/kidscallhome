-- =====================================================
-- FIX USING SECURITY DEFINER FUNCTION PATTERN
-- =====================================================
-- This is the same pattern used for the working calls table
-- The function bypasses RLS to verify the child exists
-- =====================================================

-- =====================================================
-- STEP 1: Create SECURITY DEFINER function
-- =====================================================
-- This function bypasses RLS to verify the child exists
CREATE OR REPLACE FUNCTION public.verify_child_can_send_message(
  p_child_id uuid,
  p_sender_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify child exists and sender_id matches child_id
  RETURN EXISTS (
    SELECT 1 FROM public.children
    WHERE id = p_child_id
    AND id = p_sender_id
  );
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.verify_child_can_send_message(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_child_can_send_message(uuid, uuid) TO authenticated;

-- =====================================================
-- STEP 2: Ensure children table policy exists
-- =====================================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- =====================================================
-- STEP 3: Drop existing child message INSERT policy
-- =====================================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- =====================================================
-- STEP 4: Create policy using SECURITY DEFINER function
-- =====================================================
-- This pattern works reliably because the function bypasses RLS
CREATE POLICY "Children can send messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child'::text 
    AND sender_id = child_id
    AND public.verify_child_can_send_message(child_id, sender_id) = true
  );

-- =====================================================
-- STEP 5: Verify policy was created
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
-- STEP 6: Test the function directly
-- =====================================================
-- This should return true if the function works
SELECT 
    'Function Test' as test_name,
    public.verify_child_can_send_message(
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid,
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid
    ) as function_result,
    CASE 
        WHEN public.verify_child_can_send_message(
            'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid,
            'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid
        ) THEN '✅ Function works correctly'
        ELSE '❌ Function returns false'
    END as status;


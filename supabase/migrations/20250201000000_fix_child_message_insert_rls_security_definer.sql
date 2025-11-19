-- Fix child message INSERT RLS using SECURITY DEFINER function
-- Created: 2025-02-01
-- Issue: EXISTS subquery blocked by children table RLS
-- Solution: Use SECURITY DEFINER function to bypass RLS (same pattern as calls table)

-- ============================================
-- STEP 1: Create SECURITY DEFINER function
-- This bypasses RLS to verify the child exists
-- ============================================
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
  -- SECURITY DEFINER allows this to bypass RLS on children table
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

-- ============================================
-- STEP 2: Ensure children table allows anonymous reads (for other operations)
-- ============================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

GRANT SELECT ON public.children TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- ============================================
-- STEP 3: Drop existing policy
-- ============================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- ============================================
-- STEP 4: Create policy using SECURITY DEFINER function
-- This bypasses RLS issues with the subquery
-- ============================================
CREATE POLICY "Children can send messages"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  sender_type = 'child' AND
  sender_id = child_id AND
  public.verify_child_can_send_message(child_id, sender_id) = true
);

-- ============================================
-- STEP 5: Verify function and policy were created
-- ============================================
-- Check function exists
SELECT 
    'Function Verification' as info,
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'verify_child_can_send_message';

-- Check policy exists
SELECT 
    'Policy Verification' as info,
    policyname,
    cmd as command,
    roles,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND policyname = 'Children can send messages';


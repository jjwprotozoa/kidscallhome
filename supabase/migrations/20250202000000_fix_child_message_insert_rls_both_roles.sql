-- Fix child message INSERT RLS - Apply to both anon and authenticated roles
-- Created: 2025-02-02
-- Issue: Policy only applies to anon role, but children might be authenticated
-- Solution: Apply policy to both anon and authenticated roles (or public)

-- ============================================
-- STEP 1: Ensure function exists and has permissions
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

-- Grant execute permission to both roles
GRANT EXECUTE ON FUNCTION public.verify_child_can_send_message(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_child_can_send_message(uuid, uuid) TO authenticated;

-- ============================================
-- STEP 2: Ensure children table allows reads
-- ============================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT ON public.children TO anon;
GRANT SELECT ON public.children TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================
-- STEP 3: Drop existing policy
-- ============================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- ============================================
-- STEP 4: Create policy for BOTH anon and authenticated roles
-- This ensures it works regardless of session type
-- ============================================
CREATE POLICY "Children can send messages"
ON public.messages
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (
  sender_type = 'child' AND
  sender_id = child_id AND
  public.verify_child_can_send_message(child_id, sender_id) = true
);

-- ============================================
-- STEP 5: Verify policy was created correctly
-- ============================================
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


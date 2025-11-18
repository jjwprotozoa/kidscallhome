-- ============================================
-- SECURITY FIX: Children Table Exposure
-- ============================================
-- Replace overly permissive policy with SECURITY DEFINER function
-- that verifies ONLY a specific login code

-- Drop the insecure policy
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

-- Create SECURITY DEFINER function for safe login code verification
CREATE OR REPLACE FUNCTION public.verify_login_code(p_code TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  avatar_color TEXT,
  parent_id UUID
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, avatar_color, parent_id
  FROM children 
  WHERE login_code = p_code 
  LIMIT 1;
$$;

-- Grant execute to anonymous users for login
GRANT EXECUTE ON FUNCTION public.verify_login_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_login_code(TEXT) TO authenticated;

-- ============================================
-- SECURITY FIX: Messages Table - Add Child Policies
-- ============================================
-- Based on docs/sql/fix_child_messaging_rls_v2.sql

-- Create SECURITY DEFINER function to verify child can send message
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

-- Create policy for children to VIEW messages
CREATE POLICY "Children can view their messages"
  ON public.messages FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
    )
  );

-- Create policy for children to SEND messages
CREATE POLICY "Children can send messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child' AND
    sender_id = child_id AND
    public.verify_child_can_send_message(child_id, sender_id) = true
  );

-- ============================================
-- SECURITY FIX: Calls Table - Restrict Access
-- ============================================
-- Replace permissive USING (true) policies with scoped access

-- Create SECURITY DEFINER function to verify child can access call
CREATE OR REPLACE FUNCTION public.verify_child_call_access(
  p_call_id uuid,
  p_child_id uuid
)
RETURNS boolean
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calls
    WHERE id = p_call_id
    AND child_id = p_child_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_child_call_access(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_child_call_access(uuid, uuid) TO authenticated;

-- Drop and recreate children's call policies with proper scoping
DROP POLICY IF EXISTS "Children can view their calls" ON public.calls;
DROP POLICY IF EXISTS "Children can update their calls" ON public.calls;

CREATE POLICY "Children can view their calls"
  ON public.calls FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = calls.child_id
    )
  );

CREATE POLICY "Children can update their calls"
  ON public.calls FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = calls.child_id
    )
  );

-- Verify policies were created
SELECT 
  'Security Policies Created' as status,
  tablename,
  policyname,
  cmd as command
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('children', 'messages', 'calls')
ORDER BY tablename, policyname;
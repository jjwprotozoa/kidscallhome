-- Fix RLS policies for messages table to allow children to message parents
-- Created: 2025-01-23
-- Issue: Parent can message child but child cannot message parent
-- Pattern: Uses SECURITY DEFINER function (same as working calls table policies)

-- ============================================
-- STEP 1: Create SECURITY DEFINER function to verify child can send message
-- ============================================
-- This function bypasses RLS to verify the child exists and sender_id matches
-- Same pattern as verify_child_can_insert_call function

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

-- ============================================
-- STEP 2: Ensure children table allows anonymous reads
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'children'
    AND policyname = 'Anyone can verify login codes'
  ) THEN
    CREATE POLICY "Anyone can verify login codes"
    ON public.children
    FOR SELECT
    TO anon
    USING (true);
    
    RAISE NOTICE 'Created policy: Anyone can verify login codes';
  ELSE
    RAISE NOTICE 'Policy "Anyone can verify login codes" already exists';
  END IF;
END $$;

-- ============================================
-- STEP 3: Drop existing child message policies if they exist
-- ============================================
DROP POLICY IF EXISTS "Children can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- ============================================
-- STEP 4: Create policy for children to VIEW messages
-- ============================================
CREATE POLICY "Children can view their messages"
  ON public.messages FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
    )
  );

-- ============================================
-- STEP 5: Create policy for children to SEND messages
-- Uses SECURITY DEFINER function to bypass RLS checks
-- ============================================
CREATE POLICY "Children can send messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child' AND
    sender_id = child_id AND
    public.verify_child_can_send_message(child_id, sender_id) = true
  );


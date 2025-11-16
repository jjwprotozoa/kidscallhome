-- Fix RLS policies for messages table to allow children to message parents
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/sql/new

-- ============================================
-- STEP 1: Ensure children table allows anonymous reads
-- ============================================
-- CRITICAL: Children (anonymous users) need to read the children table
-- to verify their own record exists for RLS policies to work
-- This policy is required for the EXISTS/IN checks in message policies

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
-- STEP 2: Drop existing child message policies if they exist
-- ============================================
DROP POLICY IF EXISTS "Children can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- ============================================
-- STEP 3: Create policy for children to VIEW messages
-- Children should be able to view ALL messages for their child_id
-- (both messages they sent and messages from their parent)
-- ============================================
CREATE POLICY "Children can view their messages"
  ON public.messages FOR SELECT
  TO anon
  USING (
    -- Child can view messages where they are the child_id
    -- This includes messages from parent (sender_type='parent') 
    -- and messages they sent (sender_type='child')
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
    )
  );

-- ============================================
-- STEP 4: Create policy for children to SEND messages
-- MIRRORS the working parent policy exactly, but for children (anon role)
-- Parent policy pattern:
--   sender_type = 'parent' AND
--   sender_id = auth.uid() AND
--   EXISTS (SELECT 1 FROM children WHERE children.id = child_id AND children.parent_id = auth.uid())
-- Child policy pattern:
--   sender_type = 'child' AND
--   sender_id = child_id (child sends as themselves)
--   EXISTS (SELECT 1 FROM children WHERE children.id = child_id AND children.id = sender_id)
-- ============================================
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

-- ============================================
-- STEP 4: Verify policies were created
-- ============================================
SELECT 
    'Messages Policies' as table_name,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY policyname;

-- ============================================
-- STEP 5: Test query (for verification)
-- ============================================
-- This should show all policies for messages table
-- Expected policies:
-- 1. "Children can view their messages" (SELECT, anon)
-- 2. "Children can send messages" (INSERT, anon)
-- 3. "Parents can view messages for their children" (SELECT, authenticated)
-- 4. "Parents can send messages" (INSERT, authenticated)


-- Complete fix for all RLS policies
-- This ensures both parents and children can properly interact with calls and messages
-- Run this in Supabase SQL Editor

-- ============================================
-- FIX CALLS TABLE RLS POLICIES
-- ============================================

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;
DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;

-- Parent policies (authenticated users)
CREATE POLICY "Parents can view calls for their children"
ON public.calls
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents can insert calls"
ON public.calls
FOR INSERT
WITH CHECK (
  caller_type = 'parent' AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents can update calls"
ON public.calls
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

-- Child policies (anonymous users)
CREATE POLICY "Children can view their own calls"
ON public.calls
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);

CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
  caller_type = 'child' AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = calls.parent_id
  )
);

CREATE POLICY "Children can update their own calls"
ON public.calls
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);

-- ============================================
-- FIX MESSAGES TABLE RLS POLICIES
-- ============================================

-- Drop existing child message policies if they exist
DROP POLICY IF EXISTS "Children can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- Add policy for children to view messages
CREATE POLICY "Children can view their messages"
  ON public.messages FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
    )
  );

-- Add policy for children to send messages
CREATE POLICY "Children can send messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child' AND
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
      AND children.id = messages.sender_id
    )
  );

-- Verify all policies were created
SELECT 
    'Calls Policies' as table_name,
    policyname,
    cmd as command
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY policyname;

SELECT 
    'Messages Policies' as table_name,
    policyname,
    cmd as command
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY policyname;


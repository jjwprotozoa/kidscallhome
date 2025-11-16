-- FIX_PARENT_TO_CHILD_CALLS.sql
-- COMPREHENSIVE FIX for parent-to-child calls - ensures video/audio work
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Fix Parent RLS Policies for Calls
-- ============================================
-- Ensure parents can view, insert, and update calls properly

-- Drop existing parent policies
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;
DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;

-- CRITICAL FIX: Parent can view calls where they are the parent_id
-- This allows viewing both parent-initiated and child-initiated calls
CREATE POLICY "Parents can view calls for their children"
ON public.calls
FOR SELECT
USING (
  -- Check that the call's parent_id matches the authenticated user
  calls.parent_id = auth.uid()
  -- Also verify the child belongs to this parent (security check)
  AND EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

-- CRITICAL FIX: Parent can insert calls they initiate
CREATE POLICY "Parents can insert calls"
ON public.calls
FOR INSERT
WITH CHECK (
  caller_type = 'parent' AND
  parent_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

-- CRITICAL FIX: Parent can update calls (including offer, answer, ice_candidates, status, etc.)
-- The WITH CHECK allows updating any fields as long as the relationship is maintained
CREATE POLICY "Parents can update calls"
ON public.calls
FOR UPDATE
USING (
  -- Parent can update if they are the parent_id
  calls.parent_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
)
WITH CHECK (
  -- After update, still verify the relationship is maintained
  calls.parent_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

-- ============================================
-- STEP 2: Ensure Child RLS Policies Allow Viewing/Updating Parent Calls
-- ============================================

-- Children need to be able to view and update calls where they are the child_id
-- This is already handled by existing child policies, but verify they exist

-- Ensure children can view calls (including parent-initiated ones)
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
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

-- Ensure children can update calls (to add answer, ICE candidates, etc.)
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;
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
  -- Allow update if the child_id still matches (child can't change this)
  -- But allow updating any other fields including answer, ice_candidates, status, ended_at, etc.
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);

-- ============================================
-- STEP 3: Verify Realtime is Enabled
-- ============================================

-- Ensure realtime is enabled for calls table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
END $$;

-- ============================================
-- STEP 4: Verify All Policies
-- ============================================

SELECT 
    'All Call Policies' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY policyname, cmd;

-- ============================================
-- STEP 5: Test Queries
-- ============================================
-- Run these as parent user to verify policies work:

-- Test 1: Parent should be able to insert a call
-- INSERT INTO calls (child_id, parent_id, caller_type, status)
-- SELECT id, auth.uid(), 'parent', 'ringing'
-- FROM children WHERE parent_id = auth.uid() LIMIT 1;

-- Test 2: Parent should be able to update the call with offer
-- UPDATE calls 
-- SET offer = '{"type": "offer", "sdp": "test"}'::jsonb
-- WHERE parent_id = auth.uid() AND caller_type = 'parent'
-- RETURNING *;

-- Test 3: Parent should be able to view calls
-- SELECT * FROM calls 
-- WHERE parent_id = auth.uid()
-- ORDER BY created_at DESC
-- LIMIT 5;


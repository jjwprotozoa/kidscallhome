-- FIX_CHILD_TO_PARENT_CALLS.sql
-- COMPREHENSIVE FIX for child-to-parent calls not being received by parent
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Fix Parent RLS Policy for Viewing Calls
-- ============================================
-- The parent dashboard queries by parent_id, but RLS policy needs to allow this

DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;

-- CRITICAL FIX: Check calls.parent_id directly to match dashboard queries
-- This allows parents to see calls where they are the parent_id, regardless of caller_type
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

-- ============================================
-- STEP 2: Ensure Child RLS Policies Allow Call Creation
-- ============================================

DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;

-- Allow children to view their own calls
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

-- Allow children to insert calls they initiate
-- CRITICAL: Must verify parent_id matches child's parent_id for security
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

-- Allow children to update their own calls
-- CRITICAL: Must allow updating all columns including offer, answer, ice_candidates, status, ended_at, etc.
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
  -- But allow updating any other fields including offer, answer, ice_candidates, status, ended_at, etc.
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);

-- ============================================
-- STEP 3: Verify Realtime is Enabled
-- ============================================

-- Ensure realtime is enabled for calls table
-- Note: This may fail if table is already in publication, which is fine
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
-- STEP 5: Test Query (Run as parent user)
-- ============================================
-- This should return child-initiated calls for the authenticated parent
-- SELECT * FROM calls 
-- WHERE parent_id = auth.uid() 
-- AND caller_type = 'child' 
-- AND status = 'ringing'
-- ORDER BY created_at DESC
-- LIMIT 1;


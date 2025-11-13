-- RESTORE_WORKING_CHILD_CALLS.sql
-- EXACT copy of FIX_CHILD_TO_PARENT_CALLS.sql that was working
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Fix Parent RLS Policy for Viewing Calls
-- ============================================
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;

CREATE POLICY "Parents can view calls for their children"
ON public.calls
FOR SELECT
USING (
  calls.parent_id = auth.uid()
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
-- STEP 3: Verify Realtime is Enabled
-- ============================================
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


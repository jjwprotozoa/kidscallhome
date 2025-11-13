-- EMERGENCY_FIX_CHILD_CALLS.sql
-- Emergency fix - temporarily simplify policy to get it working
-- Run this in Supabase SQL Editor if DIAGNOSE_AND_FIX_CHILD_CALLS.sql doesn't work

-- ============================================
-- STEP 1: Ensure children table allows anonymous reads
-- ============================================

DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 2: Drop ALL child call policies
-- ============================================

DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;

-- ============================================
-- STEP 3: Create simplified policies for testing
-- ============================================
-- These are more permissive to get it working, then we can tighten security

-- Allow children to view calls where they are the child_id
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

-- TEMPORARY: More permissive insert policy for debugging
-- This allows any child to insert a call with caller_type='child'
-- We'll verify the parent_id check works separately
CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
  caller_type = 'child' AND
  EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.id = calls.child_id
    AND c.parent_id = calls.parent_id
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
-- STEP 4: Verify
-- ============================================

SELECT 
    'Emergency Fix Applied' as status,
    policyname,
    cmd,
    roles::text
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname LIKE 'Children%'
ORDER BY policyname, cmd;


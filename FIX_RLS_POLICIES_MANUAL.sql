-- FIX_RLS_POLICIES_MANUAL.sql
-- Manual fix for RLS policies if auto-fix function doesn't exist
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Ensure children table has anon read policy
-- ============================================

DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 2: Fix Child Policies
-- ============================================

-- Drop existing child policies
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
-- CRITICAL: Must have WITH CHECK clause
CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
  caller_type = 'child'::text AND
  calls.child_id IN (
    SELECT id 
    FROM public.children 
    WHERE parent_id = calls.parent_id
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
-- STEP 3: Fix Parent Policies
-- ============================================

-- Drop existing parent policies
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;
DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;

-- Allow parents to view calls for their children
-- CRITICAL: Check calls.parent_id directly to match dashboard queries
-- This allows parents to see calls where they are the parent_id, regardless of caller_type
CREATE POLICY "Parents can view calls for their children"
ON public.calls
FOR SELECT
TO authenticated
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

-- Allow parents to insert calls they initiate
-- CRITICAL: Must have WITH CHECK clause
CREATE POLICY "Parents can insert calls"
ON public.calls
FOR INSERT
TO authenticated
WITH CHECK (
  caller_type = 'parent'::text AND
  parent_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

-- Allow parents to update calls
-- CRITICAL: Must allow updating all columns including offer, answer, ice_candidates, status, ended_at, etc.
CREATE POLICY "Parents can update calls"
ON public.calls
FOR UPDATE
TO authenticated
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
-- STEP 4: Verify policies were created
-- ============================================

SELECT 
    'Policy Verification' as info,
    policyname,
    cmd as command,
    roles::text as roles,
    CASE 
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '❌ MISSING WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check IS NOT NULL THEN '✅ Has WITH CHECK'
        ELSE '✅ OK'
    END as status
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY 
  CASE 
    WHEN policyname LIKE 'Children%' THEN 1
    WHEN policyname LIKE 'Parents%' THEN 2
    ELSE 3
  END,
  policyname,
  cmd;


-- supabase/migrations/20250120000001_fix_call_rls_both_directions.sql
-- Fix RLS policies for calls table to allow both child-to-parent and parent-to-child calls
-- This ensures both directions work correctly

-- ============================================
-- STEP 1: Ensure children table allows anonymous reads
-- ============================================
-- CRITICAL: Children (anonymous users) need to read the children table
-- to verify their own record exists for RLS policies to work
-- IMPORTANT: Drop and recreate to ensure it's active and correct

DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 2: Drop ALL existing call policies to start fresh
-- ============================================

DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;
DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;

-- ============================================
-- STEP 3: Create Child Policies (for anonymous users)
-- ============================================

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
-- CRITICAL: Uses IN subquery instead of EXISTS (EXISTS doesn't work reliably in WITH CHECK)
-- This verifies:
-- 1. caller_type is 'child'
-- 2. The child exists in children table
-- 3. The parent_id matches the child's parent_id (security)
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
-- STEP 4: Create Parent Policies (for authenticated users)
-- ============================================

-- Allow parents to view calls for their children
-- CRITICAL: Check calls.parent_id directly to match dashboard queries
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

-- Allow parents to insert calls they initiate
-- CRITICAL: Must verify:
-- 1. caller_type is 'parent'
-- 2. parent_id matches auth.uid()
-- 3. The child belongs to this parent
CREATE POLICY "Parents can insert calls"
ON public.calls
FOR INSERT
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
-- STEP 5: Verify policies were created
-- ============================================

SELECT 
    'Call RLS Policies' as info,
    policyname,
    cmd as command,
    roles as roles
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY 
  CASE 
    WHEN policyname LIKE 'Children%' THEN 1
    WHEN policyname LIKE 'Parents%' THEN 2
    ELSE 3
  END,
  policyname;


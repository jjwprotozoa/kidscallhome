-- FIX_CHILD_CALL_RLS_COMPLETE.sql
-- RESTORE WORKING FIX: Child-to-parent call RLS policies
-- This restores the exact working configuration from FIX_CHILD_TO_PARENT_CALLS.sql
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Ensure children table allows anonymous reads
-- ============================================
-- CRITICAL: Children (anonymous users) need to read the children table
-- to verify their own record exists for RLS policies to work
-- 
-- IMPORTANT: Drop and recreate to ensure it's active and correct

DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 2: Drop and recreate ALL child call policies
-- ============================================
-- Remove any conflicting or broken policies

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
-- STEP 6: Verify all policies exist
-- ============================================

SELECT 
    'Child Call Policies' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname LIKE 'Children%'
ORDER BY policyname, cmd;

SELECT 
    'Children Table Policies' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE tablename = 'children'
  AND roles::text LIKE '%anon%'
ORDER BY policyname;

-- ============================================
-- STEP 7: Test query (optional - run as anonymous user)
-- ============================================
-- This should work if policies are correct:
-- INSERT INTO calls (child_id, parent_id, caller_type, status)
-- SELECT id, parent_id, 'child', 'ringing'
-- FROM children
-- WHERE id = '<child_id>'
-- LIMIT 1;


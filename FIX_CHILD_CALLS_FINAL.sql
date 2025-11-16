-- FIX_CHILD_CALLS_FINAL.sql
-- Final fix based on actual RLS inspection
-- The policies exist but may not be evaluating correctly
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Verify children table anon policy exists and is correct
-- ============================================
-- This MUST exist for the calls INSERT policy to work

DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

-- Recreate with explicit permissions
CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 2: Drop and recreate child call policies
-- ============================================
-- Drop in reverse order to avoid dependency issues

DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;

-- ============================================
-- STEP 3: Recreate child call policies
-- ============================================
-- Recreate in order: SELECT, INSERT, UPDATE

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

-- CRITICAL: Allow children to insert calls
-- The EXISTS check verifies:
-- 1. The child exists in children table
-- 2. The parent_id matches the child's parent_id (security)
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
-- STEP 4: Verify policies are active
-- ============================================

SELECT 
    '✅ Verification: Child Call Policies' as info,
    policyname,
    cmd as command,
    roles::text as roles,
    CASE 
        WHEN cmd = 'INSERT' THEN with_check
        WHEN cmd = 'SELECT' THEN qual
        WHEN cmd = 'UPDATE' THEN qual || ' | WITH CHECK: ' || with_check
    END as policy_expression
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname LIKE 'Children%'
ORDER BY 
    CASE cmd 
        WHEN 'SELECT' THEN 1 
        WHEN 'INSERT' THEN 2 
        WHEN 'UPDATE' THEN 3 
    END,
    policyname;

SELECT 
    '✅ Verification: Children Table Anon Policy' as info,
    policyname,
    cmd as command,
    roles::text as roles,
    qual as policy_expression
FROM pg_policies
WHERE tablename = 'children'
  AND policyname = 'Anyone can verify login codes'
  AND roles::text LIKE '%anon%';

-- ============================================
-- STEP 5: Test query (for manual testing)
-- ============================================
-- To test if this works, run this as an anonymous user:
-- 
-- SET LOCAL ROLE anon;
-- 
-- INSERT INTO calls (child_id, parent_id, caller_type, status)
-- SELECT id, parent_id, 'child', 'ringing'
-- FROM children
-- WHERE id = '<actual_child_id>'
-- LIMIT 1;
-- 
-- RESET ROLE;


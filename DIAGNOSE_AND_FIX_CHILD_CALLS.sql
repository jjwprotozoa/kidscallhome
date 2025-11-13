-- DIAGNOSE_AND_FIX_CHILD_CALLS.sql
-- Comprehensive diagnostic and fix for child-to-parent call RLS issues
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Check current policies
-- ============================================
SELECT 
    'Current Call Policies' as info,
    policyname,
    cmd as command,
    roles::text as roles,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY policyname, cmd;

SELECT 
    'Current Children Table Policies' as info,
    policyname,
    cmd as command,
    roles::text as roles,
    qual as using_clause
FROM pg_policies
WHERE tablename = 'children'
ORDER BY policyname, cmd;

-- ============================================
-- STEP 2: Check if RLS is enabled
-- ============================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('calls', 'children')
AND schemaname = 'public';

-- ============================================
-- STEP 3: Ensure children table allows anonymous reads
-- ============================================
-- CRITICAL: This MUST exist for the calls insert policy to work
-- The EXISTS check in the calls policy requires anonymous users to read children table

-- Ensure RLS is enabled on children table (required for policies to work)
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the policy to ensure it's correct
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 4: Drop ALL existing child call policies
-- ============================================
-- Remove any conflicting policies

DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;

-- ============================================
-- STEP 5: Create child call policies
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
-- STEP 6: Verify policies were created
-- ============================================

SELECT 
    '✅ Child Call Policies After Fix' as info,
    policyname,
    cmd as command,
    roles::text as roles
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname LIKE 'Children%'
ORDER BY policyname, cmd;

SELECT 
    '✅ Children Table Policies After Fix' as info,
    policyname,
    cmd as command,
    roles::text as roles
FROM pg_policies
WHERE tablename = 'children'
  AND roles::text LIKE '%anon%'
ORDER BY policyname;

-- ============================================
-- STEP 7: Test the policy (run as anonymous user)
-- ============================================
-- Uncomment and run this to test if the policy works:
-- 
-- SET ROLE anon;
-- 
-- INSERT INTO calls (child_id, parent_id, caller_type, status)
-- SELECT id, parent_id, 'child', 'ringing'
-- FROM children
-- WHERE id = '<your_child_id>'
-- LIMIT 1;
-- 
-- RESET ROLE;


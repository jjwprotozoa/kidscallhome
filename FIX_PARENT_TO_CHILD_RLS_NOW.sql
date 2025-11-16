-- FIX_PARENT_TO_CHILD_RLS_NOW.sql
-- Comprehensive fix for parent-to-child call RLS issues
-- This ensures parents can read the child's answer field
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Ensure children table has anon read policy
-- ============================================
-- CRITICAL: Parent SELECT policy uses EXISTS subquery on children table
-- If children table doesn't allow anon reads, the EXISTS will fail silently
-- This is required for the parent SELECT policy to work

DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 2: Fix Parent SELECT Policy
-- ============================================
-- CRITICAL: This policy must allow parents to read ALL fields including answer
-- The policy checks parent_id directly to match dashboard queries
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;

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
-- STEP 3: Ensure Parent UPDATE Policy exists
-- ============================================
-- Parents need to update calls (offer, status, etc.)
DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;

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
-- STEP 4: Ensure Child UPDATE Policy exists
-- ============================================
-- Children need to update calls with their answer
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
  -- Allow update if the child_id still matches
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);

-- ============================================
-- STEP 5: Verify policies were created correctly
-- ============================================
SELECT 
    'Policy Verification' as info,
    policyname,
    cmd as command,
    roles::text as roles,
    CASE 
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '❌ MISSING WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check IS NOT NULL THEN '✅ Has WITH CHECK'
        WHEN cmd = 'SELECT' AND qual IS NULL THEN '❌ MISSING USING CLAUSE'
        WHEN cmd = 'SELECT' AND qual IS NOT NULL THEN '✅ Has USING clause'
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

-- ============================================
-- STEP 6: Verify children table policy
-- ============================================
SELECT 
    'Children Table Policy' as info,
    policyname,
    cmd as command,
    roles::text as roles,
    '✅ Policy exists' as status
FROM pg_policies
WHERE tablename = 'children'
AND roles::text LIKE '%anon%'
AND cmd = 'SELECT';

-- ============================================
-- STEP 7: Test the fix (if auto-fix function exists)
-- ============================================
-- Run verification to confirm everything is correct
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'verify_call_rls_policies'
    ) THEN
        RAISE NOTICE 'Verification function exists. Run: SELECT * FROM public.verify_call_rls_policies();';
    ELSE
        RAISE NOTICE 'Verification function does not exist. Policies have been created manually.';
    END IF;
END $$;


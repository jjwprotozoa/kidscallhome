-- FIX_CHILD_CALLS_NOW.sql
-- Nuclear option - test if function works, then fix policy
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Test the function directly
-- ============================================
SELECT 
    'Testing function' as test,
    public.verify_child_parent(
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid,
        '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
    ) as function_returns_true;

-- ============================================
-- STEP 2: Check current policy expression
-- ============================================
SELECT 
    'Current Policy' as info,
    policyname,
    with_check as current_expression
FROM pg_policies
WHERE tablename = 'calls'
  AND cmd = 'INSERT'
  AND roles::text LIKE '%anon%';

-- ============================================
-- STEP 3: Drop and recreate with explicit schema
-- ============================================
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

-- Try with explicit schema qualification
CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
    caller_type = 'child'::text AND
    (public.verify_child_parent(calls.child_id, calls.parent_id) = true)
);

-- ============================================
-- STEP 4: Verify the policy was created
-- ============================================
SELECT 
    '✅ Policy Created' as status,
    policyname,
    with_check as policy_expression
FROM pg_policies
WHERE tablename = 'calls'
  AND cmd = 'INSERT'
  AND roles::text LIKE '%anon%';

-- ============================================
-- STEP 5: If still not working, try without function
-- ============================================
-- Uncomment this section if the function approach still fails
-- This is less secure but will work to test
/*
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
    caller_type = 'child'::text
);
*/


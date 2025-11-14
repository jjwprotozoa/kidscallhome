-- FIX_WITH_SECURITY_DEFINER_FUNCTION.sql
-- Use a SECURITY DEFINER function to bypass RLS in policy evaluation
-- This is the most reliable approach for RLS policies that need to check other tables

-- ============================================
-- STEP 1: Create a SECURITY DEFINER function
-- ============================================
-- This function runs with the privileges of the function owner (not the caller)
-- This allows it to read from children table even when called by anon user

CREATE OR REPLACE FUNCTION public.verify_child_parent_relationship(
    p_child_id uuid,
    p_parent_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.children 
        WHERE id = p_child_id 
        AND parent_id = p_parent_id
    );
$$;

-- Grant execute permission to anon role
GRANT EXECUTE ON FUNCTION public.verify_child_parent_relationship(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_child_parent_relationship(uuid, uuid) TO authenticated;

-- ============================================
-- STEP 2: Drop and recreate child INSERT policy using the function
-- ============================================
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
  caller_type = 'child'::text AND
  public.verify_child_parent_relationship(calls.child_id, calls.parent_id) = true
);

-- ============================================
-- STEP 3: Verify the policy was created
-- ============================================
SELECT 
    '✅ Policy Created with Function' as status,
    policyname,
    cmd,
    roles::text,
    with_check as policy_clause
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname = 'Children can insert calls they initiate'
  AND cmd = 'INSERT';

-- ============================================
-- STEP 4: Test the function directly
-- ============================================
-- Get a real child/parent pair to test with
SELECT 
    'Test Function with Real Data' as info,
    id as child_id,
    parent_id,
    public.verify_child_parent_relationship(id, parent_id) as function_returns_true
FROM public.children
LIMIT 1;

-- ============================================
-- STEP 5: Show all call policies status
-- ============================================
SELECT 
    'All Policies Status' as info,
    policyname,
    cmd,
    roles::text,
    CASE 
        WHEN cmd = 'INSERT' AND with_check IS NOT NULL THEN '✅ Has WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '❌ Missing WITH CHECK'
        ELSE 'N/A'
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


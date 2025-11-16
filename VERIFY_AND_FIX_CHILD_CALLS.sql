-- VERIFY_AND_FIX_CHILD_CALLS.sql
-- Verify current state and apply the function-based fix
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Check if function exists
-- ============================================
SELECT 
    'Current Function Status' as info,
    routine_name,
    routine_type,
    security_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'verify_child_parent';

-- ============================================
-- STEP 2: Check current INSERT policy
-- ============================================
SELECT 
    'Current INSERT Policy' as info,
    policyname,
    cmd,
    roles::text,
    with_check as policy_expression
FROM pg_policies
WHERE tablename = 'calls'
  AND cmd = 'INSERT'
  AND roles::text LIKE '%anon%';

-- ============================================
-- STEP 3: Drop the policy first (so we can recreate the function)
-- ============================================
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

-- ============================================
-- STEP 4: Create/Recreate the function
-- ============================================
-- Now we can drop and recreate the function since policy is dropped
DROP FUNCTION IF EXISTS public.verify_child_parent(uuid, uuid);

CREATE OR REPLACE FUNCTION public.verify_child_parent(
    p_child_id uuid,
    p_parent_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    -- This runs with SECURITY DEFINER, so it bypasses RLS
    RETURN EXISTS (
        SELECT 1 
        FROM public.children
        WHERE id = p_child_id
        AND parent_id = p_parent_id
    );
END;
$$;

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION public.verify_child_parent(uuid, uuid) TO anon;

-- Also grant to authenticated role (for completeness)
GRANT EXECUTE ON FUNCTION public.verify_child_parent(uuid, uuid) TO authenticated;

-- ============================================
-- STEP 5: Test the function manually
-- ============================================
-- Test with your actual values
SELECT public.verify_child_parent(
    'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid,
    '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
) as function_result;

-- ============================================
-- STEP 6: Recreate the INSERT policy using the function
-- ============================================

-- Use the function - this should work reliably
CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
    caller_type = 'child' AND
    public.verify_child_parent(calls.child_id, calls.parent_id)
);

-- ============================================
-- STEP 7: Verify everything is correct
-- ============================================
SELECT 
    '✅ Function Created' as status,
    routine_name,
    security_type,
    'Function exists and is SECURITY DEFINER' as note
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'verify_child_parent';

SELECT 
    '✅ INSERT Policy Updated' as status,
    policyname,
    cmd,
    roles::text,
    with_check as policy_expression
FROM pg_policies
WHERE tablename = 'calls'
  AND cmd = 'INSERT'
  AND roles::text LIKE '%anon%';

-- ============================================
-- STEP 8: Check function permissions
-- ============================================
SELECT 
    'Function Permissions' as info,
    p.proname as function_name,
    r.rolname as role_name,
    has_function_privilege(r.rolname, p.oid, 'EXECUTE') as can_execute
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE p.proname = 'verify_child_parent'
  AND r.rolname IN ('anon', 'authenticated', 'public')
  AND has_function_privilege(r.rolname, p.oid, 'EXECUTE');


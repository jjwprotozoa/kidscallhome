-- supabase/migrations/20250115000001_fix_child_call_insert_rls_final.sql
-- Final fix for child call insert RLS policy
-- Uses SECURITY DEFINER function to verify child relationship

-- ============================================
-- STEP 1: Create SECURITY DEFINER function to verify child can insert call
-- ============================================
-- This function bypasses RLS to verify the child exists and parent_id matches
CREATE OR REPLACE FUNCTION public.verify_child_can_insert_call(
  p_child_id uuid,
  p_parent_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify child exists and parent_id matches
  RETURN EXISTS (
    SELECT 1 
    FROM public.children 
    WHERE id = p_child_id 
    AND parent_id = p_parent_id
  );
END;
$$;

-- Grant execute to anonymous users
GRANT EXECUTE ON FUNCTION public.verify_child_can_insert_call(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_child_can_insert_call(uuid, uuid) TO authenticated;

-- ============================================
-- STEP 2: Drop and recreate child insert policy using the function
-- ============================================
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
  caller_type = 'child'::text 
  AND public.verify_child_can_insert_call(calls.child_id, calls.parent_id)
);

-- ============================================
-- STEP 3: Verify policy was created
-- ============================================
SELECT 
    'Child Insert Policy' as info,
    policyname,
    cmd as command,
    roles as roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname = 'Children can insert calls they initiate';




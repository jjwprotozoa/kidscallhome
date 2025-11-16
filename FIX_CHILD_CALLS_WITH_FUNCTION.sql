-- FIX_CHILD_CALLS_WITH_FUNCTION.sql
-- Alternative fix using a security definer function
-- This bypasses potential RLS evaluation issues with EXISTS subqueries
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Create a function to verify child-parent relationship
-- ============================================
-- This function runs with SECURITY DEFINER, so it can bypass RLS
-- to check if the child exists and parent_id matches

CREATE OR REPLACE FUNCTION public.verify_child_parent(
    p_child_id uuid,
    p_parent_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- ============================================
-- STEP 2: Ensure children table policy exists
-- ============================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 3: Drop and recreate child call policies
-- ============================================
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

-- Use the function instead of direct EXISTS subquery
CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
    caller_type = 'child' AND
    public.verify_child_parent(calls.child_id, calls.parent_id)
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
-- STEP 4: Verify
-- ============================================
SELECT 
    '✅ Policies Created' as status,
    policyname,
    cmd,
    roles::text
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname LIKE 'Children%'
ORDER BY cmd, policyname;

SELECT 
    '✅ Function Created' as status,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'verify_child_parent';


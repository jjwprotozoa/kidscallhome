-- FIX_CHILD_CALLS_FINAL_WORKING.sql
-- Final fix using SECURITY DEFINER function to bypass RLS evaluation issues
-- The EXISTS subquery in WITH CHECK may not evaluate correctly, so we use a function
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Create a SECURITY DEFINER function
-- ============================================
-- This function can read the children table regardless of RLS
-- It verifies that the child exists and parent_id matches

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

-- ============================================
-- STEP 2: Ensure children table policy is active
-- ============================================
-- Still need this for other operations

DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 3: Verify RLS is enabled on children table
-- ============================================
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Drop policy first, then recreate function, then recreate policy
-- ============================================
-- Must drop policy before we can drop/recreate the function

DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

-- Now recreate the function (in case it needs updating)
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

-- Ensure permissions are correct
GRANT EXECUTE ON FUNCTION public.verify_child_parent(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_child_parent(uuid, uuid) TO authenticated;

-- Now recreate the policy using the function
CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
    caller_type = 'child' AND
    public.verify_child_parent(calls.child_id, calls.parent_id)
);

-- ============================================
-- STEP 4: Ensure other child policies exist
-- ============================================
-- These should already exist, but ensure they're correct

DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
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
    EXISTS (
        SELECT 1 FROM public.children
        WHERE children.id = calls.child_id
    )
);

-- ============================================
-- STEP 5: Verify policies are correct
-- ============================================
SELECT 
    '✅ Child INSERT Policy' as info,
    policyname,
    cmd,
    roles::text,
    with_check as policy_expression
FROM pg_policies
WHERE tablename = 'calls'
  AND cmd = 'INSERT'
  AND roles::text LIKE '%anon%';

SELECT 
    '✅ Children Table Anon Policy' as info,
    policyname,
    cmd,
    roles::text,
    qual as policy_expression
FROM pg_policies
WHERE tablename = 'children'
  AND policyname = 'Anyone can verify login codes'
  AND roles::text LIKE '%anon%';

-- ============================================
-- STEP 6: Test the EXISTS check manually
-- ============================================
-- Uncomment and replace with actual values to test:
-- 
-- SELECT 
--     'Testing EXISTS check' as test,
--     EXISTS (
--         SELECT 1
--         FROM public.children
--         WHERE children.id = '<actual_child_id>'::uuid
--         AND children.parent_id = '<actual_parent_id>'::uuid
--     ) as check_passes;


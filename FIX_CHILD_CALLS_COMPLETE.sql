-- FIX_CHILD_CALLS_COMPLETE.sql
-- FINAL WORKING FIX for child-to-parent calls
-- Uses IN subquery instead of EXISTS (which doesn't work in WITH CHECK)
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Ensure children table allows anonymous reads
-- ============================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 2: Drop and recreate child call policies
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

-- Allow children to insert calls they initiate
-- CRITICAL: Uses IN subquery instead of EXISTS (EXISTS doesn't work in WITH CHECK)
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
-- STEP 3: Verify policies
-- ============================================
SELECT 
    '✅ Child Call Policies' as info,
    policyname,
    cmd as command,
    roles::text
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname LIKE 'Children%'
ORDER BY cmd, policyname;


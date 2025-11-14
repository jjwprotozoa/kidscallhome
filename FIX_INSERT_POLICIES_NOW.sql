-- FIX_INSERT_POLICIES_NOW.sql
-- CRITICAL FIX: Ensures INSERT policies have proper WITH CHECK clauses
-- Run this in Supabase SQL Editor immediately

-- ============================================
-- STEP 1: Drop and recreate child insert policy with WITH CHECK
-- ============================================
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

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

-- ============================================
-- STEP 2: Drop and recreate parent insert policy with WITH CHECK
-- ============================================
DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;

CREATE POLICY "Parents can insert calls"
ON public.calls
FOR INSERT
WITH CHECK (
  caller_type = 'parent'::text AND
  parent_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

-- ============================================
-- STEP 3: Verify the policies have WITH CHECK clauses
-- ============================================
SELECT 
    '✅ Fixed INSERT Policies' as info,
    policyname,
    cmd as command,
    roles::text as roles,
    CASE 
        WHEN with_check IS NULL THEN '❌ STILL MISSING!'
        WHEN with_check IS NOT NULL THEN '✅ Has WITH CHECK'
    END as status,
    with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'calls'
  AND cmd = 'INSERT'
ORDER BY policyname;


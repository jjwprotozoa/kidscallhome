-- FIX_CHILD_CALLS_WORKING_FINAL.sql
-- Since simple policy works, the issue is with EXISTS in WITH CHECK
-- Use a different approach that works
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Ensure children table policy exists
-- ============================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 2: Drop current policy
-- ============================================
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

-- ============================================
-- STEP 3: Create policy using IN subquery instead of EXISTS
-- ============================================
-- Sometimes IN works better than EXISTS in WITH CHECK clauses
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
-- STEP 4: If that doesn't work, try this alternative
-- ============================================
-- Uncomment this section if the IN approach still fails
/*
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

-- Use a function call instead
CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
    caller_type = 'child'::text AND
    public.verify_child_parent(calls.child_id, calls.parent_id) = true
);
*/

-- ============================================
-- STEP 5: Verify
-- ============================================
SELECT 
    '✅ Policy Created' as status,
    policyname,
    cmd,
    roles::text,
    with_check as policy_expression
FROM pg_policies
WHERE tablename = 'calls'
  AND cmd = 'INSERT'
  AND roles::text LIKE '%anon%';


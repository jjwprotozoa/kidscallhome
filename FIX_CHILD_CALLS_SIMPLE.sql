-- FIX_CHILD_CALLS_SIMPLE.sql
-- SIMPLEST POSSIBLE FIX - test if basic policy works
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Drop the current policy
-- ============================================
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

-- ============================================
-- STEP 2: Create SIMPLEST policy - just caller_type check
-- ============================================
-- This will work if the issue is with the EXISTS subquery
CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
    caller_type = 'child'::text
);

-- ============================================
-- STEP 3: Test it
-- ============================================
-- Try the call now. If this works, the issue is with the EXISTS check.
-- If this doesn't work, there's a deeper RLS issue.

-- ============================================
-- STEP 4: Add back security check using IN instead of EXISTS
-- ============================================
-- Since simple policy works, now add security using IN subquery
-- IN sometimes works better than EXISTS in WITH CHECK clauses

DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

-- Use IN subquery instead of EXISTS - this should work
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


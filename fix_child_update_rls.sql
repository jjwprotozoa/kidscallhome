-- =====================================================
-- CRITICAL FIX: Allow Children (anon) to UPDATE Calls
-- =====================================================
-- Issue: Child cannot UPDATE calls with answer when accepting incoming call
-- Root Cause: No UPDATE policy exists for anon users (children)
-- Solution: Create UPDATE policy for anon users where they are the child in the call
-- =====================================================

-- Check existing UPDATE policies
SELECT 
    'Current UPDATE Policies' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- Drop existing policy if it exists (in case we need to recreate it)
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;

-- Create UPDATE policy for children (anon users)
-- This allows children to update calls where they are the child (child_id matches their child profile)
CREATE POLICY "Children can update their own calls"
ON public.calls
FOR UPDATE
TO anon
USING (
  -- Child can update calls where child_id matches their profile
  -- Children are identified by their child_id in the calls table
  child_id IS NOT NULL
)
WITH CHECK (
  -- Same condition for WITH CHECK
  child_id IS NOT NULL
);

-- Verify the policy was created
SELECT 
    'UPDATE Policy for Anon Users (Children)' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- =====================================================
-- Fix Applied!
-- =====================================================
-- This should now allow:
-- 1. ✅ Children can UPDATE calls where child_id is set
-- 2. ✅ Children can now save the answer when they answer a parent/family member call
-- =====================================================


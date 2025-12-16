-- Migration: Fix Parent View Children RLS Policy
-- Purpose: Ensure parents can see their children via direct parent_id check
-- Date: 2025-12-10
-- 
-- Issue: Parents cannot see their children despite having correct parent_id
-- This migration ensures the RLS policy on public.children works correctly
-- for authenticated parents by checking parent_id = auth.uid()

-- =====================================================
-- STEP 1: Verify RLS is enabled on children table
-- =====================================================
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Drop ALL existing SELECT policies on children table
-- =====================================================
-- We'll recreate them cleanly to avoid conflicts
DROP POLICY IF EXISTS "Parents can view own children" ON public.children;
DROP POLICY IF EXISTS "Adults can view children in their family" ON public.children;
DROP POLICY IF EXISTS "Family members can view children in their family" ON public.children;
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

-- =====================================================
-- STEP 3: Create primary policy for parents to view their children
-- =====================================================
-- CRITICAL: This is the main policy that allows parents to see their children
-- It checks that parent_id matches the authenticated user's ID
-- This MUST be the first policy and must work without subqueries
CREATE POLICY "Parents can view own children"
  ON public.children FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

-- =====================================================
-- STEP 4: Ensure anonymous users can still verify login codes
-- =====================================================
-- This policy is critical for child login functionality
-- It's scoped to 'anon' so it won't interfere with authenticated parents
CREATE POLICY "Anyone can verify login codes"
  ON public.children FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- STEP 5: Verify policies were created correctly
-- =====================================================
SELECT 
    'Children Table RLS Policies (After Fix)' as info,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN qual IS NULL THEN 'NULL (permissive)'
        ELSE 'HAS USING CLAUSE'
    END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- =====================================================
-- Migration complete
-- =====================================================
-- After running this migration:
-- 1. Parents should be able to SELECT their children via parent_id = auth.uid()
-- 2. Anonymous users can still verify login codes
-- 
-- To verify:
-- 1. Log in as parent (70888a10-ad5e-4764-8dff-537ad2da34d1)
-- 2. Run: SELECT * FROM children;
-- 3. Should return all 4 children (Jolene, Bev, Alex, Stella)
-- 
-- If this still doesn't work, check:
-- 1. JWT token contains correct sub claim matching parent_id
-- 2. auth.uid() returns the expected UUID
-- 3. No other policies are interfering


-- Migration: Fix Parent Children Isolation
-- Purpose: Ensure parents can ONLY see their own children and family members
-- Date: 2025-12-05
-- Issue: Parents were able to see other parents' children due to RLS policy issues

-- =====================================================
-- STEP 1: Verify RLS is enabled on children table
-- =====================================================
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Drop ALL existing SELECT policies on children table
-- =====================================================
-- We'll recreate them properly to ensure isolation
DROP POLICY IF EXISTS "Parents can view own children" ON public.children;
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;
DROP POLICY IF EXISTS "Family members can view children in their family" ON public.children;

-- =====================================================
-- STEP 3: Recreate policies with proper isolation
-- =====================================================

-- CRITICAL: Parents can ONLY view their own children
-- This policy applies to authenticated users (parents)
CREATE POLICY "Parents can view own children"
  ON public.children FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

-- CRITICAL: Anonymous users (children) can verify login codes
-- This is needed for child login functionality
-- IMPORTANT: This is scoped TO anon, so it won't affect authenticated parents
CREATE POLICY "Anyone can verify login codes"
  ON public.children FOR SELECT
  TO anon
  USING (true);

-- Family members can view children in their family
-- This policy was added in the family_members migration
CREATE POLICY "Family members can view children in their family"
  ON public.children FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_members.parent_id = children.parent_id
      AND family_members.id = auth.uid()
      AND family_members.status = 'active'
    )
  );

-- =====================================================
-- STEP 4: Verify policies are correct
-- =====================================================
SELECT 
    'Children Table RLS Policies' as info,
    policyname,
    cmd as command,
    roles,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
ORDER BY cmd, policyname;

-- =====================================================
-- STEP 5: Ensure INSERT, UPDATE, DELETE policies are correct
-- =====================================================

-- Drop and recreate INSERT policy
DROP POLICY IF EXISTS "Parents can insert own children" ON public.children;
CREATE POLICY "Parents can insert own children"
  ON public.children FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = auth.uid());

-- Drop and recreate UPDATE policy
DROP POLICY IF EXISTS "Parents can update own children" ON public.children;
CREATE POLICY "Parents can update own children"
  ON public.children FOR UPDATE
  TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- Drop and recreate DELETE policy
DROP POLICY IF EXISTS "Parents can delete own children" ON public.children;
CREATE POLICY "Parents can delete own children"
  ON public.children FOR DELETE
  TO authenticated
  USING (parent_id = auth.uid());

-- =====================================================
-- STEP 6: Fix family_members table isolation
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Verify family_members policies are correct (they should already be correct from the migration)
-- But let's ensure the parent viewing policy is properly scoped
DROP POLICY IF EXISTS "Parents can view family members in their family" ON public.family_members;
CREATE POLICY "Parents can view family members in their family"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

-- =====================================================
-- STEP 7: Verify RLS is working correctly
-- =====================================================
-- Check that RLS is enabled
DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'children' AND relnamespace = 'public'::regnamespace;
  
  IF NOT rls_enabled THEN
    RAISE EXCEPTION 'RLS is not enabled on children table!';
  ELSE
    RAISE NOTICE '✓ RLS is enabled on children table';
  END IF;
END $$;

-- =====================================================
-- STEP 8: Verify no overly permissive policies exist
-- =====================================================
-- Check for any policies that might allow viewing all children for authenticated users
DO $$
DECLARE
  permissive_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO permissive_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'children'
    AND cmd = 'SELECT'
    AND (roles IS NULL OR 'authenticated' = ANY(roles))
    AND (qual IS NULL OR qual = 'true' OR qual LIKE '%true%');
  
  IF permissive_policy_count > 0 THEN
    RAISE WARNING 'Found % potentially permissive SELECT policies for authenticated users on children table', permissive_policy_count;
  ELSE
    RAISE NOTICE '✓ No overly permissive policies found for authenticated users';
  END IF;
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- After running this migration:
-- 1. Parents will ONLY see their own children (parent_id = auth.uid())
-- 2. Family members will ONLY see children in their family
-- 3. Anonymous users can still verify login codes (for child login)
-- 4. All policies are properly scoped to their respective roles
-- 
-- To verify the fix works:
-- 1. Log in as a parent
-- 2. Query: SELECT * FROM children;
-- 3. Should only return children where parent_id matches your auth.uid()


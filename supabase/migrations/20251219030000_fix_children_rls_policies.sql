-- Migration: Fix Children RLS Policies
-- Purpose: Ensure parents can see their children and all CRUD operations work
-- Date: 2025-12-19
-- 
-- Issue: Parents getting "Error loading children" - the authenticated parent
--        SELECT policy is missing from the database
--
-- This migration ensures all children policies are correctly in place

-- =====================================================
-- STEP 1: Ensure RLS is enabled
-- =====================================================
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Drop and recreate all children policies
-- =====================================================
-- Clean slate approach to ensure no conflicts

DROP POLICY IF EXISTS "Parents can view own children" ON public.children;
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;
DROP POLICY IF EXISTS "Parents can insert own children" ON public.children;
DROP POLICY IF EXISTS "Parents can update own children" ON public.children;
DROP POLICY IF EXISTS "Parents can delete own children" ON public.children;

-- =====================================================
-- STEP 3: Create SELECT policies
-- =====================================================

-- Parents can view their own children (authenticated)
CREATE POLICY "Parents can view own children"
  ON public.children FOR SELECT
  TO authenticated
  USING (parent_id = (SELECT auth.uid()));

-- Anonymous users can verify login codes (for child login)
CREATE POLICY "Anyone can verify login codes"
  ON public.children FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- STEP 4: Create INSERT/UPDATE/DELETE policies
-- =====================================================

-- Parents can add children
CREATE POLICY "Parents can insert own children"
  ON public.children FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = (SELECT auth.uid()));

-- Parents can update their children
CREATE POLICY "Parents can update own children"
  ON public.children FOR UPDATE
  TO authenticated
  USING (parent_id = (SELECT auth.uid()))
  WITH CHECK (parent_id = (SELECT auth.uid()));

-- Parents can delete their children
CREATE POLICY "Parents can delete own children"
  ON public.children FOR DELETE
  TO authenticated
  USING (parent_id = (SELECT auth.uid()));

-- =====================================================
-- STEP 5: Verify
-- =====================================================
DO $$
DECLARE
  v_policy_count INT;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies 
  WHERE tablename = 'children';
  
  RAISE NOTICE 'Children table policies: %', v_policy_count;
  
  IF v_policy_count < 5 THEN
    RAISE WARNING 'Expected 5 policies, found %', v_policy_count;
  ELSE
    RAISE NOTICE 'All children policies created successfully';
  END IF;
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- Parents can now:
-- 1. ✅ View their own children (parent_id = auth.uid())
-- 2. ✅ Add children
-- 3. ✅ Update their children
-- 4. ✅ Delete their children
-- Anonymous users can:
-- 1. ✅ Verify login codes



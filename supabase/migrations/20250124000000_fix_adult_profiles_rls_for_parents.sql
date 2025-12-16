-- Migration: Fix adult_profiles RLS policy for parent queries
-- Purpose: Ensure parents can query their own adult_profiles to get family_id
-- Date: 2025-01-24
-- 
-- This migration fixes the issue where parents cannot see their children because
-- the RLS policy on adult_profiles is blocking the query that fetches family_id.
-- The consolidated policy has a recursive query that can cause issues.
-- We'll ensure the "view own profile" part works correctly.

-- =====================================================
-- STEP 1: Drop the consolidated policy if it exists
-- =====================================================

DROP POLICY IF EXISTS "Adults can view own profile and family profiles" ON public.adult_profiles;

-- =====================================================
-- STEP 2: Recreate separate policies for clarity and to avoid recursion
-- =====================================================

-- Policy 1: Adults can view their own profile
-- This is the critical one for parents to get their family_id
CREATE POLICY "Adults can view own profile"
  ON public.adult_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 2: Adults can view profiles in their family
-- Use the helper function to avoid recursion
CREATE POLICY "Adults can view profiles in their family"
  ON public.adult_profiles FOR SELECT
  TO authenticated
  USING (
    -- Use the helper function that bypasses RLS to avoid recursion
    public.user_has_family_access(family_id)
  );

-- =====================================================
-- STEP 3: Ensure the helper function exists
-- =====================================================
-- The function should already exist from 20251207000005_fix_rls_policy_recursion.sql
-- but we'll recreate it to be safe

CREATE OR REPLACE FUNCTION public.user_has_family_access(p_family_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Check if the current user has any profile in the given family
  -- SECURITY DEFINER bypasses RLS, so this won't cause recursion
  RETURN EXISTS (
    SELECT 1 FROM public.adult_profiles ap
    WHERE ap.user_id = auth.uid()
      AND ap.family_id = p_family_id
  );
END;
$$;

-- Grant execute to authenticated users (needed for RLS policies)
GRANT EXECUTE ON FUNCTION public.user_has_family_access(UUID) TO authenticated;

-- =====================================================
-- STEP 4: Verify the policies are correct
-- =====================================================

DO $$
BEGIN
  -- Verify adult_profiles policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'adult_profiles' 
    AND policyname = 'Adults can view own profile'
  ) THEN
    RAISE EXCEPTION 'Missing policy: Adults can view own profile';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'adult_profiles' 
    AND policyname = 'Adults can view profiles in their family'
  ) THEN
    RAISE EXCEPTION 'Missing policy: Adults can view profiles in their family';
  END IF;
  
  RAISE NOTICE 'All RLS policies verified successfully';
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- The separate policies ensure that:
-- 1. Parents can query their own profile to get family_id (critical for viewing children)
-- 2. Parents can view other profiles in their family (for family members list)
-- 3. No recursion issues because the family access check uses a SECURITY DEFINER function





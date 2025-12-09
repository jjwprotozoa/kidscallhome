-- Migration: Fix RLS Policy Recursion Issues
-- Purpose: Fix recursive RLS policies that cause 500 errors when querying adult_profiles and child_profiles
-- Date: 2025-12-07
-- This migration fixes the circular dependency in RLS policies that causes queries to fail

-- =====================================================
-- STEP 1: Drop problematic RLS policies
-- =====================================================

-- Drop the recursive policy that queries adult_profiles within itself
DROP POLICY IF EXISTS "Adults can view profiles in their family" ON public.adult_profiles;

-- =====================================================
-- STEP 2: Create optimized RLS policies for adult_profiles
-- =====================================================

-- The issue is that "Adults can view profiles in their family" policy
-- queries adult_profiles within itself, causing recursion.
-- We'll use a SECURITY DEFINER function to bypass RLS and avoid recursion.

-- Create a helper function that bypasses RLS to check family access
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

-- Create the policy using the function
-- This avoids recursion because the function runs with elevated privileges
CREATE POLICY "Adults can view profiles in their family"
  ON public.adult_profiles FOR SELECT
  TO authenticated
  USING (
    -- User can view profiles in their family
    -- Use function to avoid recursion (function bypasses RLS)
    public.user_has_family_access(family_id)
  );

-- =====================================================
-- STEP 3: Optimize child_profiles RLS policy
-- =====================================================

-- The child_profiles policy already checks adult_profiles, which is fine
-- But we can make it more efficient by using a subquery instead of EXISTS
-- However, the current policy should work, so we'll leave it as is for now
-- The issue is likely with adult_profiles, not child_profiles

-- =====================================================
-- STEP 4: Add indexes to improve RLS policy performance
-- =====================================================

-- Ensure indexes exist for efficient RLS policy evaluation
CREATE INDEX IF NOT EXISTS idx_adult_profiles_user_family_role 
  ON public.adult_profiles(user_id, family_id, role);

CREATE INDEX IF NOT EXISTS idx_adult_profiles_family_id 
  ON public.adult_profiles(family_id);

CREATE INDEX IF NOT EXISTS idx_child_profiles_family_id 
  ON public.child_profiles(family_id);

-- =====================================================
-- STEP 5: Verify policies are correct
-- =====================================================

-- Check that we have the right policies
DO $$
BEGIN
  -- Verify adult_profiles policies
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
-- The new policy uses a SECURITY DEFINER function to check family access
-- This bypasses RLS and avoids recursion issues when querying adult_profiles
-- The policy will allow users to view any profile in their family
-- (where family_id matches any of their own profiles' family_id)
-- The function runs with elevated privileges, so it can query adult_profiles
-- without triggering RLS policies, breaking the recursion cycle


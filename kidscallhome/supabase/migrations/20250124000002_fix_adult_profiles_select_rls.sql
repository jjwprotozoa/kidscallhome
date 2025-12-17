-- Migration: Fix adult_profiles SELECT RLS Policy
-- Purpose: Ensure parents can query their own adult_profiles to get family_id
-- Date: 2025-01-24
-- 
-- Issue: Parents getting 406 error when querying adult_profiles with:
--   .select("family_id").eq("user_id", user.id).eq("role", "parent")
-- This is blocking parents from seeing their children.

-- =====================================================
-- STEP 1: Drop all existing SELECT policies on adult_profiles
-- =====================================================

DROP POLICY IF EXISTS "Adults can view own profile" ON public.adult_profiles;
DROP POLICY IF EXISTS "Adults can view profiles in their family" ON public.adult_profiles;
DROP POLICY IF EXISTS "Adults can view own profile and family profiles" ON public.adult_profiles;

-- =====================================================
-- STEP 2: Create simple, non-recursive policy for viewing own profile
-- =====================================================
-- This MUST be the first policy and must work without any subqueries
-- that might cause recursion issues

CREATE POLICY "Adults can view own profile"
  ON public.adult_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- STEP 3: Create policy for viewing family profiles (separate, to avoid recursion)
-- =====================================================
-- This uses a SECURITY DEFINER function to avoid RLS recursion

CREATE POLICY "Adults can view profiles in their family"
  ON public.adult_profiles FOR SELECT
  TO authenticated
  USING (
    -- Use SECURITY DEFINER function to check family access without RLS recursion
    public.user_has_family_access(family_id)
  );

-- =====================================================
-- STEP 4: Ensure the helper function exists and works correctly
-- =====================================================

CREATE OR REPLACE FUNCTION public.user_has_family_access(p_family_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_has_access BOOLEAN;
BEGIN
  -- Check if the current user has any profile in the given family
  -- This function runs as SECURITY DEFINER, so it bypasses RLS
  SELECT EXISTS(
    SELECT 1 
    FROM public.adult_profiles 
    WHERE user_id = auth.uid()
      AND family_id = p_family_id
  ) INTO v_has_access;
  
  RETURN COALESCE(v_has_access, false);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.user_has_family_access(UUID) TO authenticated;

-- =====================================================
-- STEP 5: Verify RLS is enabled
-- =====================================================

ALTER TABLE public.adult_profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 6: Comments
-- =====================================================

COMMENT ON POLICY "Adults can view own profile" ON public.adult_profiles IS 
  'Allows authenticated users to view their own adult_profiles record. This is critical for parents to get their family_id.';

COMMENT ON POLICY "Adults can view profiles in their family" ON public.adult_profiles IS 
  'Allows authenticated users to view adult_profiles of other family members in their family. Uses SECURITY DEFINER function to avoid RLS recursion.';

COMMENT ON FUNCTION public.user_has_family_access IS 
  'SECURITY DEFINER function that checks if the current user has access to a family. Bypasses RLS to avoid recursion.';






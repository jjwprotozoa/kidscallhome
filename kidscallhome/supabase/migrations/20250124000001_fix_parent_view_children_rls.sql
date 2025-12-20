-- Migration: Fix Parent View Children RLS Policy
-- Purpose: Ensure parents can see their children through child_family_memberships
-- Date: 2025-01-24
-- 
-- Issue: Parents cannot see their children because the RLS policy on child_profiles
-- is checking the direct family_id column, but children are linked to families
-- through the child_family_memberships junction table.

-- =====================================================
-- STEP 1: Drop existing policy
-- =====================================================

DROP POLICY IF EXISTS "Adults can view children in their family" ON public.child_profiles;

-- =====================================================
-- STEP 2: Create updated policy that uses child_family_memberships
-- =====================================================
-- This policy checks both:
-- 1. Through child_family_memberships (preferred method for two-household setups)
-- 2. Direct family_id match (for backward compatibility)

CREATE POLICY "Adults can view children in their family"
  ON public.child_profiles FOR SELECT
  TO authenticated
  USING (
    -- Check through child_family_memberships (preferred method)
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = child_profiles.id
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = cfm.family_id
    )
    OR
    -- Fallback: Check direct family_id match (for backward compatibility)
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = child_profiles.family_id
    )
  );

-- =====================================================
-- STEP 3: Ensure child_family_memberships has RLS enabled
-- =====================================================

ALTER TABLE public.child_family_memberships ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 4: Ensure RLS policies exist on child_family_memberships
-- =====================================================

-- Drop and recreate to ensure it's correct
DROP POLICY IF EXISTS "Parents and family members can view child memberships in their family" ON public.child_family_memberships;
DROP POLICY IF EXISTS "Parents can view child memberships in their family" ON public.child_family_memberships;
DROP POLICY IF EXISTS "Family members can view child memberships in their family" ON public.child_family_memberships;

-- Create consolidated policy for viewing child memberships
CREATE POLICY "Parents and family members can view child memberships in their family"
  ON public.child_family_memberships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = child_family_memberships.family_id
    )
  );

-- =====================================================
-- STEP 5: Comments
-- =====================================================

COMMENT ON POLICY "Adults can view children in their family" ON public.child_profiles IS 
  'Allows adults (parents and family members) to view children in their family. Checks both child_family_memberships (preferred) and direct family_id (backward compatibility).';









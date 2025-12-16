-- Migration: Ensure Family Members Have Adult Profiles
-- Purpose: Create adult_profiles records for existing family members who don't have them
-- Date: 2025-12-15
-- 
-- Issue: Family members may not have adult_profiles records, which prevents them from
--        viewing children through RLS policies that check adult_profiles
-- Root Cause: Migration 20251207000003 only creates adult_profiles for NEW family members
--             Existing family members who signed up before that migration may not have records

-- =====================================================
-- STEP 1: Create adult_profiles for existing active family members
-- =====================================================
-- This ensures all active family members have adult_profiles records
-- so they can view children through the RLS policy

INSERT INTO public.adult_profiles (
  user_id,
  family_id,
  role,
  relationship_type,
  name,
  email,
  created_at,
  updated_at
)
SELECT 
  fm.id as user_id,
  fm.parent_id as family_id, -- family_id is the parent_id
  'family_member' as role,
  fm.relationship as relationship_type,
  fm.name,
  fm.email,
  fm.created_at,
  fm.updated_at
FROM public.family_members fm
WHERE fm.status = 'active'
  AND fm.id IS NOT NULL -- Must have auth user linked
  AND NOT EXISTS (
    -- Don't create if adult_profiles record already exists
    SELECT 1 FROM public.adult_profiles ap
    WHERE ap.user_id = fm.id
      AND ap.family_id = fm.parent_id
      AND ap.role = 'family_member'
  )
ON CONFLICT (user_id, family_id, role)
DO UPDATE SET
  updated_at = EXCLUDED.updated_at,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  relationship_type = EXCLUDED.relationship_type;

-- =====================================================
-- STEP 2: Verify the migration
-- =====================================================
-- Check that all active family members now have adult_profiles records

SELECT 
  'Family Members Without Adult Profiles' as check_name,
  COUNT(*) as count
FROM public.family_members fm
WHERE fm.status = 'active'
  AND fm.id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.adult_profiles ap
    WHERE ap.user_id = fm.id
      AND ap.family_id = fm.parent_id
      AND ap.role = 'family_member'
  );

-- =====================================================
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ All active family members now have adult_profiles records
-- 2. ✅ Family members can now view children through RLS policy
-- 3. ✅ Existing family members are migrated without breaking changes
-- 
-- To verify:
-- 1. Check that the count from STEP 2 is 0
-- 2. Log in as a family member and verify they can see children
-- 3. Check that adult_profiles records exist for all active family members



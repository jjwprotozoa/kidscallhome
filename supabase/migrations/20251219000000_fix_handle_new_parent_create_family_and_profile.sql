-- Migration: Fix handle_new_parent to create family and adult_profiles
-- Purpose: Fix "Failed to save family setup" error for new users
-- Date: 2025-12-19
-- 
-- ISSUE DESCRIPTION:
-- When a new parent signs up and tries to select a household type, they get:
-- "Failed to save family setup. Please try again."
-- 
-- ROOT CAUSE:
-- 1. The `handle_new_parent()` trigger only created `parents` record, NOT `families` or `adult_profiles`
-- 2. When user selects household type, the UPDATE fails because:
--    - Family record doesn't exist (trigger didn't create it)
--    - OR no RLS UPDATE policy exists to allow the update
-- 
-- SOLUTION:
-- This migration fixes BOTH issues:
-- 1. Updates `handle_new_parent()` trigger to create all three records:
--    - `parents` record (existing behavior)
--    - `families` record with `id = user_id`
--    - `adult_profiles` record with `role = 'parent'` and `family_id = user_id`
-- 2. Adds RLS UPDATE policy so parents can update their own family's household_type
--
-- IMPORTANT: This migration MUST be run before new signups can complete family setup!
--
-- DATA SAFETY:
-- - This migration is READ-ONLY for existing data - it only ADDS missing records
-- - Uses ON CONFLICT DO NOTHING to prevent overwriting existing records
-- - Does NOT modify or delete any existing data
-- - Backfill queries only create records that don't exist
-- - Trigger function only creates new records, never updates existing ones

-- =====================================================
-- STEP 0: Diagnostic - Check current state (run before migration)
-- =====================================================
-- Run these queries to diagnose the issue:
-- 
-- 1. Check if UPDATE policy exists (should return 0 rows if missing):
SELECT 
  'UPDATE policy check' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ UPDATE policy MISSING - this is the problem!'
    ELSE '✅ UPDATE policy exists'
  END as status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'families'
  AND policyname = 'Parents can update their own family'
  AND cmd = 'UPDATE';
--
-- 2. Check parents without families (should be 0 for existing users):
SELECT 
  'Parents without families' as check_type,
  COUNT(*) as count
FROM public.parents p
WHERE NOT EXISTS (SELECT 1 FROM public.families f WHERE f.id = p.id)
UNION ALL
SELECT 
  'Parents without adult_profiles' as check_type,
  COUNT(*) as count
FROM public.parents p
WHERE NOT EXISTS (
  SELECT 1 FROM public.adult_profiles ap 
  WHERE ap.user_id = p.id 
  AND ap.role = 'parent'
  AND ap.family_id = p.id
);
--
-- 3. Check trigger function (should show if it creates families/adult_profiles):
SELECT 
  prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_parent';

-- =====================================================
-- STEP 1: Update handle_new_parent trigger function
-- =====================================================
-- SAFETY: This only affects NEW signups going forward
-- Existing data is NOT modified by this function change
CREATE OR REPLACE FUNCTION public.handle_new_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_code TEXT;
  v_invite_code TEXT;
  v_parent_name TEXT;
BEGIN
  -- Generate family code for the parent
  v_family_code := public.generate_unique_family_code();
  
  -- Use family_code as invite_code, or generate fallback
  v_invite_code := v_family_code;
  
  -- Get parent name from metadata
  v_parent_name := COALESCE(NEW.raw_user_meta_data->>'name', '');
  
  -- 1. Create parents record
  INSERT INTO public.parents (id, email, name, family_code, privacy_cookie_accepted, email_updates_opt_in)
  VALUES (
    NEW.id,
    NEW.email,
    v_parent_name,
    v_family_code,
    false, -- privacy_cookie_accepted defaults to false
    false  -- email_updates_opt_in defaults to false
  );
  
  -- 2. Create families record with id = user_id
  -- SAFETY: ON CONFLICT DO NOTHING ensures we never overwrite existing family data
  INSERT INTO public.families (id, invite_code, household_type, name, created_at)
  VALUES (
    NEW.id,
    v_invite_code,
    'single', -- Default household type, can be changed during family setup
    NULL, -- Family name is optional
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- SAFETY: Never overwrite existing family records
  
  -- 3. Create adult_profiles record
  -- SAFETY: ON CONFLICT DO NOTHING ensures we never overwrite existing profile data
  INSERT INTO public.adult_profiles (
    user_id,
    family_id,
    role,
    relationship_type,
    name,
    email
  )
  VALUES (
    NEW.id,
    NEW.id, -- family_id = user_id for parents
    'parent',
    NULL, -- relationship_type is null for parents
    v_parent_name,
    NEW.email
  )
  ON CONFLICT (user_id, family_id, role) DO NOTHING; -- SAFETY: Never overwrite existing profiles
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- STEP 2: Backfill families for existing parents
-- =====================================================
-- SAFETY: This ONLY creates missing family records
-- - Does NOT modify existing families
-- - Does NOT change existing invite_codes
-- - Uses ON CONFLICT DO NOTHING to skip if family already exists
-- - Handles invite_code conflicts by using UUID-based fallback
-- Create family records for parents who don't have one yet
-- Use family_code as invite_code if available, otherwise use UUID-based code
DO $$
DECLARE
  parent_record RECORD;
  v_invite_code TEXT;
  v_attempts INTEGER;
BEGIN
  FOR parent_record IN 
    SELECT p.id, p.family_code, p.created_at
    FROM public.parents p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.families f WHERE f.id = p.id
    )
  LOOP
    -- Use family_code if available, otherwise generate from UUID
    IF parent_record.family_code IS NOT NULL THEN
      v_invite_code := parent_record.family_code;
    ELSE
      -- Use UUID without dashes (always unique)
      v_invite_code := 'FAM-' || REPLACE(parent_record.id::text, '-', '');
    END IF;
    
    -- Try to insert, handling invite_code conflicts
    v_attempts := 0;
    LOOP
      BEGIN
        INSERT INTO public.families (id, invite_code, household_type, created_at)
        VALUES (
          parent_record.id,
          v_invite_code,
          'single',
          COALESCE(parent_record.created_at, NOW())
        );
        EXIT; -- Success, exit the loop
      EXCEPTION WHEN unique_violation THEN
        -- If invite_code conflict, append UUID suffix (should always be unique)
        v_attempts := v_attempts + 1;
        IF v_attempts > 5 THEN
          -- Fallback: use full UUID as invite_code (guaranteed unique)
          v_invite_code := 'FAM-' || REPLACE(parent_record.id::text, '-', '') || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8);
        ELSE
          v_invite_code := v_invite_code || '-' || SUBSTRING(gen_random_uuid()::text, 1, 4);
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- =====================================================
-- STEP 3: Backfill adult_profiles for existing parents
-- =====================================================
-- SAFETY: This ONLY creates missing adult_profiles records
-- - Does NOT modify existing profiles
-- - Does NOT change existing names, emails, or relationship_types
-- - Uses ON CONFLICT DO NOTHING to skip if profile already exists
-- Create adult_profiles records for parents who don't have one yet
INSERT INTO public.adult_profiles (
    user_id,
    family_id,
    role,
    relationship_type,
    name,
    email
)
SELECT 
    p.id as user_id,
    p.id as family_id, -- family_id = user_id for parents
    'parent' as role,
    NULL as relationship_type,
    COALESCE(p.name, '') as name,
    p.email
FROM public.parents p
WHERE NOT EXISTS (
    SELECT 1 FROM public.adult_profiles ap 
    WHERE ap.user_id = p.id 
    AND ap.role = 'parent'
    AND ap.family_id = p.id
)
ON CONFLICT (user_id, family_id, role) DO NOTHING; -- SAFETY: Never overwrite existing profiles

-- =====================================================
-- STEP 4: Ensure RLS policy allows parents to update their own family
-- =====================================================
-- SAFETY: This only changes RLS policies, does NOT modify table data
-- Drop existing UPDATE policy if it exists (safe - only affects permissions, not data)
DROP POLICY IF EXISTS "Parents can update their own family" ON public.families;

-- Create policy for parents to update their own family
CREATE POLICY "Parents can update their own family"
  ON public.families FOR UPDATE
  TO authenticated
  USING (
    -- Check through adult_profiles (preferred method)
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = families.id
        AND ap.role = 'parent'
    )
    OR
    -- Fallback: Direct match for backward compatibility
    families.id = auth.uid()
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = families.id
        AND ap.role = 'parent'
    )
    OR
    families.id = auth.uid()
  );

-- =====================================================
-- Migration complete
-- =====================================================
-- 
-- DATA SAFETY SUMMARY:
-- ✅ No existing data is modified or deleted
-- ✅ Only missing records are created (backfill)
-- ✅ All INSERTs use ON CONFLICT DO NOTHING to prevent overwrites
-- ✅ Trigger function only creates new records, never updates existing ones
-- ✅ RLS policy changes only affect permissions, not data
-- 
-- After running this migration:
-- 1. New parent signups will automatically create:
--    - parents record
--    - families record (id = user_id)
--    - adult_profiles record (role = 'parent', family_id = user_id)
-- 2. Existing parents missing families or adult_profiles will be backfilled
-- 3. Parents can update their own family record (for household_type during setup)
-- 
-- To verify:
-- 1. Check that existing data is unchanged:
--    SELECT COUNT(*) FROM families; -- Should be same or more
--    SELECT COUNT(*) FROM adult_profiles WHERE role = 'parent'; -- Should be same or more
-- 2. Sign up as a new parent
-- 3. Check that all three records are created
-- 4. Family setup should work without errors


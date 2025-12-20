-- Migration: Fix handle_new_parent to create families and adult_profiles
-- Purpose: Ensure new parent signups automatically get families and adult_profiles records
-- Date: 2025-12-18
-- 
-- Issue: When a new parent signs up, only the parents table gets a record.
-- The families and adult_profiles records are NOT created, causing the family setup
-- selection to fail with "Parent profile not found" error.
--
-- Fix: Update handle_new_parent trigger to also create:
-- 1. A families record with id = user_id
-- 2. An adult_profiles record with role = 'parent' and family_id = user_id

-- =====================================================
-- STEP 1: Update handle_new_parent function
-- =====================================================
-- This function is triggered when a new user signs up with role='parent'
-- It should create: parents, families, and adult_profiles records

CREATE OR REPLACE FUNCTION public.handle_new_parent()
RETURNS TRIGGER AS $$
DECLARE
  v_family_code TEXT;
BEGIN
  -- Generate a unique family code
  v_family_code := public.generate_unique_family_code();
  
  -- 1. Insert into parents table (existing behavior)
  INSERT INTO public.parents (id, email, name, family_code, privacy_cookie_accepted, email_updates_opt_in)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    v_family_code,
    false,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.parents.name);
  
  -- 2. Create a family record for this parent
  -- Use the parent's user_id as the family_id for consistency
  INSERT INTO public.families (id, invite_code, household_type, name, created_at)
  VALUES (
    NEW.id,
    v_family_code,
    'single', -- Default, will be updated during onboarding
    COALESCE(NEW.raw_user_meta_data->>'name', '') || '''s Family',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- 3. Create an adult_profiles record for this parent
  INSERT INTO public.adult_profiles (user_id, family_id, role, name, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.id, -- family_id = user_id for parents
    'parent',
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, family_id, role) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- STEP 2: Backfill existing parents who are missing records
-- =====================================================
-- Create families for existing parents who don't have one
INSERT INTO public.families (id, invite_code, household_type, name, created_at)
SELECT 
  p.id,
  COALESCE(p.family_code, 'FAM-' || SUBSTRING(p.id::text, 1, 8)),
  'single',
  COALESCE(p.name, '') || '''s Family',
  COALESCE(p.created_at, NOW())
FROM public.parents p
WHERE NOT EXISTS (
  SELECT 1 FROM public.families f WHERE f.id = p.id
)
ON CONFLICT (id) DO NOTHING;

-- Create adult_profiles for existing parents who don't have one
INSERT INTO public.adult_profiles (user_id, family_id, role, name, email, created_at, updated_at)
SELECT 
  p.id as user_id,
  p.id as family_id,
  'parent' as role,
  COALESCE(p.name, '') as name,
  COALESCE(p.email, '') as email,
  COALESCE(p.created_at, NOW()) as created_at,
  NOW() as updated_at
FROM public.parents p
WHERE NOT EXISTS (
  SELECT 1 FROM public.adult_profiles ap 
  WHERE ap.user_id = p.id AND ap.role = 'parent'
)
ON CONFLICT (user_id, family_id, role) DO NOTHING;

-- =====================================================
-- STEP 3: Ensure RLS policy allows updating families
-- =====================================================
-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update their own family." ON public.families;

-- Create update policy for families
CREATE POLICY "Users can update their own family."
  ON public.families FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = families.id
        AND ap.role = 'parent'
    )
    OR families.id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = families.id
        AND ap.role = 'parent'
    )
    OR families.id = auth.uid()
  );

-- =====================================================
-- STEP 4: Verify the migration
-- =====================================================
DO $$
DECLARE
  v_parents_without_families INT;
  v_parents_without_profiles INT;
BEGIN
  -- Count parents without families
  SELECT COUNT(*) INTO v_parents_without_families
  FROM public.parents p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.families f WHERE f.id = p.id
  );
  
  -- Count parents without adult_profiles
  SELECT COUNT(*) INTO v_parents_without_profiles
  FROM public.parents p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.adult_profiles ap 
    WHERE ap.user_id = p.id AND ap.role = 'parent'
  );
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  Parents without families: %', v_parents_without_families;
  RAISE NOTICE '  Parents without adult_profiles: %', v_parents_without_profiles;
  
  IF v_parents_without_families > 0 OR v_parents_without_profiles > 0 THEN
    RAISE WARNING 'Some parents are still missing records. Please investigate.';
  END IF;
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- Now when a parent signs up:
-- 1. parents record is created (existing behavior)
-- 2. families record is created with id = user_id
-- 3. adult_profiles record is created with role = 'parent' and family_id = user_id
--
-- The FamilySetupSelection component can now successfully:
-- 1. Query adult_profiles to get family_id
-- 2. Update families.household_type


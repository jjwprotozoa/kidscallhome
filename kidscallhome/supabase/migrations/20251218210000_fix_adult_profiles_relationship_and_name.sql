-- Migration: Fix adult_profiles relationship_type and name handling
-- Purpose: Ensure relationship_type and name are properly synced from family_members to adult_profiles
-- Date: 2025-12-18
-- 
-- Issue: The ON CONFLICT clause in handle_new_family_member() and link_family_member_to_auth_user()
--        only updates updated_at, not relationship_type or name. This means if an adult_profiles
--        record exists without proper data, it won't get the relationship info.
--
-- Fix: 
-- 1. Update handle_new_family_member to properly update relationship_type and name on conflict
-- 2. Update link_family_member_to_auth_user to properly update relationship_type and name on conflict
-- 3. Backfill existing adult_profiles records with missing relationship_type/name from family_members

-- =====================================================
-- STEP 1: Update handle_new_family_member function
-- =====================================================
-- This trigger fires when a new user is created in auth.users
-- If they have an invitation_token, we activate their family_member record
-- and create/update their adult_profiles record with full data

CREATE OR REPLACE FUNCTION public.handle_new_family_member()
RETURNS TRIGGER AS $$
DECLARE
  invitation_record RECORD;
  v_adult_profile_id UUID;
BEGIN
  -- Check if this user was invited (has invitation_token in metadata)
  IF NEW.raw_user_meta_data->>'invitation_token' IS NOT NULL THEN
    -- Find the invitation
    SELECT * INTO invitation_record
    FROM public.family_members
    WHERE invitation_token::text = NEW.raw_user_meta_data->>'invitation_token'
    AND status = 'pending';
    
    -- If invitation found, activate the family member and create adult_profiles
    IF FOUND THEN
      -- Update family_members record
      UPDATE public.family_members
      SET 
        id = NEW.id,
        invitation_accepted_at = NOW(),
        status = 'active',
        updated_at = NOW()
      WHERE invitation_token::text = NEW.raw_user_meta_data->>'invitation_token';
      
      -- Create adult_profiles record for this family member
      -- FIXED: On conflict, also update relationship_type and name
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
        invitation_record.parent_id, -- family_id is the parent_id
        'family_member',
        invitation_record.relationship,
        invitation_record.name,
        invitation_record.email
      )
      ON CONFLICT (user_id, family_id, role)
      DO UPDATE SET
        relationship_type = EXCLUDED.relationship_type,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- STEP 2: Update link_family_member_to_auth_user function
-- =====================================================
-- This RPC function is called from the frontend during registration
-- when the direct update fails due to RLS

CREATE OR REPLACE FUNCTION public.link_family_member_to_auth_user(
  p_invitation_token UUID,
  p_auth_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_family_member RECORD;
  v_adult_profile_id UUID;
BEGIN
  -- Find the invitation
  SELECT * INTO v_family_member
  FROM public.family_members
  WHERE invitation_token = p_invitation_token
  AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invitation token'
    );
  END IF;

  -- Check if already linked
  IF v_family_member.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already linked',
      'family_member_id', v_family_member.id
    );
  END IF;

  -- Update the family member record
  UPDATE public.family_members
  SET 
    id = p_auth_user_id,
    status = 'active',
    invitation_accepted_at = NOW(),
    updated_at = NOW()
  WHERE invitation_token = p_invitation_token;

  -- Create adult_profiles record
  -- FIXED: On conflict, also update relationship_type and name
  INSERT INTO public.adult_profiles (
    user_id,
    family_id,
    role,
    relationship_type,
    name,
    email
  )
  VALUES (
    p_auth_user_id,
    v_family_member.parent_id, -- family_id is the parent_id
    'family_member',
    v_family_member.relationship,
    v_family_member.name,
    v_family_member.email
  )
  ON CONFLICT (user_id, family_id, role)
  DO UPDATE SET
    relationship_type = EXCLUDED.relationship_type,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = NOW()
  RETURNING id INTO v_adult_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Family member linked successfully',
    'family_member_id', p_auth_user_id,
    'adult_profile_id', v_adult_profile_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- STEP 3: Backfill existing adult_profiles records
-- =====================================================
-- Update adult_profiles records where relationship_type or name is NULL
-- with data from the corresponding family_members record

UPDATE public.adult_profiles ap
SET 
  relationship_type = fm.relationship,
  name = COALESCE(ap.name, fm.name),
  updated_at = NOW()
FROM public.family_members fm
WHERE ap.user_id = fm.id
  AND ap.family_id = fm.parent_id
  AND ap.role = 'family_member'
  AND fm.status = 'active'
  AND (
    ap.relationship_type IS NULL 
    OR ap.relationship_type = ''
    OR ap.name IS NULL 
    OR ap.name = ''
  );

-- Also sync any mismatched relationship_types (in case family_members has correct data)
UPDATE public.adult_profiles ap
SET 
  relationship_type = fm.relationship,
  updated_at = NOW()
FROM public.family_members fm
WHERE ap.user_id = fm.id
  AND ap.family_id = fm.parent_id
  AND ap.role = 'family_member'
  AND fm.status = 'active'
  AND ap.relationship_type IS DISTINCT FROM fm.relationship;

-- =====================================================
-- STEP 4: Verify the migration
-- =====================================================
DO $$
DECLARE
  v_missing_relationship INT;
  v_missing_name INT;
  v_total_family_members INT;
BEGIN
  -- Count adult_profiles with missing relationship_type
  SELECT COUNT(*) INTO v_missing_relationship
  FROM public.adult_profiles
  WHERE role = 'family_member'
    AND (relationship_type IS NULL OR relationship_type = '');
  
  -- Count adult_profiles with missing name
  SELECT COUNT(*) INTO v_missing_name
  FROM public.adult_profiles
  WHERE role = 'family_member'
    AND (name IS NULL OR name = '');
  
  -- Count total family member profiles
  SELECT COUNT(*) INTO v_total_family_members
  FROM public.adult_profiles
  WHERE role = 'family_member';
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  Total family member profiles: %', v_total_family_members;
  RAISE NOTICE '  Missing relationship_type: %', v_missing_relationship;
  RAISE NOTICE '  Missing name: %', v_missing_name;
  
  IF v_missing_relationship > 0 OR v_missing_name > 0 THEN
    RAISE WARNING 'Some adult_profiles still have missing data. Check family_members table for corresponding records.';
  END IF;
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- Now:
-- 1. handle_new_family_member trigger properly updates relationship_type and name on conflict
-- 2. link_family_member_to_auth_user RPC properly updates relationship_type and name on conflict
-- 3. Existing adult_profiles records are backfilled with data from family_members
--
-- The relationship_type values are: grandparent, aunt, uncle, cousin, other
-- These match the constraint on both adult_profiles and family_members tables


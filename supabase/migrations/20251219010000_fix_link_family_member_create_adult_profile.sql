-- Migration: Fix link_family_member_by_email to also create adult_profiles
-- Purpose: Ensure family members get adult_profiles record when linked during login
-- Date: 2025-12-19
-- 
-- Issue: When a family member clicks the verification email and tries to log in:
--   1. The on_family_member_signup trigger should create family_members link + adult_profiles
--   2. But the trigger may not exist or not fire properly on the remote database
--   3. The fallback link_family_member_by_email RPC only updates family_members
--   4. No adult_profiles record is created, causing subsequent failures
--
-- Fix: Update link_family_member_by_email to also create the adult_profiles record

-- =====================================================
-- STEP 1: Update link_family_member_by_email function
-- =====================================================
-- This function runs with elevated privileges to update the family_members record
-- AND create the adult_profiles record when a user logs in

CREATE OR REPLACE FUNCTION public.link_family_member_by_email(
  p_email TEXT,
  p_auth_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_member RECORD;
  v_adult_profile_id UUID;
  v_result JSONB;
BEGIN
  -- Find the family member by email
  SELECT * INTO v_family_member
  FROM public.family_members
  WHERE LOWER(email) = LOWER(p_email)
  AND (id IS NULL OR id = p_auth_user_id);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Family member not found with this email'
    );
  END IF;
  
  -- Check if already linked to the correct user
  IF v_family_member.id = p_auth_user_id THEN
    -- Already linked, but ensure adult_profiles exists
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
      'message', 'Already linked',
      'family_member_id', v_family_member.id,
      'adult_profile_id', v_adult_profile_id,
      'status', v_family_member.status
    );
  END IF;
  
  -- Check if linked to a different user
  IF v_family_member.id IS NOT NULL AND v_family_member.id != p_auth_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This email is already linked to a different account'
    );
  END IF;
  
  -- Update the family member record to link it to the auth user
  UPDATE public.family_members
  SET 
    id = p_auth_user_id,
    status = 'active',
    invitation_accepted_at = COALESCE(invitation_accepted_at, NOW()),
    updated_at = NOW()
  WHERE LOWER(email) = LOWER(p_email)
  AND id IS NULL;
  
  -- Verify the update succeeded
  SELECT * INTO v_family_member
  FROM public.family_members
  WHERE id = p_auth_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to link family member record'
    );
  END IF;
  
  -- Create adult_profiles record for this family member
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
    'adult_profile_id', v_adult_profile_id,
    'status', v_family_member.status
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.link_family_member_by_email(TEXT, UUID) TO authenticated;

-- =====================================================
-- STEP 2: Ensure the on_family_member_signup trigger exists
-- =====================================================
-- Recreate the trigger on auth.users to ensure it fires on new signups
-- This is the primary mechanism for linking family members

-- First, ensure the handle_new_family_member function is up to date
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

-- Recreate the trigger (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS on_family_member_signup ON auth.users;

CREATE TRIGGER on_family_member_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'invitation_token' IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_family_member();

-- =====================================================
-- STEP 3: Fix existing unlinked family members
-- =====================================================
-- For family members who have verified their email but aren't linked,
-- we need to manually link them. This requires knowing the auth.users email.

-- Create a helper function to fix a specific family member by email
-- This can be called by an admin to fix stuck accounts
CREATE OR REPLACE FUNCTION public.admin_fix_family_member_by_email(
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user RECORD;
  v_family_member RECORD;
  v_adult_profile_id UUID;
BEGIN
  -- Find the auth user by email
  SELECT id, email INTO v_auth_user
  FROM auth.users
  WHERE LOWER(email) = LOWER(p_email);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No auth user found with this email'
    );
  END IF;
  
  -- Find the family member by email
  SELECT * INTO v_family_member
  FROM public.family_members
  WHERE LOWER(email) = LOWER(p_email);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No family member invitation found with this email'
    );
  END IF;
  
  -- Check if already properly linked
  IF v_family_member.id = v_auth_user.id AND v_family_member.status = 'active' THEN
    -- Check if adult_profiles exists
    IF EXISTS (
      SELECT 1 FROM public.adult_profiles 
      WHERE user_id = v_auth_user.id 
      AND family_id = v_family_member.parent_id 
      AND role = 'family_member'
    ) THEN
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Family member already properly linked and has adult_profiles'
      );
    END IF;
  END IF;
  
  -- Link the family member
  UPDATE public.family_members
  SET 
    id = v_auth_user.id,
    status = 'active',
    invitation_accepted_at = COALESCE(invitation_accepted_at, NOW()),
    updated_at = NOW()
  WHERE LOWER(email) = LOWER(p_email);
  
  -- Create/update adult_profiles
  INSERT INTO public.adult_profiles (
    user_id,
    family_id,
    role,
    relationship_type,
    name,
    email
  )
  VALUES (
    v_auth_user.id,
    v_family_member.parent_id,
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
    'message', 'Family member fixed successfully',
    'auth_user_id', v_auth_user.id,
    'family_member_parent_id', v_family_member.parent_id,
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

-- Grant to service_role only (admin function)
REVOKE ALL ON FUNCTION public.admin_fix_family_member_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_fix_family_member_by_email(TEXT) TO service_role;

-- =====================================================
-- STEP 4: Fix missing RLS policies for adult_profiles
-- =====================================================
-- Currently only "Children can view adult names from conversations" exists
-- We need policies for:
-- 1. Users to read their own adult_profiles record
-- 2. Family members in the same family to see each other

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view own adult profile" ON public.adult_profiles;
DROP POLICY IF EXISTS "Adults can view profiles in their family" ON public.adult_profiles;
DROP POLICY IF EXISTS "Users can update own adult profile" ON public.adult_profiles;

-- Policy 1: Authenticated users can read their own adult_profiles record
CREATE POLICY "Users can view own adult profile"
  ON public.adult_profiles FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Policy 2: Adults can view other profiles in the same family
-- This allows parents to see family members and vice versa
CREATE POLICY "Adults can view profiles in their family"
  ON public.adult_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (SELECT auth.uid())
        AND ap.family_id = adult_profiles.family_id
    )
  );

-- Policy 3: Users can update their own adult_profiles record
CREATE POLICY "Users can update own adult profile"
  ON public.adult_profiles FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Ensure RLS is enabled on adult_profiles
ALTER TABLE public.adult_profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ link_family_member_by_email now creates adult_profiles record
-- 2. ✅ Trigger on_family_member_signup is recreated to ensure it exists
-- 3. ✅ Admin function to fix stuck family members
-- 4. ✅ RLS policies for users to read their own adult_profiles
-- 5. ✅ RLS policies for family members to see each other
--
-- For the specific user mentioned (babretherton@gmail.com):
-- Run this in Supabase SQL editor:
--   SELECT admin_fix_family_member_by_email('babretherton@gmail.com');



-- Migration: Create adult_profiles when family member accepts invitation
-- Purpose: Ensure adult_profiles record is created when family member signs up
-- Date: 2025-12-07
-- This ensures new family members appear in child's family list and can have conversations

-- =====================================================
-- STEP 1: Update handle_new_family_member trigger to create adult_profiles
-- =====================================================

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
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- STEP 2: Also update link_family_member_to_auth_user function
-- =====================================================
-- This function is called from the frontend during registration

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
-- Migration complete
-- =====================================================
-- Now when a family member accepts an invitation and signs up:
-- 1. family_members record is updated with their auth user_id
-- 2. adult_profiles record is automatically created
-- 3. They can now appear in child's family list and have conversations


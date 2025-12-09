-- Migration: Fix family member registration linking
-- Purpose: Create a SECURITY DEFINER function to link auth users to family_members
-- Date: 2025-12-04
-- Issue: RLS policies block the update during registration because the new user
--        doesn't have permission to update family_members yet

-- =====================================================
-- STEP 1: Create function to link auth user to family member
-- =====================================================
-- This function runs with elevated privileges to update the family_members record
-- when a user accepts an invitation and creates an account

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

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Family member linked successfully',
    'family_member_id', p_auth_user_id
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
GRANT EXECUTE ON FUNCTION public.link_family_member_to_auth_user(UUID, UUID) TO authenticated;

-- Also allow the function to be called by newly authenticated users
GRANT EXECUTE ON FUNCTION public.link_family_member_to_auth_user(UUID, UUID) TO anon;

-- =====================================================
-- STEP 2: Update trigger to also try linking on user creation
-- =====================================================
-- This improves the existing trigger to handle the linking

CREATE OR REPLACE FUNCTION public.handle_new_family_member()
RETURNS TRIGGER AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Check if this user was invited (has invitation_token in metadata)
  IF NEW.raw_user_meta_data->>'invitation_token' IS NOT NULL THEN
    -- Find the invitation
    SELECT * INTO invitation_record
    FROM public.family_members
    WHERE invitation_token::text = NEW.raw_user_meta_data->>'invitation_token'
    AND status = 'pending';
    
    -- If invitation found, activate the family member
    IF FOUND THEN
      UPDATE public.family_members
      SET 
        id = NEW.id,
        invitation_accepted_at = NOW(),
        status = 'active',
        updated_at = NOW()
      WHERE invitation_token::text = NEW.raw_user_meta_data->>'invitation_token';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- STEP 3: Ensure trigger exists on auth.users
-- =====================================================
-- Drop and recreate to ensure it's using the updated function

DROP TRIGGER IF EXISTS on_family_member_signup ON auth.users;

CREATE TRIGGER on_family_member_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'invitation_token' IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_family_member();

-- =====================================================
-- STEP 4: Add comment for documentation
-- =====================================================
COMMENT ON FUNCTION public.link_family_member_to_auth_user IS 
'Links an authenticated user to their family_members record after accepting an invitation. 
Uses SECURITY DEFINER to bypass RLS restrictions during registration.';


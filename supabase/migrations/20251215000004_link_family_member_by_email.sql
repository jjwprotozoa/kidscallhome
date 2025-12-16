-- Migration: Link family member by email during login
-- Purpose: Allow family members to link their auth user id to their family_members record during login
-- Date: 2025-12-15
-- Issue: RLS blocks updating family_members.id when it's NULL because the policy checks id = auth.uid()
--        But if id is NULL, that check fails, so the update is blocked

-- =====================================================
-- STEP 1: Create function to link family member by email
-- =====================================================
-- This function runs with elevated privileges to update the family_members record
-- when a user logs in and their record has a NULL id

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
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already linked',
      'family_member_id', v_family_member.id
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
    status = CASE 
      WHEN status = 'pending' THEN 'active'
      ELSE status
    END,
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
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Family member linked successfully',
    'family_member_id', p_auth_user_id,
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
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ Allows family members to link their auth user id during login
-- 2. ✅ Handles the case where id is NULL (RLS blocks direct updates)
-- 3. ✅ Prevents linking to wrong accounts (checks if already linked)
-- 4. ✅ Automatically activates pending accounts when linking


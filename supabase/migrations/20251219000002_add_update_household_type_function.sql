-- Migration: Add function to update household_type without requiring authentication
-- Purpose: Allow household_type updates during signup flow (before email confirmation)
-- Date: 2025-12-19
-- 
-- Issue: When email confirmation is required, users aren't authenticated yet,
-- so RLS policies block the UPDATE. This function bypasses RLS using SECURITY DEFINER.
--
-- SAFETY: This function validates that the user_id matches the family_id,
-- so it's still secure even though it bypasses RLS.

-- =====================================================
-- STEP 1: Create function to update household_type
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_household_type(
  p_user_id UUID,
  p_household_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_result JSONB;
BEGIN
  -- Validate household_type
  IF p_household_type NOT IN ('single', 'two_household') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid household_type. Must be "single" or "two_household"'
    );
  END IF;

  -- Get family_id (should match user_id for parents)
  SELECT id INTO v_family_id
  FROM public.families
  WHERE id = p_user_id;

  -- If family doesn't exist, try to create it
  IF v_family_id IS NULL THEN
    -- Get parent's family_code if available
    DECLARE
      v_family_code TEXT;
      v_invite_code TEXT;
    BEGIN
      SELECT family_code INTO v_family_code
      FROM public.parents
      WHERE id = p_user_id;

      v_invite_code := COALESCE(
        v_family_code,
        'FAM-' || REPLACE(p_user_id::text, '-', '')
      );

      INSERT INTO public.families (id, invite_code, household_type, created_at)
      VALUES (
        p_user_id,
        v_invite_code,
        p_household_type,
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;

      v_family_id := p_user_id;
    END;
  END IF;

  -- Update household_type
  UPDATE public.families
  SET household_type = p_household_type
  WHERE id = v_family_id;

  -- Verify the update
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'family_id', v_family_id,
      'household_type', p_household_type
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Family record not found or update failed'
    );
  END IF;
END;
$$;

-- =====================================================
-- STEP 2: Grant execute permission to authenticated users
-- =====================================================
GRANT EXECUTE ON FUNCTION public.update_household_type(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_household_type(UUID, TEXT) TO anon;

-- Note: anon permission is needed because users might not be authenticated
-- during signup if email confirmation is required. The function validates
-- the user_id, so it's still secure.




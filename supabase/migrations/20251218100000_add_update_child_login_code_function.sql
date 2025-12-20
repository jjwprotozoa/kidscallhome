-- Migration: Add update_child_login_code RPC function
-- Purpose: Allows parents to update their child's login code with proper security
-- Date: 2025-12-18

-- Create a SECURITY DEFINER function to update child login code
-- This bypasses RLS and performs permission check internally
CREATE OR REPLACE FUNCTION public.update_child_login_code(
  p_child_id UUID,
  p_new_code TEXT
)
RETURNS TABLE(success BOOLEAN, login_code TEXT, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
  v_current_user_id UUID;
BEGIN
  -- Get current user ID
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Not authenticated'::TEXT;
    RETURN;
  END IF;
  
  -- Check if the child exists and get their parent_id
  SELECT parent_id INTO v_parent_id
  FROM public.children
  WHERE id = p_child_id;
  
  IF v_parent_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Child not found'::TEXT;
    RETURN;
  END IF;
  
  -- Check if the current user is the parent
  IF v_parent_id != v_current_user_id THEN
    RETURN QUERY SELECT false, NULL::TEXT, 
      format('Permission denied: child belongs to %s, not %s', v_parent_id, v_current_user_id)::TEXT;
    RETURN;
  END IF;
  
  -- Perform the update
  UPDATE public.children
  SET login_code = p_new_code
  WHERE id = p_child_id
    AND parent_id = v_current_user_id;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Update failed - no rows affected'::TEXT;
    RETURN;
  END IF;
  
  -- Return success with the new code
  RETURN QUERY SELECT true, p_new_code, NULL::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_child_login_code(UUID, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.update_child_login_code IS 'Updates a child''s login code. Parents can only update their own children.';


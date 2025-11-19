-- Migration: Fix Cancelled Subscription Access
-- Purpose: Allow cancelled subscriptions to continue working until expiration date
-- Issue: can_add_child function only checked for 'active' status, but cancelled
--        subscriptions should still allow adding children until they expire

-- Update can_add_child function to allow cancelled subscriptions until expiration
CREATE OR REPLACE FUNCTION public.can_add_child(
  p_parent_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_children INTEGER;
  v_current_children INTEGER;
  v_subscription_status TEXT;
  v_subscription_expires_at TIMESTAMPTZ;
BEGIN
  -- Get subscription info
  SELECT 
    COALESCE(allowed_children, 1),
    subscription_status,
    subscription_expires_at
  INTO 
    v_allowed_children,
    v_subscription_status,
    v_subscription_expires_at
  FROM public.parents
  WHERE id = p_parent_id;
  
  -- Get current children count
  SELECT COUNT(*) INTO v_current_children
  FROM public.children
  WHERE parent_id = p_parent_id;
  
  -- Check if subscription is active OR cancelled but not expired
  -- Cancelled subscriptions should continue working until expiration
  IF (v_subscription_status = 'active' OR v_subscription_status = 'cancelled') 
     AND (v_subscription_expires_at IS NULL OR v_subscription_expires_at > NOW()) THEN
    -- For unlimited plans (allowed_children = -1 or very high number)
    IF v_allowed_children = -1 OR v_allowed_children >= 999 THEN
      RETURN TRUE;
    END IF;
    
    -- Check if under limit
    RETURN v_current_children < v_allowed_children;
  END IF;
  
  -- Default free tier: 1 child (for expired, inactive, or no subscription)
  RETURN v_current_children < 1;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.can_add_child(UUID) TO authenticated;


-- ============================================
-- FIX: Allow Cancelled Subscriptions Until Expiration
-- ============================================
-- Run this in Supabase SQL Editor to fix the subscription limit issue
-- 
-- Problem: Cancelled subscriptions were being treated as expired immediately
-- Solution: Allow cancelled subscriptions to work until expiration date
-- ============================================

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

-- ============================================
-- VERIFY: Test the function (replace with your parent_id)
-- ============================================
-- Uncomment the line below and replace with your actual parent_id to test:
-- SELECT public.can_add_child('70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid);
-- 
-- Expected result: TRUE (since you have 4 children, allowed_children = 5, 
--                        status = 'cancelled', expires_at = '2025-12-17')
-- ============================================


-- Migration: Subscription System
-- Purpose: Track subscription tiers and allowed children limits for family accounts

-- Step 1: Add subscription columns to parents table
ALTER TABLE public.parents 
ADD COLUMN IF NOT EXISTS allowed_children INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- Step 2: Create index for subscription queries
CREATE INDEX IF NOT EXISTS idx_parents_subscription_status ON public.parents(subscription_status);
CREATE INDEX IF NOT EXISTS idx_parents_subscription_type ON public.parents(subscription_type);

-- Step 3: Create function to upgrade family subscription
CREATE OR REPLACE FUNCTION public.upgrade_family_subscription(
  p_family_email TEXT,
  p_subscription_type TEXT,
  p_allowed_children INTEGER,
  p_stripe_payment_link_id TEXT DEFAULT NULL,
  p_stripe_checkout_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
  v_current_children_count INTEGER;
BEGIN
  -- Find parent by email
  SELECT id INTO v_parent_id
  FROM public.parents
  WHERE email = p_family_email;
  
  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Family account not found with email: ' || p_family_email
    );
  END IF;
  
  -- Update subscription
  UPDATE public.parents
  SET 
    subscription_type = p_subscription_type,
    allowed_children = p_allowed_children,
    subscription_status = 'active',
    subscription_started_at = COALESCE(subscription_started_at, NOW()),
    subscription_expires_at = CASE 
      WHEN p_subscription_type LIKE '%annual%' OR p_subscription_type LIKE '%year%' THEN NOW() + INTERVAL '1 year'
      WHEN p_subscription_type LIKE '%month%' THEN NOW() + INTERVAL '1 month'
      ELSE NULL
    END,
    stripe_payment_link_id = COALESCE(p_stripe_payment_link_id, stripe_payment_link_id),
    stripe_checkout_session_id = COALESCE(p_stripe_checkout_session_id, stripe_checkout_session_id)
  WHERE id = v_parent_id;
  
  -- Get current child count
  SELECT COUNT(*) INTO v_current_children_count
  FROM public.children
  WHERE parent_id = v_parent_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'parent_id', v_parent_id,
    'subscription_type', p_subscription_type,
    'allowed_children', p_allowed_children,
    'current_children_count', v_current_children_count
  );
END;
$$;

-- Step 4: Create function to check if parent can add more children
CREATE OR REPLACE FUNCTION public.can_add_child(p_parent_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_children INTEGER;
  v_current_children INTEGER;
BEGIN
  -- Get allowed children count (default to 1 if null)
  SELECT COALESCE(allowed_children, 1) INTO v_allowed_children
  FROM public.parents
  WHERE id = p_parent_id;
  
  -- Get current children count
  SELECT COUNT(*) INTO v_current_children
  FROM public.children
  WHERE parent_id = p_parent_id;
  
  -- Check if subscription is active
  IF EXISTS (
    SELECT 1 FROM public.parents
    WHERE id = p_parent_id
    AND subscription_status = 'active'
    AND (subscription_expires_at IS NULL OR subscription_expires_at > NOW())
  ) THEN
    -- For unlimited plans (allowed_children = -1 or very high number)
    IF v_allowed_children = -1 OR v_allowed_children >= 999 THEN
      RETURN TRUE;
    END IF;
    
    -- Check if under limit
    RETURN v_current_children < v_allowed_children;
  END IF;
  
  -- Default free tier: 1 child
  RETURN v_current_children < 1;
END;
$$;

-- Step 5: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.upgrade_family_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_child TO authenticated;

-- Step 6: Add RLS policy for subscription functions (if needed)
-- Note: Functions use SECURITY DEFINER, so they run with creator privileges


-- Migration: Fix upgrade_family_subscription function overload conflict
-- Purpose: Drop old function signatures and create unified function

-- Step 1: Drop all existing versions of the function
DROP FUNCTION IF EXISTS public.upgrade_family_subscription(TEXT, TEXT, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.upgrade_family_subscription(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.upgrade_family_subscription(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT);

-- Step 2: Create unified function that handles all cases
CREATE OR REPLACE FUNCTION public.upgrade_family_subscription(
  p_family_email TEXT,
  p_subscription_type TEXT,
  p_allowed_children INTEGER,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL,
  p_stripe_price_id TEXT DEFAULT NULL,
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
  v_authenticated_user_id UUID;
  v_session_already_used BOOLEAN;
  v_has_stripe_price_id BOOLEAN;
  v_update_sql TEXT;
BEGIN
  -- Get authenticated user ID
  v_authenticated_user_id := auth.uid();
  
  IF v_authenticated_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;
  
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
  
  -- SECURITY: Verify the email matches the authenticated user
  IF v_parent_id != v_authenticated_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only upgrade your own account. Email must match your authenticated account.'
    );
  END IF;
  
  -- SECURITY: Check if Stripe checkout session has already been used (if provided)
  IF p_stripe_checkout_session_id IS NOT NULL THEN
    -- Check if table exists (might not exist if migration 20250122000008 hasn't run)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'stripe_checkout_sessions'
    ) THEN
      SELECT EXISTS(
        SELECT 1 FROM public.stripe_checkout_sessions
        WHERE checkout_session_id = p_stripe_checkout_session_id
      ) INTO v_session_already_used;
      
      IF v_session_already_used THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'This payment has already been processed. Each payment can only be used once.'
        );
      END IF;
    END IF;
  END IF;
  
  -- Update subscription with all Stripe details
  -- Check if stripe_price_id column exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'parents' 
    AND column_name = 'stripe_price_id'
  ) INTO v_has_stripe_price_id;
  
  -- Update subscription (conditionally include stripe_price_id)
  IF v_has_stripe_price_id THEN
    -- Column exists - update with stripe_price_id
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
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
      stripe_price_id = COALESCE(p_stripe_price_id, stripe_price_id),
      stripe_payment_link_id = COALESCE(p_stripe_payment_link_id, stripe_payment_link_id),
      stripe_checkout_session_id = COALESCE(p_stripe_checkout_session_id, stripe_checkout_session_id)
    WHERE id = v_parent_id;
  ELSE
    -- Column doesn't exist - update without stripe_price_id
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
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
      stripe_payment_link_id = COALESCE(p_stripe_payment_link_id, stripe_payment_link_id),
      stripe_checkout_session_id = COALESCE(p_stripe_checkout_session_id, stripe_checkout_session_id)
    WHERE id = v_parent_id;
  END IF;
  
  -- Record the checkout session as used (if provided and table exists)
  IF p_stripe_checkout_session_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'stripe_checkout_sessions'
    ) THEN
      INSERT INTO public.stripe_checkout_sessions (
        checkout_session_id,
        parent_id,
        subscription_type
      ) VALUES (
        p_stripe_checkout_session_id,
        v_parent_id,
        p_subscription_type
      ) ON CONFLICT (checkout_session_id) DO NOTHING;
    END IF;
  END IF;
  
  -- Get current child count
  SELECT COUNT(*) INTO v_current_children_count
  FROM public.children
  WHERE parent_id = v_parent_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'parent_id', v_parent_id,
    'subscription_type', p_subscription_type,
    'allowed_children', p_allowed_children,
    'current_children_count', v_current_children_count,
    'stripe_subscription_id', p_stripe_subscription_id,
    'stripe_customer_id', p_stripe_customer_id
  );
END;
$$;

-- Step 3: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.upgrade_family_subscription TO authenticated;

-- Step 4: Add comment
COMMENT ON FUNCTION public.upgrade_family_subscription IS 
'Unified function to upgrade family subscription. Handles both Payment Links and Subscriptions API. Accepts all Stripe-related parameters with defaults.';


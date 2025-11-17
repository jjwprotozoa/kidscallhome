-- Migration: Subscription Security & Anti-Fraud Measures
-- Purpose: Prevent subscription sharing and duplicate payment usage

-- Step 1: Create table to track used Stripe checkout sessions
CREATE TABLE IF NOT EXISTS public.stripe_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id TEXT NOT NULL UNIQUE,
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  subscription_type TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 2: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_checkout_id ON public.stripe_checkout_sessions(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_parent_id ON public.stripe_checkout_sessions(parent_id);

-- Step 3: Update upgrade function to verify authenticated user and prevent duplicate sessions
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
  v_authenticated_user_id UUID;
  v_session_already_used BOOLEAN;
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
  -- This prevents users from upgrading other accounts
  IF v_parent_id != v_authenticated_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only upgrade your own account. Email must match your authenticated account.'
    );
  END IF;
  
  -- SECURITY: Check if Stripe checkout session has already been used
  IF p_stripe_checkout_session_id IS NOT NULL THEN
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
  
  -- Record the checkout session as used (if provided)
  IF p_stripe_checkout_session_id IS NOT NULL THEN
    INSERT INTO public.stripe_checkout_sessions (
      checkout_session_id,
      parent_id,
      subscription_type
    ) VALUES (
      p_stripe_checkout_session_id,
      v_parent_id,
      p_subscription_type
    );
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
    'current_children_count', v_current_children_count
  );
END;
$$;

-- Step 4: Enable RLS on stripe_checkout_sessions table
ALTER TABLE public.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policy - Parents can only view their own checkout sessions
CREATE POLICY "Parents can view own checkout sessions"
ON public.stripe_checkout_sessions
FOR SELECT
USING (parent_id = auth.uid());

-- Step 6: RLS Policy - Only service role can insert (via SECURITY DEFINER function)
-- The function handles inserts, so we don't need a policy for INSERT

-- Step 7: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.upgrade_family_subscription TO authenticated;

-- Step 8: Add comment explaining security measures
COMMENT ON FUNCTION public.upgrade_family_subscription IS 
'Securely upgrades family subscription. Verifies authenticated user matches email, prevents duplicate checkout session usage, and records all transactions.';


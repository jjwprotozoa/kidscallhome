-- Migration: Migrate to Stripe Subscriptions API
-- Purpose: Update schema to support Stripe Subscriptions instead of Payment Links

-- Step 1: Add Stripe Price IDs for each plan (you'll need to create these in Stripe Dashboard)
-- These will be stored in application config, but we add columns for reference
ALTER TABLE public.parents 
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Step 2: Create index for Stripe subscription lookups
CREATE INDEX IF NOT EXISTS idx_parents_stripe_subscription_id ON public.parents(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parents_stripe_customer_id ON public.parents(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Step 3: Update upgrade function to accept Stripe subscription details
CREATE OR REPLACE FUNCTION public.upgrade_family_subscription(
  p_family_email TEXT,
  p_subscription_type TEXT,
  p_allowed_children INTEGER,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL,
  p_stripe_price_id TEXT DEFAULT NULL
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
  
  -- Update subscription with Stripe details
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
    stripe_price_id = COALESCE(p_stripe_price_id, stripe_price_id)
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
    'current_children_count', v_current_children_count,
    'stripe_subscription_id', p_stripe_subscription_id
  );
END;
$$;

-- Step 4: Update cancel_subscription to cancel Stripe subscription
CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_parent_id UUID,
  p_cancel_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stripe_subscription_id TEXT;
BEGIN
  -- Verify authenticated user matches parent_id
  IF auth.uid() != p_parent_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only cancel your own subscription'
    );
  END IF;
  
  -- Get Stripe subscription ID
  SELECT stripe_subscription_id INTO v_stripe_subscription_id
  FROM public.parents
  WHERE id = p_parent_id;
  
  -- Cancel subscription (set status to cancelled, keep until expiration)
  UPDATE public.parents
  SET 
    subscription_status = 'cancelled',
    subscription_cancelled_at = NOW(),
    subscription_cancel_reason = p_cancel_reason
  WHERE id = p_parent_id
  AND subscription_status = 'active'
  AND subscription_type != 'free';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active subscription found to cancel'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'parent_id', p_parent_id,
    'subscription_status', 'cancelled',
    'stripe_subscription_id', v_stripe_subscription_id,
    'message', 'Subscription cancelled. Access will continue until expiration date. Stripe subscription will be cancelled at period end.',
    'note', 'Call Stripe API to cancel subscription: DELETE /v1/subscriptions/' || v_stripe_subscription_id || '?cancel_at_period_end=true'
  );
END;
$$;

-- Step 5: Create function to sync subscription from Stripe webhook
CREATE OR REPLACE FUNCTION public.sync_stripe_subscription(
  p_stripe_subscription_id TEXT,
  p_stripe_customer_id TEXT,
  p_subscription_status TEXT,
  p_current_period_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
BEGIN
  -- Find parent by Stripe customer ID or subscription ID
  SELECT id INTO v_parent_id
  FROM public.parents
  WHERE stripe_customer_id = p_stripe_customer_id
     OR stripe_subscription_id = p_stripe_subscription_id
  LIMIT 1;
  
  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Parent not found for Stripe customer/subscription'
    );
  END IF;
  
  -- Update subscription status based on Stripe webhook
  -- Map all Stripe subscription statuses properly
  UPDATE public.parents
  SET 
    subscription_status = CASE 
      WHEN p_subscription_status = 'trialing' THEN 'active' -- Allow access during trial
      WHEN p_subscription_status = 'active' THEN 'active'
      WHEN p_subscription_status = 'incomplete' THEN 'incomplete' -- Payment pending
      WHEN p_subscription_status = 'incomplete_expired' THEN 'expired' -- Payment failed after 23h
      WHEN p_subscription_status = 'past_due' THEN 'active' -- Keep access, payment retrying
      WHEN p_subscription_status = 'canceled' THEN 'cancelled'
      WHEN p_subscription_status = 'unpaid' THEN 'expired' -- Payment failed, revoke access
      WHEN p_subscription_status = 'paused' THEN 'active' -- Allow access during pause
      ELSE 'expired'
    END,
    subscription_expires_at = p_current_period_end,
    stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
    stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id)
  WHERE id = v_parent_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'parent_id', v_parent_id,
    'subscription_status', p_subscription_status
  );
END;
$$;

-- Step 6: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.upgrade_family_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription TO authenticated;
-- Note: sync_stripe_subscription should only be called from webhook (service role)

COMMENT ON FUNCTION public.sync_stripe_subscription IS 
'Syncs subscription status from Stripe webhook events. Should only be called from secure webhook endpoint.';


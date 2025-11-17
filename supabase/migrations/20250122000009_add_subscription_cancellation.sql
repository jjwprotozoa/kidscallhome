-- Migration: Subscription Cancellation & Expiration
-- Purpose: Add cancellation functionality and automatic expiration handling

-- Step 1: Add cancellation tracking columns
ALTER TABLE public.parents 
ADD COLUMN IF NOT EXISTS subscription_cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_cancel_reason TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Step 2: Create index for cancellation queries
CREATE INDEX IF NOT EXISTS idx_parents_subscription_cancelled ON public.parents(subscription_cancelled_at) WHERE subscription_cancelled_at IS NOT NULL;

-- Step 3: Create function to cancel subscription
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
  v_current_children_count INTEGER;
  v_allowed_children INTEGER;
BEGIN
  -- Verify authenticated user matches parent_id
  IF auth.uid() != p_parent_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only cancel your own subscription'
    );
  END IF;
  
  -- Get current subscription info
  SELECT allowed_children INTO v_allowed_children
  FROM public.parents
  WHERE id = p_parent_id;
  
  -- Get current children count
  SELECT COUNT(*) INTO v_current_children_count
  FROM public.children
  WHERE parent_id = p_parent_id;
  
  -- Cancel subscription (set status to cancelled, keep until expiration)
  UPDATE public.parents
  SET 
    subscription_status = 'cancelled',
    subscription_cancelled_at = NOW(),
    subscription_cancel_reason = p_cancel_reason
  WHERE id = p_parent_id
  AND subscription_status = 'active'
  AND subscription_type != 'free';
  
  -- Check if update succeeded
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
    'current_children_count', v_current_children_count,
    'allowed_children', v_allowed_children,
    'message', 'Subscription cancelled. Access will continue until expiration date.'
  );
END;
$$;

-- Step 4: Create function to handle expired subscriptions (run via cron or scheduled job)
CREATE OR REPLACE FUNCTION public.process_expired_subscriptions()
RETURNS TABLE(
  parent_id UUID,
  subscription_type TEXT,
  children_count INTEGER,
  action_taken TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_record RECORD;
  v_current_children INTEGER;
  v_new_allowed_children INTEGER;
BEGIN
  -- Find subscriptions that have expired
  FOR v_parent_record IN
    SELECT id, subscription_type, allowed_children
    FROM public.parents
    WHERE subscription_status IN ('active', 'cancelled')
    AND subscription_expires_at IS NOT NULL
    AND subscription_expires_at < NOW()
    AND subscription_type != 'free'
  LOOP
    -- Get current children count
    SELECT COUNT(*) INTO v_current_children
    FROM public.children
    WHERE parent_id = v_parent_record.id;
    
    -- Determine new allowed children (revert to free tier: 1 child)
    -- If they have more than 1 child, keep current count but set limit to 1
    -- They won't be able to add more until they upgrade
    v_new_allowed_children := 1;
    
    -- Update subscription to expired/free tier
    UPDATE public.parents
    SET 
      subscription_status = 'expired',
      subscription_type = 'free',
      allowed_children = v_new_allowed_children
    WHERE id = v_parent_record.id;
    
    -- Return result
    parent_id := v_parent_record.id;
    subscription_type := v_parent_record.subscription_type;
    children_count := v_current_children;
    action_taken := CASE 
      WHEN v_current_children > 1 THEN 
        'Reverted to free tier (1 child limit). ' || v_current_children || ' children exist but cannot add more.'
      ELSE 
        'Reverted to free tier (1 child limit).'
    END;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;

-- Step 5: Create function to reactivate subscription (if user resubscribes)
CREATE OR REPLACE FUNCTION public.reactivate_subscription(
  p_parent_id UUID,
  p_subscription_type TEXT,
  p_allowed_children INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify authenticated user
  IF auth.uid() != p_parent_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only reactivate your own subscription'
    );
  END IF;
  
  -- Reactivate subscription
  UPDATE public.parents
  SET 
    subscription_type = p_subscription_type,
    allowed_children = p_allowed_children,
    subscription_status = 'active',
    subscription_cancelled_at = NULL,
    subscription_cancel_reason = NULL,
    subscription_started_at = COALESCE(subscription_started_at, NOW()),
    subscription_expires_at = CASE 
      WHEN p_subscription_type LIKE '%annual%' OR p_subscription_type LIKE '%year%' THEN NOW() + INTERVAL '1 year'
      WHEN p_subscription_type LIKE '%month%' THEN NOW() + INTERVAL '1 month'
      ELSE NULL
    END
  WHERE id = p_parent_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'parent_id', p_parent_id,
    'subscription_type', p_subscription_type,
    'subscription_status', 'active'
  );
END;
$$;

-- Step 6: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.cancel_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_expired_subscriptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_subscription TO authenticated;

-- Step 7: Add comment explaining cancellation flow
COMMENT ON FUNCTION public.cancel_subscription IS 
'Cancels an active subscription. Subscription remains active until expiration date. User retains access until then.';

COMMENT ON FUNCTION public.process_expired_subscriptions IS 
'Processes expired subscriptions and reverts to free tier. Should be run via cron job or scheduled task.';


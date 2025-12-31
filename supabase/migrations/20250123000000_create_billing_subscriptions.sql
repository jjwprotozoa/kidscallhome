-- Migration: Create billing_subscriptions table
-- Purpose: Store Stripe subscription linkage and state, separate from parents table
-- Date: 2025-01-23

-- Create billing_subscriptions table
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_id ON public.billing_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_stripe_customer_id ON public.billing_subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_stripe_subscription_id ON public.billing_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON public.billing_subscriptions(status);

-- Enable RLS
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own subscription
CREATE POLICY "Users can read their own subscription"
  ON public.billing_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Note: No INSERT/UPDATE/DELETE policies needed
-- Service role (used by webhooks) bypasses RLS automatically
-- Authenticated users cannot write because there are no policies allowing it

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_billing_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_billing_subscriptions_updated_at();

-- Add comment
COMMENT ON TABLE public.billing_subscriptions IS 'Stores Stripe subscription linkage and state. Source of truth for access/entitlements. Updated by webhooks.';


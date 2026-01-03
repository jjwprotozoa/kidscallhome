-- Migration: Verify billing_subscriptions setup
-- Purpose: Ensure RLS policies are correct and table is ready for webhook writes
-- Date: 2025-01-23

-- Verify the SELECT policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'billing_subscriptions' 
    AND policyname = 'Users can read their own subscription'
  ) THEN
    CREATE POLICY "Users can read their own subscription"
      ON public.billing_subscriptions
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

-- Verify the trigger function exists
CREATE OR REPLACE FUNCTION public.update_billing_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Verify the trigger exists
DROP TRIGGER IF EXISTS update_billing_subscriptions_updated_at ON public.billing_subscriptions;
CREATE TRIGGER update_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_billing_subscriptions_updated_at();

-- Grant necessary permissions
-- Service role can write (bypasses RLS)
-- Authenticated users can only read their own (via RLS policy)

-- Add comment if missing
COMMENT ON TABLE public.billing_subscriptions IS 'Stores Stripe subscription linkage and state. Source of truth for access/entitlements. Updated by webhooks.';






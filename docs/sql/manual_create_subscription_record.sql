-- Manual Fix: Create billing_subscriptions record from Stripe subscription
-- Use this if the webhook didn't process the checkout.session.completed event
-- 
-- IMPORTANT: Run Step 1 FIRST to get your user_id, then copy it into Step 3
-- ============================================================================

-- Step 1: Get your user_id (replace email with your actual email)
-- RUN THIS FIRST and copy the user_id value
SELECT id as user_id, email 
FROM auth.users 
WHERE email = 'justwessels@gmail.com';  -- Replace with your email

-- Step 2: Get subscription details from Stripe Dashboard:
--   - Go to Stripe Dashboard → Customers → Find customer cus_ThqK6CG3isRyGe
--   - Click on the subscription
--   - Note down:
--     * Subscription ID (sub_...) - REQUIRED
--     * Price ID (price_...) - REQUIRED  
--     * Status (active, trialing, etc.) - REQUIRED
--     * Current period end date - REQUIRED

-- Step 3: Insert the record
-- ⚠️ REPLACE THE VALUES BELOW:
--   1. Replace 'YOUR_USER_ID_HERE' with the user_id from Step 1
--   2. Replace 'sub_...' with the subscription ID from Stripe
--   3. Replace 'price_...' with the price ID from Stripe (or use the test price below)
--   4. Replace the current_period_end date with the actual date from Stripe

INSERT INTO billing_subscriptions (
  user_id,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  status,
  current_period_end,
  cancel_at_period_end
) VALUES (
  'YOUR_USER_ID_HERE',  -- ⚠️ REPLACE: Copy user_id from Step 1 query result
  'cus_ThqK6CG3isRyGe',  -- Customer ID from Stripe (already filled)
  'sub_...',  -- ⚠️ REPLACE: Get from Stripe Dashboard → Subscriptions
  'price_1SjULhIIyqCwTeH2GmBL1jVk',  -- Test monthly price ID (or get exact from Stripe)
  'active',  -- Status from Stripe subscription (usually 'active' or 'trialing')
  (NOW() + INTERVAL '1 month')::timestamptz,  -- ⚠️ REPLACE: Get exact date from Stripe subscription
  false  -- cancel_at_period_end from Stripe (usually false)
) ON CONFLICT (user_id) DO UPDATE SET
  stripe_customer_id = EXCLUDED.stripe_customer_id,
  stripe_subscription_id = EXCLUDED.stripe_subscription_id,
  stripe_price_id = EXCLUDED.stripe_price_id,
  status = EXCLUDED.status,
  current_period_end = EXCLUDED.current_period_end,
  cancel_at_period_end = EXCLUDED.cancel_at_period_end,
  updated_at = NOW();

-- Step 4: Verify the record was created
-- Replace YOUR_USER_ID_HERE with your actual user_id
SELECT * FROM billing_subscriptions 
WHERE user_id = 'YOUR_USER_ID_HERE';


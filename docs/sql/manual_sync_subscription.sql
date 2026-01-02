-- docs/sql/manual_sync_subscription.sql
-- Purpose: Manually sync a subscription when webhook isn't working
-- Run this in Supabase SQL Editor

-- Step 1: Find your user_id
-- Replace 'your@email.com' with your actual email
SELECT id, email, stripe_customer_id 
FROM parents 
WHERE email = 'your@email.com';

-- Step 2: Check if billing_subscriptions record exists
-- Replace 'YOUR_USER_ID' with the id from Step 1
SELECT * FROM billing_subscriptions WHERE user_id = 'YOUR_USER_ID';

-- Step 3: If no record exists, INSERT one manually
-- Replace all values with your actual data from Stripe Dashboard
-- 
-- To get these values from Stripe:
-- 1. Go to Stripe Dashboard -> Customers -> Find your customer
-- 2. Click on the subscription to see subscription_id, price_id, etc.

INSERT INTO billing_subscriptions (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    status,
    current_period_end,
    cancel_at_period_end
) VALUES (
    'YOUR_USER_ID',           -- From Step 1
    'cus_xxxxx',              -- From Stripe Customer page
    'sub_xxxxx',              -- From Stripe Subscription page
    'price_1SUVdqIIyqCwTeH2zggZpPAK',  -- Monthly: price_1SUVdqIIyqCwTeH2zggZpPAK, Annual: price_1SkPL7IIyqCwTeH2tI9TxHRB
    'active',                 -- Status: active, cancelled, past_due, etc.
    '2026-02-01T00:00:00Z',   -- current_period_end from Stripe (convert Unix timestamp to ISO)
    false                     -- cancel_at_period_end from Stripe
)
ON CONFLICT (user_id) 
DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    stripe_price_id = EXCLUDED.stripe_price_id,
    status = EXCLUDED.status,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    updated_at = NOW();

-- Step 4: Verify the record was created/updated
SELECT * FROM billing_subscriptions WHERE user_id = 'YOUR_USER_ID';

-- After this, refresh the /parent/upgrade page - it should show your subscription!

-- ============================================
-- PRICE ID REFERENCE
-- ============================================
-- 
-- LIVE MODE:
--   Monthly: price_1SUVdqIIyqCwTeH2zggZpPAK
--   Annual:  price_1SkPL7IIyqCwTeH2tI9TxHRB
--
-- TEST MODE:
--   Monthly: price_1SjULhIIyqCwTeH2GmBL1jVk
--   Annual:  price_1SkQUaIIyqCwTeH2QowSbcfb
--
-- ============================================
-- TIMESTAMP CONVERSION
-- ============================================
-- Stripe gives Unix timestamps. To convert:
-- 
-- In JavaScript:
--   new Date(1735689600 * 1000).toISOString()
--   // -> "2025-01-01T00:00:00.000Z"
--
-- In SQL (PostgreSQL):
--   SELECT to_timestamp(1735689600)::timestamptz;
--   -- -> 2025-01-01 00:00:00+00


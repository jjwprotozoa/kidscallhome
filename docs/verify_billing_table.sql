-- Verify billing_subscriptions table exists and check current records
-- Run this in Supabase SQL Editor

-- 1. Check if table exists and see its structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'billing_subscriptions'
ORDER BY ordinal_position;

-- 2. Count current records
SELECT COUNT(*) as total_records FROM billing_subscriptions;

-- 3. List all current records (if any)
SELECT * FROM billing_subscriptions;

-- 4. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'billing_subscriptions';

-- 5. Get your user_id (replace with your email)
SELECT id, email 
FROM auth.users 
WHERE email = 'YOUR_EMAIL_HERE';

-- 6. Optional: Create a test record (for testing only)
-- Replace USER_ID_HERE with your actual user_id from step 5
/*
INSERT INTO billing_subscriptions (
  user_id,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  status,
  current_period_end,
  cancel_at_period_end
) VALUES (
  'USER_ID_HERE',  -- Get from step 5
  'cus_test_123',  -- Test customer ID
  'sub_test_123',  -- Test subscription ID
  'price_1SjULhIIyqCwTeH2GmBL1jVk',  -- Test monthly price ID
  'active',
  (NOW() + INTERVAL '1 month')::timestamptz,  -- 1 month from now
  false
) ON CONFLICT (user_id) DO UPDATE SET
  stripe_customer_id = EXCLUDED.stripe_customer_id,
  stripe_subscription_id = EXCLUDED.stripe_subscription_id,
  stripe_price_id = EXCLUDED.stripe_price_id,
  status = EXCLUDED.status,
  current_period_end = EXCLUDED.current_period_end;
*/


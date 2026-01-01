-- Verification Query: Check if update_device_login function exists with correct signature
-- Run this in Supabase SQL Editor after applying the migration

-- Check function exists
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as parameters,
  pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname = 'update_device_login';

-- Check country_code column exists
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'devices'
  AND column_name = 'country_code';

-- Expected results:
-- 1. Function should show 9 parameters: UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
-- 2. country_code column should exist with data_type = 'text'


-- Migration: Verify recipient_type column exists and has correct data
-- Purpose: Diagnostic query to verify the recipient_type migration was applied correctly
-- Date: 2025-12-17
--
-- Run this to check:
-- 1. Column exists
-- 2. Recent calls have recipient_type set
-- 3. Distribution of recipient_type values

-- Check if column exists
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'calls' 
  AND column_name = 'recipient_type';

-- Check recent calls and their recipient_type
SELECT 
  id,
  caller_type,
  recipient_type,
  parent_id,
  family_member_id,
  child_id,
  status,
  created_at
FROM calls
ORDER BY created_at DESC
LIMIT 10;

-- Count calls by recipient_type
SELECT 
  recipient_type,
  COUNT(*) as count
FROM calls
GROUP BY recipient_type;

-- Check for any NULL recipient_type (should be 0 after migration)
SELECT COUNT(*) as null_recipient_type_count
FROM calls
WHERE recipient_type IS NULL;


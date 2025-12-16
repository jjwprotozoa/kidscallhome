-- docs/sql/TEST_RATE_LIMITING.sql
-- Purpose: Test queries to verify rate limiting is working correctly
-- Run these queries in Supabase SQL Editor to verify functionality

-- ============================================
-- STEP 0: Get actual child IDs and IP addresses for testing
-- ============================================
-- First, let's find some actual child IDs to test with
SELECT 
  id as child_id,
  name,
  parent_id,
  created_at
FROM public.children
ORDER BY created_at DESC
LIMIT 5;

-- Get recent login attempts with IP addresses
SELECT DISTINCT
  ip_address,
  COUNT(*) as total_attempts,
  MAX(attempted_at) as last_attempt
FROM public.child_login_attempts
WHERE attempted_at > now() - interval '24 hours'
GROUP BY ip_address
ORDER BY last_attempt DESC
LIMIT 10;

-- ============================================
-- TEST 1: Check current message rate limit status for all children
-- ============================================
SELECT 
  c.name as child_name,
  c.id as child_id,
  rl.message_count,
  rl.window_start,
  now() - rl.window_start as time_elapsed,
  CASE 
    WHEN rl.message_count >= 100 THEN 'LIMIT EXCEEDED'
    ELSE 'OK'
  END as status
FROM public.child_message_rate_limits rl
JOIN public.children c ON c.id = rl.child_id
WHERE rl.window_start > now() - interval '24 hours'
ORDER BY rl.window_start DESC, rl.message_count DESC
LIMIT 20;

-- ============================================
-- TEST 1B: Check rate limit for a specific child (use ID from STEP 0)
-- ============================================
-- Replace the UUID below with an actual child ID from STEP 0
-- Example: WHERE child_id = '123e4567-e89b-12d3-a456-426614174000'::uuid
SELECT 
  child_id,
  message_count,
  window_start,
  now() - window_start as time_elapsed,
  100 - message_count as messages_remaining
FROM public.child_message_rate_limits
WHERE child_id = (SELECT id FROM public.children LIMIT 1)
ORDER BY window_start DESC
LIMIT 5;

-- ============================================
-- TEST 2: Test rate limit function directly for first child
-- ============================================
-- This should return true if under limit, false if over limit
SELECT 
  c.id as child_id,
  c.name,
  check_child_message_rate_limit(c.id, 100, 60) as rate_limit_ok,
  COALESCE(rl.message_count, 0) as current_count
FROM public.children c
LEFT JOIN public.child_message_rate_limits rl 
  ON rl.child_id = c.id 
  AND rl.window_start = date_trunc('hour', now())
ORDER BY c.created_at DESC
LIMIT 5;

-- ============================================
-- TEST 3: Check login attempts for all IPs (last hour)
-- ============================================
SELECT 
  ip_address,
  COUNT(*) as attempt_count,
  COUNT(*) FILTER (WHERE success = true) as successful_attempts,
  COUNT(*) FILTER (WHERE success = false) as failed_attempts,
  ROUND(
    (COUNT(*) FILTER (WHERE success = true)::numeric / COUNT(*)::numeric) * 100,
    2
  ) as success_rate_percent,
  MIN(attempted_at) as first_attempt,
  MAX(attempted_at) as last_attempt,
  CASE 
    WHEN COUNT(*) FILTER (WHERE success = false) >= 30 THEN 'RATE LIMITED'
    ELSE 'OK'
  END as status
FROM public.child_login_attempts
WHERE attempted_at > now() - interval '1 hour'
GROUP BY ip_address
ORDER BY failed_attempts DESC, last_attempt DESC;

-- ============================================
-- TEST 3B: Check login attempts for a specific IP (use IP from STEP 0)
-- ============================================
-- Replace the IP below with an actual IP from STEP 0
-- Example: WHERE ip_address = '192.168.1.1'::inet
SELECT 
  ip_address,
  COUNT(*) as attempt_count,
  COUNT(*) FILTER (WHERE success = true) as successful_attempts,
  COUNT(*) FILTER (WHERE success = false) as failed_attempts,
  MIN(attempted_at) as first_attempt,
  MAX(attempted_at) as last_attempt
FROM public.child_login_attempts
WHERE ip_address = (SELECT DISTINCT ip_address FROM public.child_login_attempts LIMIT 1)
  AND attempted_at > now() - interval '1 hour'
GROUP BY ip_address;

-- ============================================
-- TEST 4: Test login rate limit function for all recent IPs
-- ============================================
-- This should return true if under limit (30 attempts/hour), false if over
SELECT 
  ip_address,
  COUNT(*) FILTER (WHERE success = false) as failed_attempts,
  check_child_login_rate_limit(ip_address) as rate_limit_ok
FROM public.child_login_attempts
WHERE attempted_at > now() - interval '1 hour'
GROUP BY ip_address
ORDER BY failed_attempts DESC
LIMIT 10;

-- ============================================
-- TEST 5: Check for suspicious activity
-- ============================================
-- Detect children sending too many messages (>100/hour)
SELECT 
  c.name as child_name,
  c.id as child_id,
  issue,
  count as message_count
FROM detect_suspicious_child_activity() d
JOIN public.children c ON c.id = d.child_id
ORDER BY count DESC;

-- Detect unusual login patterns (many failed attempts from same IP)
SELECT 
  ip_address,
  attempt_count,
  ROUND(success_rate::numeric, 2) as success_rate_percent,
  CASE 
    WHEN success_rate < 10 THEN 'VERY SUSPICIOUS'
    WHEN success_rate < 30 THEN 'SUSPICIOUS'
    ELSE 'NORMAL'
  END as risk_level
FROM detect_unusual_login_patterns()
ORDER BY attempt_count DESC;

-- ============================================
-- TEST 6: Cleanup old records (manual trigger)
-- ============================================
-- These functions should be run via cron, but you can test them manually
SELECT cleanup_old_login_attempts();
SELECT cleanup_old_message_rate_limits();

-- ============================================
-- TEST 7: View all rate limit records (for monitoring)
-- ============================================
SELECT 
  'Message Rate Limits' as type,
  child_id::text as identifier,
  message_count,
  window_start
FROM public.child_message_rate_limits
WHERE window_start > now() - interval '24 hours'
ORDER BY window_start DESC
LIMIT 50;

SELECT 
  'Login Attempts' as type,
  ip_address::text as identifier,
  COUNT(*) as count,
  MAX(attempted_at) as last_attempt
FROM public.child_login_attempts
WHERE attempted_at > now() - interval '24 hours'
GROUP BY ip_address
ORDER BY last_attempt DESC
LIMIT 50;


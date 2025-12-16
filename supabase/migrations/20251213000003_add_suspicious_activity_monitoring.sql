-- supabase/migrations/20251213000003_add_suspicious_activity_monitoring.sql
-- Purpose: Add monitoring function to detect suspicious child activity
-- Created: 2025-12-13

-- ============================================
-- STEP 1: Create function to detect suspicious activity
-- ============================================
CREATE OR REPLACE FUNCTION detect_suspicious_child_activity()
RETURNS TABLE(child_id uuid, issue text, count bigint) AS $$
BEGIN
  RETURN QUERY
  -- Detect children sending too many messages
  SELECT 
    m.child_id,
    'High message volume'::text as issue,
    COUNT(*)::bigint as count
  FROM public.messages m
  WHERE m.sender_type = 'child'
  AND m.created_at > now() - interval '1 hour'
  GROUP BY m.child_id
  HAVING COUNT(*) > 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 2: Create function to detect unusual login patterns
-- ============================================
CREATE OR REPLACE FUNCTION detect_unusual_login_patterns()
RETURNS TABLE(ip_address inet, attempt_count bigint, success_rate numeric) AS $$
BEGIN
  RETURN QUERY
  -- Detect IPs with many failed login attempts
  SELECT 
    cla.ip_address,
    COUNT(*)::bigint as attempt_count,
    ROUND(
      (COUNT(*) FILTER (WHERE cla.success = true)::numeric / COUNT(*)::numeric) * 100,
      2
    ) as success_rate
  FROM public.child_login_attempts cla
  WHERE cla.attempted_at > now() - interval '1 hour'
  GROUP BY cla.ip_address
  HAVING COUNT(*) > 20 AND 
         (COUNT(*) FILTER (WHERE cla.success = true)::numeric / COUNT(*)::numeric) < 0.1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 3: Grant execute permissions
-- ============================================
GRANT EXECUTE ON FUNCTION detect_suspicious_child_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION detect_unusual_login_patterns() TO authenticated;

-- ============================================
-- Migration complete
-- ============================================
-- This migration adds:
-- 1. Function to detect children with high message volume (>100/hour)
-- 2. Function to detect unusual login patterns (many failed attempts from same IP)
-- 3. Both functions are available to authenticated users (parents/admins)


-- supabase/migrations/20251213000000_add_child_login_rate_limiting.sql
-- Purpose: Add rate limiting for child login attempts to prevent brute force attacks
-- Created: 2025-12-13

-- ============================================
-- STEP 1: Create table to track login attempts
-- ============================================
CREATE TABLE IF NOT EXISTS public.child_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL,
  attempted_at timestamptz DEFAULT now(),
  success boolean DEFAULT false,
  family_code_hash text, -- Hashed family code for tracking (not the actual code)
  child_id uuid REFERENCES public.children(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.child_login_attempts ENABLE ROW LEVEL SECURITY;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_child_login_attempts_ip_time 
  ON public.child_login_attempts(ip_address, attempted_at);

CREATE INDEX IF NOT EXISTS idx_child_login_attempts_success 
  ON public.child_login_attempts(success, attempted_at);

-- ============================================
-- STEP 2: RLS Policy - Allow anonymous users to insert attempts
-- ============================================
CREATE POLICY "Anyone can log login attempts"
ON public.child_login_attempts
FOR INSERT
TO anon
WITH CHECK (true);

-- Parents can view login attempts for their children
CREATE POLICY "Parents can view login attempts for their children"
ON public.child_login_attempts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = child_login_attempts.child_id
    AND children.parent_id = auth.uid()
  )
);

-- ============================================
-- STEP 3: Create rate limit check function
-- ============================================
CREATE OR REPLACE FUNCTION check_child_login_rate_limit(client_ip inet)
RETURNS boolean AS $$
DECLARE
  attempt_count integer;
BEGIN
  -- Count failed attempts in last hour from this IP
  SELECT COUNT(*) INTO attempt_count
  FROM public.child_login_attempts
  WHERE ip_address = client_ip
  AND attempted_at > now() - interval '1 hour'
  AND success = false;
  
  -- Allow up to 30 failed attempts per hour per IP
  RETURN attempt_count < 30;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 4: Create cleanup function for old attempts
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.child_login_attempts
  WHERE attempted_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 5: Grant execute permissions
-- ============================================
GRANT EXECUTE ON FUNCTION check_child_login_rate_limit(inet) TO anon;
GRANT EXECUTE ON FUNCTION cleanup_old_login_attempts() TO authenticated;

-- ============================================
-- Migration complete
-- ============================================
-- This migration adds:
-- 1. child_login_attempts table to track login attempts
-- 2. Rate limiting function (30 failed attempts per hour per IP)
-- 3. Cleanup function for old records
-- 4. RLS policies for anonymous inserts and parent viewing


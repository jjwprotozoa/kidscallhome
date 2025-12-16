-- supabase/migrations/20251213000001_add_child_message_rate_limiting.sql
-- Purpose: Add rate limiting for child messages to prevent spam/abuse
-- Created: 2025-12-13

-- ============================================
-- STEP 1: Create table to track message rate limits
-- ============================================
CREATE TABLE IF NOT EXISTS public.child_message_rate_limits (
  child_id uuid NOT NULL,
  message_count int DEFAULT 1,
  window_start timestamptz DEFAULT date_trunc('hour', now()),
  PRIMARY KEY (child_id, window_start)
);

-- Enable RLS
ALTER TABLE public.child_message_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_child_message_rate_limits_window 
  ON public.child_message_rate_limits(window_start);

-- ============================================
-- STEP 2: RLS Policy - Allow anonymous to manage their own rate limits
-- ============================================
-- Children can insert/update their own rate limit records
CREATE POLICY "Children can manage their message rate limits"
ON public.child_message_rate_limits
FOR ALL
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = child_message_rate_limits.child_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = child_message_rate_limits.child_id
  )
);

-- Parents can view rate limits for their children
CREATE POLICY "Parents can view message rate limits for their children"
ON public.child_message_rate_limits
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = child_message_rate_limits.child_id
    AND children.parent_id = auth.uid()
  )
);

-- ============================================
-- STEP 3: Create function to check message rate limit
-- ============================================
CREATE OR REPLACE FUNCTION check_child_message_rate_limit(
  p_child_id uuid,
  p_max_messages int DEFAULT 100,
  p_window_minutes int DEFAULT 60
)
RETURNS boolean AS $$
DECLARE
  v_count int;
  v_window_start timestamptz;
BEGIN
  v_window_start := date_trunc('hour', now());

  -- Get current count for this window
  SELECT message_count INTO v_count
  FROM public.child_message_rate_limits
  WHERE child_id = p_child_id
  AND window_start = v_window_start;

  -- If no record exists, create one
  IF v_count IS NULL THEN
    INSERT INTO public.child_message_rate_limits (child_id, message_count, window_start)
    VALUES (p_child_id, 1, v_window_start)
    ON CONFLICT (child_id, window_start) DO UPDATE
    SET message_count = child_message_rate_limits.message_count + 1;
    RETURN true;
  END IF;

  -- Check if limit exceeded
  IF v_count >= p_max_messages THEN
    RETURN false;
  END IF;

  -- Increment count
  UPDATE public.child_message_rate_limits
  SET message_count = message_count + 1
  WHERE child_id = p_child_id
  AND window_start = v_window_start;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 4: Create cleanup function for old rate limit records
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_message_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.child_message_rate_limits
  WHERE window_start < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 5: Grant execute permissions
-- ============================================
GRANT EXECUTE ON FUNCTION check_child_message_rate_limit(uuid, int, int) TO anon;
GRANT EXECUTE ON FUNCTION cleanup_old_message_rate_limits() TO authenticated;

-- ============================================
-- STEP 6: Update messages RLS policy to include rate limit check
-- ============================================
-- Note: We'll add the rate limit check to the existing policy
-- The actual policy update will be done in a separate migration
-- to avoid conflicts with existing policies

-- ============================================
-- Migration complete
-- ============================================
-- This migration adds:
-- 1. child_message_rate_limits table to track message counts per hour
-- 2. Rate limiting function (100 messages per hour per child, configurable)
-- 3. Cleanup function for old records
-- 4. RLS policies for anonymous management and parent viewing


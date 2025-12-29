-- supabase/migrations/20250122000013_ensure_child_login_attempts_setup.sql
-- Purpose: Ensure child_login_attempts table and RLS policies are correctly configured
-- Created: 2025-01-22

-- ============================================
-- STEP 1: Ensure table exists with correct structure
-- ============================================
CREATE TABLE IF NOT EXISTS public.child_login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL,
  attempted_at timestamp with time zone NULL DEFAULT now(),
  success boolean NULL DEFAULT false,
  family_code_hash text NULL,
  child_id uuid NULL,
  CONSTRAINT child_login_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT child_login_attempts_child_id_fkey FOREIGN KEY (child_id) 
    REFERENCES public.children (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- ============================================
-- STEP 2: Ensure indexes exist
-- ============================================
CREATE INDEX IF NOT EXISTS idx_child_login_attempts_ip_time 
  ON public.child_login_attempts USING btree (ip_address, attempted_at) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_child_login_attempts_success 
  ON public.child_login_attempts USING btree (success, attempted_at) 
  TABLESPACE pg_default;

-- ============================================
-- STEP 3: Enable RLS
-- ============================================
ALTER TABLE public.child_login_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Drop existing policies if they exist (to avoid conflicts)
-- ============================================
DROP POLICY IF EXISTS "Anyone can log login attempts" ON public.child_login_attempts;
DROP POLICY IF EXISTS "Parents can view login attempts for their children" ON public.child_login_attempts;

-- ============================================
-- STEP 5: Create RLS policies
-- ============================================
-- Allow anonymous users to insert login attempts (required for child login)
CREATE POLICY "Anyone can log login attempts"
ON public.child_login_attempts
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow authenticated users (parents) to view login attempts for their children
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
-- STEP 6: Ensure rate limit function exists
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
-- STEP 7: Grant permissions
-- ============================================
GRANT EXECUTE ON FUNCTION check_child_login_rate_limit(inet) TO anon;
GRANT INSERT ON public.child_login_attempts TO anon;
GRANT SELECT ON public.child_login_attempts TO authenticated;

-- ============================================
-- Migration complete
-- ============================================
-- This migration ensures:
-- 1. child_login_attempts table exists with correct structure
-- 2. All indexes are created
-- 3. RLS is enabled
-- 4. RLS policies allow anonymous inserts and parent viewing
-- 5. Rate limit function exists and is accessible to anonymous users


-- Migration: Create Audit Log System
-- Purpose: Store security audit logs in database for analysis and compliance
-- Created: 2025-02-03

-- ============================================
-- STEP 1: Create audit_logs table
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  ip TEXT,
  user_agent TEXT,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_timestamp ON public.audit_logs(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(severity);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only authenticated users can insert (for audit logging)
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policy: Only service role can read (for admin/analytics)
-- Note: Regular users cannot read audit logs for security
CREATE POLICY "Service role can read audit logs"
ON public.audit_logs
FOR SELECT
TO service_role
USING (true);

-- ============================================
-- STEP 2: Create RPC function to log audit events
-- ============================================
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_event_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_timestamp TIMESTAMPTZ DEFAULT NOW(),
  p_metadata JSONB DEFAULT NULL,
  p_severity TEXT DEFAULT 'medium'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Insert audit log entry
  INSERT INTO public.audit_logs (
    event_type,
    user_id,
    email,
    ip,
    user_agent,
    event_timestamp,
    metadata,
    severity
  ) VALUES (
    p_event_type,
    p_user_id,
    p_email,
    p_ip,
    p_user_agent,
    p_timestamp,
    p_metadata,
    p_severity
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.log_audit_event(
  TEXT, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, TEXT
) TO authenticated;

-- ============================================
-- STEP 3: Optional: Create function to query audit logs (admin only)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_user_id UUID DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  user_id UUID,
  email TEXT,
  ip TEXT,
  user_agent TEXT,
  event_timestamp TIMESTAMPTZ,
  metadata JSONB,
  severity TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only service role can query audit logs
  -- This prevents regular users from accessing audit data
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only service role can query audit logs';
  END IF;

  RETURN QUERY
  SELECT 
    al.id,
    al.event_type,
    al.user_id,
    al.email,
    al.ip,
    al.user_agent,
    al.event_timestamp,
    al.metadata,
    al.severity,
    al.created_at
  FROM public.audit_logs al
  WHERE 
    (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_event_type IS NULL OR al.event_type = p_event_type)
    AND (p_severity IS NULL OR al.severity = p_severity)
    AND (p_start_date IS NULL OR al.event_timestamp >= p_start_date)
    AND (p_end_date IS NULL OR al.event_timestamp <= p_end_date)
  ORDER BY al.event_timestamp DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION public.get_audit_logs(
  UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER
) TO service_role;

-- ============================================
-- STEP 4: Optional: Create cleanup function (remove old logs)
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Only service role can cleanup
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only service role can cleanup audit logs';
  END IF;

  DELETE FROM public.audit_logs
  WHERE event_timestamp < NOW() - (p_retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs(INTEGER) TO service_role;

-- ============================================
-- Notes:
-- ============================================
-- 1. The log_audit_event function is called automatically by the frontend
-- 2. Audit logs are stored with full details (not sanitized) for security analysis
-- 3. Regular users cannot read audit logs (RLS prevents it)
-- 4. Only service role can query/cleanup logs (for admin tools)
-- 5. Consider setting up a scheduled job to cleanup old logs:
--    SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT public.cleanup_old_audit_logs(90);');


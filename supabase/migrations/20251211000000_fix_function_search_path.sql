-- supabase/migrations/20251211000000_fix_function_search_path.sql
-- Fix function search_path security issues
-- Purpose: Add SET search_path = public to all functions to prevent search path manipulation attacks
-- Date: 2025-12-11

-- =====================================================
-- Fix check_family_member_email function
-- =====================================================
CREATE OR REPLACE FUNCTION check_family_member_email(email_to_check TEXT, parent_id_to_check UUID)
RETURNS TABLE (
  found BOOLEAN,
  status TEXT,
  invitation_token UUID
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as found,
    fm.status,
    fm.invitation_token
  FROM public.family_members fm
  WHERE fm.email = email_to_check
  AND fm.parent_id = parent_id_to_check
  LIMIT 1;
  
  -- If no row found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::UUID;
  END IF;
END;
$$;

-- =====================================================
-- Fix update_profile_updated_at function
-- =====================================================
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =====================================================
-- Fix update_family_member_updated_at function
-- =====================================================
CREATE OR REPLACE FUNCTION update_family_member_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =====================================================
-- Fix update_devices_updated_at function
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_devices_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =====================================================
-- Fix ensure_call_ending_columns function
-- =====================================================
CREATE OR REPLACE FUNCTION ensure_call_ending_columns()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add ended_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'ended_by'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN ended_by TEXT CHECK (ended_by IN ('parent', 'child'));
  END IF;

  -- Add end_reason column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'end_reason'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN end_reason TEXT;
  END IF;

  -- Add version column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'version'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN version BIGINT DEFAULT 0;
  END IF;

  -- Create indexes if they don't exist
  CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
  CREATE INDEX IF NOT EXISTS idx_calls_ended_at ON public.calls(ended_at);
END;
$$;

-- =====================================================
-- Fix increment_call_version function
-- =====================================================
CREATE OR REPLACE FUNCTION increment_call_version(call_id uuid)
RETURNS void 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.calls
  SET version = version + 1
  WHERE id = call_id;
END;
$$;

-- =====================================================
-- Fix cleanup_call_artifacts function
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_call_artifacts()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ended' AND NEW.ended_at IS NOT NULL AND (OLD.status IS NULL OR OLD.status <> 'ended') THEN
    -- Clear ICE candidates (they're no longer needed)
    -- Only clear parent_ice_candidates and child_ice_candidates (ice_candidates column removed)
    UPDATE public.calls 
    SET 
      parent_ice_candidates = '[]'::jsonb,
      child_ice_candidates = '[]'::jsonb
    WHERE id = NEW.id;
    
    -- Optional: null out big blobs to save space (keep for debugging, but could be cleared)
    -- UPDATE public.calls SET offer = NULL, answer = NULL WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================
-- Fix mark_missed_calls function
-- =====================================================
CREATE OR REPLACE FUNCTION mark_missed_calls()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If call is ending and was never active, mark it as missed
  IF NEW.status = 'ended' AND NEW.ended_at IS NOT NULL THEN
    -- Check if call was ever active (we can't directly check history, so we check if it's ending without being active)
    -- A call is missed if it ends without ever being active
    -- We'll mark it as missed if status transitions from 'ringing' to 'ended' without going through 'active'
    IF OLD.status = 'ringing' AND NEW.status = 'ended' THEN
      NEW.missed_call = TRUE;
    END IF;
  END IF;
  
  -- If call becomes active, it's no longer missed
  IF NEW.status = 'active' THEN
    NEW.missed_call = FALSE;
  END IF;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- Fix update_conversation_timestamp function
-- =====================================================
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- =====================================================
-- Migration complete
-- =====================================================
-- All functions now have SET search_path = public to prevent
-- search path manipulation attacks (CWE-79)






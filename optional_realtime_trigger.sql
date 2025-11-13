-- optional_realtime_trigger.sql
-- Optional: Creates a trigger to broadcast call signaling changes via Supabase Realtime
-- This can improve latency for SDP exchange, though the current postgres_changes approach works fine
-- Run this ONLY if you want to add explicit broadcasting (not required)

-- ============================================
-- CREATE TRIGGER FUNCTION FOR BROADCASTING
-- ============================================
-- This function broadcasts changes to the calls table via Supabase Realtime
-- Note: Supabase Realtime already broadcasts postgres_changes automatically,
-- so this is only useful if you want custom event types or additional metadata

CREATE OR REPLACE FUNCTION public.broadcast_call_changes()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
BEGIN
  -- Build payload with relevant call information
  payload := jsonb_build_object(
    'id', NEW.id,
    'child_id', NEW.child_id,
    'parent_id', NEW.parent_id,
    'status', NEW.status,
    'caller_type', NEW.caller_type,
    'has_offer', NEW.offer IS NOT NULL,
    'has_answer', NEW.answer IS NOT NULL,
    'ice_candidates_count', jsonb_array_length(COALESCE(NEW.ice_candidates, '[]'::jsonb)),
    'updated_at', NOW()
  );

  -- Note: Supabase Realtime automatically broadcasts postgres_changes
  -- This function is mainly for logging or custom event types
  -- If you want to use Supabase's broadcast channels, you'd do that from the client side
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CREATE TRIGGER (OPTIONAL)
-- ============================================
-- Uncomment if you want to use this trigger
/*
DROP TRIGGER IF EXISTS call_changes_broadcast ON public.calls;
CREATE TRIGGER call_changes_broadcast
  AFTER UPDATE ON public.calls
  FOR EACH ROW
  WHEN (
    OLD.offer IS DISTINCT FROM NEW.offer OR
    OLD.answer IS DISTINCT FROM NEW.answer OR
    OLD.ice_candidates IS DISTINCT FROM NEW.ice_candidates OR
    OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION public.broadcast_call_changes();
*/

-- ============================================
-- RECOMMENDATION
-- ============================================
-- The current implementation using postgres_changes subscriptions is sufficient.
-- This trigger is optional and mainly useful for:
-- 1. Logging/debugging
-- 2. Custom event types
-- 3. Additional metadata in broadcasts
--
-- For most use cases, the existing Supabase Realtime postgres_changes approach
-- (which you're already using) is the recommended solution.

SELECT 
    'Trigger function created (optional)' as status,
    'Current postgres_changes approach is recommended' as note,
    'Uncomment trigger creation if you need custom broadcasting' as action;


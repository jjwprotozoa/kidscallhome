-- Enable REPLICA IDENTITY FULL for messages table to support UPDATE events in Supabase Realtime
-- This allows Supabase Realtime to send UPDATE events with both old and new values

-- Set REPLICA IDENTITY FULL for messages table
-- This is required for Supabase Realtime to properly track UPDATE events
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Verify the setting
DO $$
DECLARE
  replica_identity CHAR;
BEGIN
  SELECT relreplident INTO replica_identity
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE c.relname = 'messages' AND n.nspname = 'public';
  
  IF replica_identity = 'f' THEN
    RAISE NOTICE '✅ REPLICA IDENTITY FULL enabled for messages table';
  ELSE
    RAISE WARNING '⚠️ REPLICA IDENTITY FULL not set correctly for messages table. Current value: %', replica_identity;
  END IF;
END $$;


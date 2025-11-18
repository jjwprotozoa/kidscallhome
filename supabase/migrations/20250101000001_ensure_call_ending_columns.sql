-- supabase/migrations/20250101000001_ensure_call_ending_columns.sql
-- Function to ensure call ending columns exist (for dynamic creation if migration hasn't run)

CREATE OR REPLACE FUNCTION ensure_call_ending_columns()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION ensure_call_ending_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_call_ending_columns() TO anon;




-- supabase/migrations/20250101000000_add_call_ending_fields.sql
-- Add fields for idempotent, observable call ending

-- Add ended_at column if it doesn't exist (it might already exist from original migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'ended_at'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN ended_at TIMESTAMPTZ;
    RAISE NOTICE 'Added ended_at column';
  ELSE
    RAISE NOTICE 'ended_at column already exists';
  END IF;
END $$;

-- Add ended_by column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'ended_by'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN ended_by TEXT CHECK (ended_by IN ('parent', 'child'));
    RAISE NOTICE 'Added ended_by column';
  ELSE
    RAISE NOTICE 'ended_by column already exists';
  END IF;
END $$;

-- Add end_reason column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'end_reason'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN end_reason TEXT;
    RAISE NOTICE 'Added end_reason column';
  ELSE
    RAISE NOTICE 'end_reason column already exists';
  END IF;
END $$;

-- Add version column for optimistic concurrency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'version'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN version BIGINT DEFAULT 0;
    RAISE NOTICE 'Added version column';
  ELSE
    RAISE NOTICE 'version column already exists';
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_ended_at ON public.calls(ended_at);

-- Create function to increment version (for optimistic concurrency)
CREATE OR REPLACE FUNCTION increment_call_version(call_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.calls
  SET version = version + 1
  WHERE id = call_id;
END;
$$ LANGUAGE plpgsql;

-- Function to ensure call ending columns exist (for dynamic creation if needed)
CREATE OR REPLACE FUNCTION ensure_call_ending_columns()
RETURNS void AS $$
BEGIN
  -- Add ended_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'ended_at'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN ended_at TIMESTAMPTZ;
  END IF;

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

-- Fix existing data before adding constraint
-- Set ended_at for any rows with status='ended' but ended_at IS NULL
UPDATE public.calls
SET ended_at = COALESCE(ended_at, created_at + INTERVAL '1 second')
WHERE status = 'ended' AND ended_at IS NULL;

-- Clear ended_at for any rows with status != 'ended' but ended_at IS NOT NULL
UPDATE public.calls
SET ended_at = NULL
WHERE status <> 'ended' AND ended_at IS NOT NULL;

-- Add constraint: status='ended' requires ended_at NOT NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ended_has_timestamp'
  ) THEN
    ALTER TABLE public.calls
      ADD CONSTRAINT ended_has_timestamp CHECK (
        (status <> 'ended' AND ended_at IS NULL)
        OR (status = 'ended' AND ended_at IS NOT NULL)
      );
    RAISE NOTICE 'Added ended_has_timestamp constraint';
  ELSE
    RAISE NOTICE 'ended_has_timestamp constraint already exists';
  END IF;
END $$;

-- Function to cleanup call artifacts when call ends
CREATE OR REPLACE FUNCTION cleanup_call_artifacts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ended' AND NEW.ended_at IS NOT NULL AND (OLD.status IS NULL OR OLD.status <> 'ended') THEN
    -- Clear ICE candidates (they're no longer needed)
    UPDATE public.calls 
    SET 
      parent_ice_candidates = '[]'::jsonb,
      child_ice_candidates = '[]'::jsonb,
      ice_candidates = '[]'::jsonb
    WHERE id = NEW.id;
    
    -- Optional: null out big blobs to save space (keep for debugging, but could be cleared)
    -- UPDATE public.calls SET offer = NULL, answer = NULL WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cleanup
DROP TRIGGER IF EXISTS trg_cleanup_call_artifacts ON public.calls;
CREATE TRIGGER trg_cleanup_call_artifacts
AFTER UPDATE ON public.calls
FOR EACH ROW
WHEN (NEW.status = 'ended' AND NEW.ended_at IS NOT NULL AND (OLD.status IS NULL OR OLD.status <> 'ended'))
EXECUTE FUNCTION cleanup_call_artifacts();


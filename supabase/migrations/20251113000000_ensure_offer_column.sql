-- Ensure offer, answer, and ice_candidates columns exist in calls table
-- This migration ensures the columns exist even if they were somehow missing

-- Add offer column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'offer'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN offer jsonb;
  END IF;
END $$;

-- Add answer column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'answer'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN answer jsonb;
  END IF;
END $$;

-- Add ice_candidates column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'ice_candidates'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN ice_candidates jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Verify columns exist
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
  AND column_name IN ('offer', 'answer', 'ice_candidates')
ORDER BY column_name;




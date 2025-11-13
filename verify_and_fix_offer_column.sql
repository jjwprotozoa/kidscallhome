-- Verify and fix offer column issue
-- Run this in Supabase SQL Editor

-- Step 1: Verify the column exists in the database
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

-- Step 2: If columns don't exist, create them
DO $$
BEGIN
  -- Add offer column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'offer'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN offer jsonb;
    RAISE NOTICE 'Added offer column';
  ELSE
    RAISE NOTICE 'offer column already exists';
  END IF;

  -- Add answer column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'answer'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN answer jsonb;
    RAISE NOTICE 'Added answer column';
  ELSE
    RAISE NOTICE 'answer column already exists';
  END IF;

  -- Add ice_candidates column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'ice_candidates'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN ice_candidates jsonb DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Added ice_candidates column';
  ELSE
    RAISE NOTICE 'ice_candidates column already exists';
  END IF;
END $$;

-- Step 3: Force PostgREST schema cache refresh
-- This requires Supabase admin access or restarting the project
-- For Supabase Cloud: Go to Settings > API > Reload schema
-- For local: Restart Supabase with `supabase stop && supabase start`

-- Step 4: Verify columns are accessible via API
-- After refreshing, test with:
-- SELECT id, offer, answer, ice_candidates FROM calls LIMIT 1;


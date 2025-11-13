-- Fix for "Could not find the 'offer' column" error
-- Run this in Supabase SQL Editor to ensure the columns exist
-- This will fix the PGRST204 schema cache error

-- Ensure offer column exists
DO $$
BEGIN
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
END $$;

-- Ensure answer column exists
DO $$
BEGIN
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
END $$;

-- Ensure ice_candidates column exists
DO $$
BEGIN
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

-- Verify all columns exist
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

-- Note: After running this, you may need to refresh the Supabase schema cache.
-- If using Supabase CLI, run: supabase db reset
-- Or restart your Supabase project to refresh the PostgREST schema cache.


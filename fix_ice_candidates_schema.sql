-- fix_ice_candidates_schema.sql
-- Database migration to add separate ICE candidate fields for parent and child
-- This prevents candidates from overwriting each other during WebRTC connection establishment

-- Add parent_ice_candidates column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'parent_ice_candidates'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN parent_ice_candidates jsonb DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Added parent_ice_candidates column';
  ELSE
    RAISE NOTICE 'parent_ice_candidates column already exists';
  END IF;
END $$;

-- Add child_ice_candidates column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'child_ice_candidates'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN child_ice_candidates jsonb DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Added child_ice_candidates column';
  ELSE
    RAISE NOTICE 'child_ice_candidates column already exists';
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
  AND column_name IN ('parent_ice_candidates', 'child_ice_candidates', 'ice_candidates')
ORDER BY column_name;

-- Note: The old ice_candidates column is kept for backward compatibility
-- but should not be used going forward. Both parent and child should use
-- their respective role-specific fields.


-- Add ended_at column to calls table if it doesn't exist
-- Run this in Supabase SQL Editor

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calls' 
        AND column_name = 'ended_at'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN ended_at timestamptz;
        RAISE NOTICE 'Added ended_at column to calls table';
    ELSE
        RAISE NOTICE 'ended_at column already exists';
    END IF;
END $$;


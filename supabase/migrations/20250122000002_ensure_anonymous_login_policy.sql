-- Migration: Ensure Anonymous Login Policy Exists
-- Purpose: Ensure children table allows anonymous users to verify login codes
-- This is critical for child login to work

DO $$
BEGIN
  -- Check if policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'children'
    AND policyname = 'Anyone can verify login codes'
  ) THEN
    CREATE POLICY "Anyone can verify login codes"
    ON public.children
    FOR SELECT
    TO anon
    USING (true);
    
    RAISE NOTICE 'Created policy: Anyone can verify login codes';
  ELSE
    RAISE NOTICE 'Policy "Anyone can verify login codes" already exists';
  END IF;
END $$;


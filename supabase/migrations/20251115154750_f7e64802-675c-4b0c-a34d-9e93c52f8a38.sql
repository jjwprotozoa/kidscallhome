-- Add separate ICE candidate fields for parent and child
-- Drop old column if it exists
ALTER TABLE public.calls
DROP COLUMN IF EXISTS ice_candidates;

-- Add new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'parent_ice_candidates'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN parent_ice_candidates jsonb DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'child_ice_candidates'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN child_ice_candidates jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add child policies for calls (for bidirectional calling)
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Children can view their calls" ON public.calls;
DROP POLICY IF EXISTS "Children can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Children can update their calls" ON public.calls;

CREATE POLICY "Children can view their calls"
ON public.calls
FOR SELECT
USING (true);

CREATE POLICY "Children can insert calls"
ON public.calls
FOR INSERT
WITH CHECK (caller_type = 'child');

CREATE POLICY "Children can update their calls"
ON public.calls
FOR UPDATE
USING (true);


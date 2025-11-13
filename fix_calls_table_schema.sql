-- Fix the calls table schema to match the expected structure
-- WARNING: This will drop existing data! Only run if you're okay with that.

-- First, check if the table exists and what it looks like
DO $$
BEGIN
    -- Check if table has wrong columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' 
        AND column_name IN ('caller_id', 'callee_id')
    ) THEN
        RAISE NOTICE 'Table has caller_id/callee_id columns. Need to migrate.';
    END IF;
END $$;

-- If the table structure is wrong, you'll need to:
-- 1. Drop existing policies
DROP POLICY IF EXISTS "Users can create calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update their own calls" ON public.calls;
DROP POLICY IF EXISTS "Users can view calls they are involved in" ON public.calls;

-- 2. Drop the table (if you want to recreate it)
-- DROP TABLE IF EXISTS public.calls CASCADE;

-- 3. Recreate with correct schema (from migration 20251112210052)
/*
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  parent_id uuid NOT NULL,
  caller_type text NOT NULL CHECK (caller_type IN ('parent', 'child')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended')),
  offer jsonb,
  answer jsonb,
  ice_candidates jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  ended_at timestamptz
);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Recreate correct policies
CREATE POLICY "Parents can view calls for their children"
ON public.calls
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents can insert calls"
ON public.calls
FOR INSERT
WITH CHECK (
  caller_type = 'parent' AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents can update calls"
ON public.calls
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

-- Child policies (from migration 20251112220000)
CREATE POLICY "Children can view their own calls"
ON public.calls
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);

CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
  caller_type = 'child' AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = calls.parent_id
  )
);

CREATE POLICY "Children can update their own calls"
ON public.calls
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
*/


-- Allow public access to children table for login verification (only by login_code)
CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- Create calls table for WebRTC signaling
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

-- Enable RLS on calls table
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Parents can manage calls for their children
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

-- Enable realtime for calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
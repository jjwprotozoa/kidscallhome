-- Add separate ICE candidate fields for parent and child
ALTER TABLE public.calls 
DROP COLUMN ice_candidates,
ADD COLUMN parent_ice_candidates jsonb DEFAULT '[]'::jsonb,
ADD COLUMN child_ice_candidates jsonb DEFAULT '[]'::jsonb;

-- Add child policies for calls (for bidirectional calling)
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
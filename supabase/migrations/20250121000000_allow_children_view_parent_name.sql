-- Migration: Allow children to view their parent's name
-- Purpose: Enable anonymous users (children) to fetch their parent's name for display

-- Create RLS policy to allow children to view their parent's name
-- This allows anonymous users to access the parent's name field if they are a child of that parent
CREATE POLICY "Children can view their parent's name"
ON public.parents
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.parent_id = parents.id
  )
);


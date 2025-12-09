-- supabase/migrations/20250101000003_fix_parent_call_viewing.sql
-- Fix parent RLS policy to allow viewing child-initiated calls
-- The issue: Parent dashboard queries by parent_id, but RLS policy only checks child relationship

-- Drop and recreate parent SELECT policy to check parent_id directly
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;

-- CRITICAL FIX: Check calls.parent_id directly to match dashboard queries
-- This allows parents to see calls where they are the parent_id, regardless of caller_type
CREATE POLICY "Parents can view calls for their children"
ON public.calls
FOR SELECT
USING (
  -- Check that the call's parent_id matches the authenticated user
  calls.parent_id = auth.uid()
  -- Also verify the child belongs to this parent (security check)
  AND EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

-- Verify policy was created
SELECT 
    'Parent SELECT Policy' as info,
    policyname,
    cmd as command,
    qual as using_expression
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname = 'Parents can view calls for their children';









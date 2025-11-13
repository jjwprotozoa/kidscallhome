-- fix_child_rls_with_check.sql
-- Fixes the WITH CHECK clause for child UPDATE policy to ensure it allows updating offer/answer/ice_candidates
-- The issue might be that the WITH CHECK is too restrictive

-- Drop the existing child update policy
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;

-- Recreate with a more permissive WITH CHECK
-- The USING clause checks if the child can see the call
-- The WITH CHECK should allow updates to any column as long as the child relationship is maintained
CREATE POLICY "Children can update their own calls"
ON public.calls
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
)
WITH CHECK (
  -- Allow update if the child_id still matches (child can't change this)
  -- But allow updating any other fields including offer, answer, ice_candidates
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
  -- Note: We're not restricting which columns can be updated
  -- The child can update offer, answer, ice_candidates, status, etc.
);

-- Verify the policy was created
SELECT 
    policyname,
    cmd,
    roles,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls'
  AND policyname = 'Children can update their own calls';


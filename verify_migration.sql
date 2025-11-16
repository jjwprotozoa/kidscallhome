-- Verify the child call policy exists and is correct
-- Run this in your Supabase SQL Editor

-- Check if the policy exists
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'calls' 
  AND policyname = 'Children can insert calls they initiate';

-- If the above returns a row, the policy exists
-- Verify the WITH CHECK clause includes parent_id verification
-- The with_check column should contain: 
-- EXISTS (SELECT 1 FROM public.children WHERE children.id = calls.child_id AND children.parent_id = calls.parent_id)


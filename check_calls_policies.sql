-- Check all RLS policies on the calls table
-- Run this in your Supabase SQL Editor to see all policies

SELECT 
    policyname,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY policyname;

-- Expected policies:
-- 1. "Parents can view calls for their children" (SELECT)
-- 2. "Parents can insert calls" (INSERT)
-- 3. "Parents can update calls" (UPDATE)
-- 4. "Children can view their own calls" (SELECT)
-- 5. "Children can insert calls they initiate" (INSERT) <- This one should verify parent_id
-- 6. "Children can update their own calls" (UPDATE)


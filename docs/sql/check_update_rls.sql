-- Check RLS policies for UPDATE on calls table
-- This will show if family members can UPDATE calls

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- Check if there are any policies that might block family members
SELECT 
    'UPDATE Policies Summary' as info,
    COUNT(*) as total_update_policies,
    COUNT(CASE WHEN roles::text LIKE '%authenticated%' THEN 1 END) as authenticated_policies,
    COUNT(CASE WHEN roles::text LIKE '%anon%' THEN 1 END) as anon_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls'
  AND cmd = 'UPDATE';


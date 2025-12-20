-- Check the actual policy conditions to see what they're checking
-- This will show us the exact USING clauses

SELECT 
    policyname,
    cmd,
    roles,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE tablename = 'messages'
AND cmd = 'SELECT'
AND policyname LIKE '%isolated%'
ORDER BY policyname;

-- Also check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'messages';

















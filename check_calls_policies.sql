-- CHECK_CALLS_POLICIES.sql
-- Run this to see the current calls table policies
-- CRITICAL: Shows both USING and WITH CHECK clauses

SELECT 
    'Current Call Policies' as info,
    policyname,
    cmd as command,
    roles::text as roles,
    qual as using_clause,
    with_check as with_check_clause,
    CASE 
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '❌ MISSING WITH CHECK!'
        WHEN cmd = 'INSERT' AND with_check IS NOT NULL THEN '✅ Has WITH CHECK'
        ELSE 'N/A'
    END as insert_status
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY 
  CASE 
    WHEN policyname LIKE 'Children%' THEN 1
    WHEN policyname LIKE 'Parents%' THEN 2
    ELSE 3
  END,
  policyname,
  cmd;

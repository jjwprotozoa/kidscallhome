-- =====================================================
-- CHECK ACTUAL POLICY EXPRESSION
-- =====================================================
-- This will show us exactly what PostgreSQL is checking

SELECT 
    'Actual Policy Expression' as check_type,
    policyname,
    cmd as command,
    roles,
    with_check as policy_expression,
    -- Show the full expression as text
    with_check::text as expression_text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
  AND 'anon' = ANY(roles);


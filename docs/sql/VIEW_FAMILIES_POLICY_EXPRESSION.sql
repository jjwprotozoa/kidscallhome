-- View the actual policy expression for families table
-- This shows the exact SQL that the policy evaluates

-- Method 1: Using pg_policies view (easier to read)
SELECT 
    policyname,
    cmd,
    qual as using_expression_text,
    with_check as with_check_expression_text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'families'
  AND cmd = 'SELECT';

-- Method 2: Using pg_policy system catalog (more detailed)
SELECT 
    pol.polname as policy_name,
    pol.polcmd as command,
    CASE pol.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        ELSE 'UNKNOWN'
    END as command_name,
    pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression,
    c.relname as table_name,
    n.nspname as schema_name
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'families'
  AND pol.polcmd = 'r'  -- 'r' = SELECT
ORDER BY pol.polname;


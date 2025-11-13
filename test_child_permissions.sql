-- Test if a child can access the calls table
-- Replace the UUID with an actual child_id from your children table

-- First, check if children exist
SELECT 
    'Children in database' as check_type,
    id,
    name,
    parent_id,
    login_code
FROM children
LIMIT 5;

-- Check if a specific child can see calls (replace UUID)
-- SELECT * FROM calls WHERE child_id = '1f435b79-08d0-4260-a48c-e844ab49c393';

-- Test the RLS policy by checking what an anonymous user can see
-- This simulates what happens when a child (anon user) tries to query
SELECT 
    'RLS Policy Test' as check_type,
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'SELECT' THEN 'Can view'
        WHEN cmd = 'INSERT' THEN 'Can insert'
        WHEN cmd = 'UPDATE' THEN 'Can update'
    END as permission
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname LIKE 'Children%'
ORDER BY cmd;

-- Check if the child_id from the error exists in children table
SELECT 
    'Child ID Verification' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM children 
            WHERE id = '1f435b79-08d0-4260-a48c-e844ab49c393'
        ) THEN '✅ Child exists'
        ELSE '❌ Child does not exist'
    END as child_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM children 
            WHERE id = '1f435b79-08d0-4260-a48c-e844ab49c393'
        ) THEN (
            SELECT parent_id FROM children 
            WHERE id = '1f435b79-08d0-4260-a48c-e844ab49c393'
        )::text
        ELSE 'N/A'
    END as parent_id;


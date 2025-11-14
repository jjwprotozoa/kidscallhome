-- TEST_POLICY_WITH_REAL_DATA.sql
-- Test the actual policy logic with real data from your database
-- This will help identify why the policy is failing

-- ============================================
-- STEP 1: Get actual child and parent IDs to test with
-- ============================================
SELECT 
    'Real Child Data' as info,
    id as child_id,
    parent_id,
    name,
    login_code
FROM public.children
ORDER BY created_at DESC
LIMIT 3;

-- ============================================
-- STEP 2: Test the subquery that the policy uses
-- ============================================
-- Replace CHILD_ID and PARENT_ID with values from step 1
-- This tests if the IN subquery logic works

-- Example test (you'll need to replace the UUIDs with real values from step 1):
/*
WITH test_data AS (
    SELECT 
        id as test_child_id,
        parent_id as test_parent_id
    FROM public.children
    LIMIT 1
)
SELECT 
    'Testing Policy Subquery Logic' as test_name,
    test_child_id,
    test_parent_id,
    CASE 
        WHEN test_child_id IN (
            SELECT public.children.id 
            FROM public.children 
            WHERE public.children.parent_id = test_parent_id
        )
        THEN '✅ Subquery returns TRUE - policy should ALLOW insert'
        ELSE '❌ Subquery returns FALSE - policy will REJECT insert'
    END as subquery_result,
    -- Also show what the subquery actually returns
    (
        SELECT array_agg(id::text)
        FROM public.children 
        WHERE public.children.parent_id = test_parent_id
    ) as matching_child_ids
FROM test_data;
*/

-- ============================================
-- STEP 3: Check if anonymous user can actually read children table
-- ============================================
-- This is critical - the policy subquery needs to work for anon users

-- First verify the policy exists
SELECT 
    'Children Table Anon Policy Check' as check_type,
    policyname,
    cmd,
    roles::text,
    qual as using_clause,
    CASE 
        WHEN policyname = 'Anyone can verify login codes' 
        AND cmd = 'SELECT' 
        AND 'anon' = ANY(roles::text[])
        AND qual IS NOT NULL
        THEN '✅ Policy exists and should work'
        ELSE '❌ Policy issue detected'
    END as policy_status
FROM pg_policies
WHERE tablename = 'children'
  AND 'anon' = ANY(roles::text[])
  AND cmd = 'SELECT';

-- ============================================
-- STEP 4: Show the EXACT child INSERT policy definition
-- ============================================
SELECT 
    'Child INSERT Policy Definition' as info,
    policyname,
    with_check as full_with_check_clause,
    -- Check if it has the right components
    CASE 
        WHEN with_check::text LIKE '%caller_type%' 
        AND with_check::text LIKE '%child_id IN%'
        AND with_check::text LIKE '%public.children%'
        THEN '✅ Policy structure looks correct'
        ELSE '❌ Policy structure might be wrong'
    END as structure_check
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname = 'Children can insert calls they initiate'
  AND cmd = 'INSERT';

-- ============================================
-- STEP 5: Try a different approach - use a function
-- ============================================
-- Sometimes policies work better with functions
-- Let's create a helper function if the direct subquery doesn't work

-- Check if we can create a function
DO $$
BEGIN
    -- Try to create a function that checks the relationship
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'verify_child_parent_relationship'
        AND pronamespace = 'public'::regnamespace
    ) THEN
        CREATE OR REPLACE FUNCTION public.verify_child_parent_relationship(
            p_child_id uuid,
            p_parent_id uuid
        )
        RETURNS boolean
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
        AS $$
            SELECT EXISTS (
                SELECT 1 
                FROM public.children 
                WHERE id = p_child_id 
                AND parent_id = p_parent_id
            );
        $$;
        
        RAISE NOTICE 'Created helper function verify_child_parent_relationship';
    ELSE
        RAISE NOTICE 'Function verify_child_parent_relationship already exists';
    END IF;
END $$;

-- ============================================
-- STEP 6: Alternative policy using the function
-- ============================================
-- If the IN subquery doesn't work, try using the function instead
-- Uncomment this section if the current policy still fails

/*
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
  caller_type = 'child'::text AND
  public.verify_child_parent_relationship(calls.child_id, calls.parent_id) = true
);

SELECT '✅ Recreated policy using function' as status;
*/

-- ============================================
-- STEP 7: Final verification
-- ============================================
SELECT 
    'Final Policy Check' as info,
    policyname,
    cmd,
    roles::text,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK'
        ELSE 'Missing WITH CHECK'
    END as status
FROM pg_policies
WHERE tablename = 'calls'
  AND cmd = 'INSERT'
ORDER BY policyname;


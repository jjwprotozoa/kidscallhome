-- =====================================================
-- VERIFY CURRENT POLICY AND DEBUG
-- =====================================================

-- =====================================================
-- STEP 1: Show the EXACT current policy expression
-- =====================================================
SELECT 
    'Current Child INSERT Policy' as check_type,
    policyname,
    cmd as command,
    roles,
    with_check::text as full_expression,
    -- Check key components
    CASE 
        WHEN with_check::text LIKE '%messages.child_id%' THEN '✅ Uses messages.child_id'
        WHEN with_check::text LIKE '%child_id%' THEN '⚠️ Uses child_id (no table prefix)'
        ELSE '❌ Missing child_id reference'
    END as child_id_check,
    CASE 
        WHEN with_check::text LIKE '%messages.sender_id%' THEN '✅ Uses messages.sender_id'
        WHEN with_check::text LIKE '%sender_id%' THEN '⚠️ Uses sender_id (no table prefix)'
        ELSE '❌ Missing sender_id reference'
    END as sender_id_check,
    CASE 
        WHEN with_check::text LIKE '%EXISTS%' THEN '✅ Uses EXISTS'
        ELSE '❌ Missing EXISTS'
    END as exists_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
  AND 'anon' = ANY(roles);

-- =====================================================
-- STEP 2: Compare with parent policy
-- =====================================================
SELECT 
    'Policy Comparison' as check_type,
    policyname,
    CASE 
        WHEN 'authenticated' = ANY(roles) THEN 'Parent'
        WHEN 'anon' = ANY(roles) THEN 'Child'
    END as type,
    with_check::text as expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
ORDER BY 
    CASE WHEN 'authenticated' = ANY(roles) THEN 1 ELSE 2 END;

-- =====================================================
-- STEP 3: Check if RLS is actually enabled
-- =====================================================
SELECT 
    'RLS Status Check' as check_type,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS is enabled'
        ELSE '❌ RLS is NOT enabled - This is the problem!'
    END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'messages';

-- =====================================================
-- STEP 4: Check for any other policies that might conflict
-- =====================================================
SELECT 
    'All Message Policies' as check_type,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN cmd = 'INSERT' AND 'anon' = ANY(roles) THEN 'Child INSERT'
        WHEN cmd = 'SELECT' AND 'anon' = ANY(roles) THEN 'Child SELECT'
        WHEN cmd = 'INSERT' AND 'authenticated' = ANY(roles) THEN 'Parent INSERT'
        WHEN cmd = 'SELECT' AND 'authenticated' = ANY(roles) THEN 'Parent SELECT'
        ELSE 'Other'
    END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
ORDER BY cmd, policyname;

-- =====================================================
-- STEP 5: Test if anonymous user can actually read children table
-- =====================================================
-- This simulates what the policy does
SELECT 
    'Anonymous Access Test' as test_type,
    COUNT(*) as child_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Anonymous users CAN read children table'
        ELSE '❌ Anonymous users CANNOT read children table - This is the problem!'
    END as result
FROM public.children
WHERE id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid;

-- =====================================================
-- STEP 6: Try to manually simulate the INSERT check
-- =====================================================
-- This simulates what happens during an actual INSERT
DO $$
DECLARE
    test_child_id uuid := 'f91c9458-6ffc-44e6-81a7-a74b851f1d99';
    test_sender_id uuid := 'f91c9458-6ffc-44e6-81a7-a74b851f1d99';
    test_sender_type text := 'child';
    check_result boolean;
BEGIN
    -- Simulate the WITH CHECK clause
    check_result := (
        test_sender_type = 'child'::text 
        AND test_sender_id = test_child_id
        AND EXISTS (
            SELECT 1 FROM public.children
            WHERE children.id = test_child_id
            AND children.id = test_sender_id
        )
    );
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Manual Policy Check Simulation';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'sender_type check: %', (test_sender_type = 'child'::text);
    RAISE NOTICE 'sender_id = child_id check: %', (test_sender_id = test_child_id);
    RAISE NOTICE 'EXISTS check: %', EXISTS (
        SELECT 1 FROM public.children
        WHERE children.id = test_child_id
        AND children.id = test_sender_id
    );
    RAISE NOTICE 'Overall result: %', check_result;
    RAISE NOTICE '========================================';
END $$;


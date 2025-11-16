-- =====================================================
-- TEST EXACT RLS CHECK FOR CHILD MESSAGE INSERT
-- =====================================================
-- This simulates exactly what the RLS policy checks
-- Your payload:
-- child_id: f91c9458-6ffc-44e6-81a7-a74b851f1d99
-- sender_id: f91c9458-6ffc-44e6-81a7-a74b851f1d99
-- sender_type: 'child'

-- =====================================================
-- STEP 1: Check each condition individually
-- =====================================================

SELECT 
    'Step 1: Check sender_type' as check_step,
    CASE 
        WHEN 'child'::text = 'child'::text THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as result;

SELECT 
    'Step 2: Check sender_id = child_id' as check_step,
    CASE 
        WHEN 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid 
        THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as result;

SELECT 
    'Step 3: Check EXISTS (child exists)' as check_step,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid
            AND id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as result;

-- =====================================================
-- STEP 2: Test the complete RLS policy expression
-- =====================================================

SELECT 
    'Complete RLS Check' as test_name,
    CASE 
        WHEN (
            'child'::text = 'child'::text 
            AND 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid
            AND EXISTS (
                SELECT 1 FROM public.children
                WHERE id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid
                AND id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid
            )
        ) THEN '✅✅✅ ALL CHECKS PASS - RLS should allow insert ✅✅✅'
        ELSE '❌❌❌ CHECKS FAILED ❌❌❌'
    END as final_result;

-- =====================================================
-- STEP 3: Verify the actual RLS policy expression
-- =====================================================

SELECT 
    'Message INSERT Policy Expression' as check_type,
    policyname,
    with_check as policy_expression,
    -- Parse the expression to see what it's checking
    CASE 
        WHEN with_check::text LIKE '%sender_type%' THEN '✅ Checks sender_type'
        ELSE '❌ Missing sender_type check'
    END as has_sender_type_check,
    CASE 
        WHEN with_check::text LIKE '%sender_id%' THEN '✅ Checks sender_id'
        ELSE '❌ Missing sender_id check'
    END as has_sender_id_check,
    CASE 
        WHEN with_check::text LIKE '%EXISTS%' THEN '✅ Uses EXISTS check'
        ELSE '❌ Missing EXISTS check'
    END as has_exists_check,
    CASE 
        WHEN with_check::text LIKE '%children%' THEN '✅ References children table'
        ELSE '❌ Missing children table reference'
    END as has_children_reference
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
  AND 'anon' = ANY(roles);

-- =====================================================
-- STEP 4: Check if there are conflicting policies
-- =====================================================

SELECT 
    'All Message Policies' as check_type,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN cmd = 'INSERT' AND 'anon' = ANY(roles) THEN 'Child INSERT policy'
        WHEN cmd = 'SELECT' AND 'anon' = ANY(roles) THEN 'Child SELECT policy'
        WHEN cmd = 'INSERT' AND 'authenticated' = ANY(roles) THEN 'Parent INSERT policy'
        WHEN cmd = 'SELECT' AND 'authenticated' = ANY(roles) THEN 'Parent SELECT policy'
        ELSE 'Other policy'
    END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
ORDER BY cmd, policyname;

-- =====================================================
-- STEP 5: Try to manually verify the child record
-- =====================================================

SELECT 
    'Child Record Verification' as check_type,
    id,
    name,
    parent_id,
    created_at,
    CASE 
        WHEN id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid THEN '✅ Child ID matches'
        ELSE '❌ Child ID mismatch'
    END as id_match
FROM public.children
WHERE id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid;


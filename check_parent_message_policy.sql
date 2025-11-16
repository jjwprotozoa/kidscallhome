-- =====================================================
-- CHECK PARENT MESSAGE POLICY CONFIGURATION
-- =====================================================

-- =====================================================
-- STEP 1: Show parent INSERT policy expression
-- =====================================================
SELECT 
    'Parent Message INSERT Policy' as check_type,
    policyname,
    cmd as command,
    roles,
    with_check as policy_expression,
    with_check::text as expression_text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
  AND 'authenticated' = ANY(roles);

-- =====================================================
-- STEP 2: Show parent SELECT policy expression
-- =====================================================
SELECT 
    'Parent Message SELECT Policy' as check_type,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    qual::text as expression_text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'SELECT'
  AND 'authenticated' = ANY(roles);

-- =====================================================
-- STEP 3: Compare parent vs child policies
-- =====================================================
SELECT 
    'Policy Comparison' as check_type,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN cmd = 'INSERT' THEN with_check::text
        WHEN cmd = 'SELECT' THEN qual::text
    END as policy_expression,
    CASE 
        WHEN 'authenticated' = ANY(roles) THEN 'Parent Policy'
        WHEN 'anon' = ANY(roles) THEN 'Child Policy'
    END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
ORDER BY 
    CASE WHEN 'authenticated' = ANY(roles) THEN 1 ELSE 2 END,
    cmd;

-- =====================================================
-- STEP 4: Test parent policy logic (if you have a parent UUID)
-- =====================================================
-- Replace {parent_uuid} and {child_uuid} with actual values
/*
WITH test_parent_insert AS (
    SELECT 
        '{parent_uuid}'::uuid as test_sender_id,
        '{child_uuid}'::uuid as test_child_id,
        'parent'::text as test_sender_type,
        '{parent_uuid}'::uuid as test_auth_uid
)
SELECT 
    'Parent Policy Logic Test' as test_name,
    test_sender_id,
    test_child_id,
    test_sender_type,
    test_auth_uid,
    -- Check 1: sender_type
    CASE 
        WHEN test_sender_type = 'parent'::text THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as check1_sender_type,
    -- Check 2: sender_id = auth_uid
    CASE 
        WHEN test_sender_id = test_auth_uid THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as check2_sender_id_equals_auth_uid,
    -- Check 3: child belongs to parent
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = test_child_id
            AND parent_id = test_auth_uid
        ) THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as check3_child_belongs_to_parent,
    -- Final result
    CASE 
        WHEN test_sender_type = 'parent'::text 
         AND test_sender_id = test_auth_uid
         AND EXISTS (
            SELECT 1 FROM public.children
            WHERE id = test_child_id
            AND parent_id = test_auth_uid
        ) THEN '✅✅✅ ALL CHECKS PASS ✅✅✅'
        ELSE '❌❌❌ SOME CHECK FAILED ❌❌❌'
    END as final_result
FROM test_parent_insert;
*/


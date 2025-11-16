-- =====================================================
-- SIMPLE MESSAGE PAYLOAD TESTER
-- Copy this and replace the VALUES with your actual console log values
-- =====================================================

-- =====================================================
-- TEST PARENT MESSAGE INSERT
-- =====================================================
-- Replace the values below with values from your browser console log:
-- Look for: 📤 [MESSAGE INSERT] Payload: { ... }

WITH test_values AS (
    SELECT 
        'REPLACE_WITH_SENDER_ID'::uuid as sender_id,           -- From console: sender_id
        'REPLACE_WITH_SENDER_TYPE'::text as sender_type,       -- From console: sender_type (should be "parent")
        'REPLACE_WITH_CHILD_ID'::uuid as child_id,             -- From console: child_id
        'REPLACE_WITH_AUTH_UID'::uuid as auth_uid              -- From console: auth_uid
)
SELECT 
    'Parent Message Insert Test' as test_name,
    sender_id,
    sender_type,
    child_id,
    auth_uid,
    -- Check 1: sender_type must be 'parent'
    CASE 
        WHEN sender_type = 'parent' THEN '✅ PASS'
        ELSE '❌ FAIL - Expected "parent", got "' || sender_type || '"'
    END as check1_sender_type,
    -- Check 2: sender_id must equal auth.uid()
    CASE 
        WHEN sender_id = auth_uid THEN '✅ PASS'
        ELSE '❌ FAIL - sender_id (' || sender_id::text || ') does not match auth_uid (' || auth_uid::text || ')'
    END as check2_sender_id_match,
    -- Check 3: child must belong to parent
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = child_id
            AND parent_id = auth_uid
        ) THEN '✅ PASS'
        ELSE '❌ FAIL - Child does not belong to this parent'
    END as check3_child_belongs_to_parent,
    -- Overall result
    CASE 
        WHEN sender_type = 'parent' 
         AND sender_id = auth_uid
         AND EXISTS (
            SELECT 1 FROM public.children
            WHERE id = child_id
            AND parent_id = auth_uid
        ) THEN '✅ ALL CHECKS PASS - RLS should allow insert'
        ELSE '❌ CHECKS FAILED - RLS will block (403)'
    END as final_result
FROM test_values;

-- =====================================================
-- TEST CHILD MESSAGE INSERT
-- =====================================================
-- Replace the values below with values from your browser console log:

WITH test_values AS (
    SELECT 
        'REPLACE_WITH_SENDER_ID'::uuid as sender_id,           -- From console: sender_id
        'REPLACE_WITH_SENDER_TYPE'::text as sender_type,       -- From console: sender_type (should be "child")
        'REPLACE_WITH_CHILD_ID'::uuid as child_id              -- From console: child_id
)
SELECT 
    'Child Message Insert Test' as test_name,
    sender_id,
    sender_type,
    child_id,
    -- Check 1: sender_type must be 'child'
    CASE 
        WHEN sender_type = 'child' THEN '✅ PASS'
        ELSE '❌ FAIL - Expected "child", got "' || sender_type || '"'
    END as check1_sender_type,
    -- Check 2: sender_id must equal child_id
    CASE 
        WHEN sender_id = child_id THEN '✅ PASS'
        ELSE '❌ FAIL - sender_id (' || sender_id::text || ') does not match child_id (' || child_id::text || ')'
    END as check2_sender_id_matches_child_id,
    -- Check 3: child must exist
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = child_id
            AND id = sender_id
        ) THEN '✅ PASS'
        ELSE '❌ FAIL - Child does not exist or sender_id mismatch'
    END as check3_child_exists,
    -- Overall result
    CASE 
        WHEN sender_type = 'child' 
         AND sender_id = child_id
         AND EXISTS (
            SELECT 1 FROM public.children
            WHERE id = child_id
            AND id = sender_id
        ) THEN '✅ ALL CHECKS PASS - RLS should allow insert'
        ELSE '❌ CHECKS FAILED - RLS will block (403)'
    END as final_result
FROM test_values;

-- =====================================================
-- QUICK VERIFICATION QUERIES
-- =====================================================

-- Verify a specific parent-child relationship exists
-- Replace {parent_uuid} and {child_uuid} with actual UUIDs
/*
SELECT 
    c.id as child_id,
    c.name as child_name,
    c.parent_id as child_parent_id,
    p.id as parent_auth_id,
    p.email as parent_email,
    CASE 
        WHEN c.parent_id = p.id THEN '✅ Relationship valid'
        ELSE '❌ Relationship invalid'
    END as relationship_status
FROM public.children c
LEFT JOIN auth.users p ON p.id = c.parent_id
WHERE c.id = '{child_uuid}'::uuid;
*/

-- Check if a UUID exists in auth.users (for parent verification)
-- Replace {uuid} with sender_id from console
/*
SELECT 
    id,
    email,
    created_at,
    '✅ This UUID exists in auth.users' as status
FROM auth.users
WHERE id = '{uuid}'::uuid;
*/

-- Check if a UUID exists in children table
-- Replace {uuid} with child_id from console
/*
SELECT 
    id,
    name,
    parent_id,
    '✅ Child exists' as status
FROM public.children
WHERE id = '{uuid}'::uuid;
*/


-- =====================================================
-- WORKING MESSAGE PAYLOAD TESTER
-- Works in Supabase SQL Editor (not psql)
-- 
-- INSTRUCTIONS:
-- 1. Send a message from your app
-- 2. Open browser console, find: 📤 [MESSAGE INSERT] Payload: { ... }
-- 3. Copy the UUIDs from that log
-- 4. Replace the UUIDs in the queries below (look for YOUR_*)
-- 5. Run the appropriate query (parent or child)
-- =====================================================

-- =====================================================
-- TEST PARENT MESSAGE INSERT
-- Use this if sender_type = "parent"
-- =====================================================
-- REPLACE THESE VALUES WITH YOUR ACTUAL VALUES FROM CONSOLE:
-- YOUR_SENDER_ID = sender_id from console log
-- YOUR_SENDER_TYPE = sender_type from console log (should be "parent")
-- YOUR_CHILD_ID = child_id from console log  
-- YOUR_AUTH_UID = auth_uid from console log

WITH test_payload AS (
    SELECT 
        '00000000-0000-0000-0000-000000000000'::uuid as sender_id,      -- REPLACE: YOUR_SENDER_ID
        'parent'::text as sender_type,                                  -- REPLACE: YOUR_SENDER_TYPE
        '00000000-0000-0000-0000-000000000000'::uuid as child_id,      -- REPLACE: YOUR_CHILD_ID
        '00000000-0000-0000-0000-000000000000'::uuid as auth_uid       -- REPLACE: YOUR_AUTH_UID
)
SELECT 
    'Parent Message Insert Test' as test_name,
    sender_id,
    sender_type,
    child_id,
    auth_uid,
    -- Check 1: sender_type must be 'parent'
    CASE 
        WHEN sender_type = 'parent' THEN '✅ PASS - sender_type is correct'
        ELSE '❌ FAIL - Expected "parent", got "' || sender_type || '"'
    END as check1_sender_type,
    -- Check 2: sender_id must equal auth_uid
    CASE 
        WHEN sender_id = auth_uid THEN '✅ PASS - sender_id matches auth_uid'
        ELSE '❌ FAIL - sender_id (' || sender_id::text || ') does NOT match auth_uid (' || auth_uid::text || ') - THIS IS LIKELY YOUR PROBLEM!'
    END as check2_sender_id_match,
    -- Check 3: child belongs to parent
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = child_id
            AND parent_id = auth_uid
        ) THEN '✅ PASS - Child belongs to parent'
        ELSE '❌ FAIL - Child does not belong to this parent'
    END as check3_child_belongs_to_parent,
    -- Final result
    CASE 
        WHEN sender_type = 'parent' 
         AND sender_id = auth_uid
         AND EXISTS (
            SELECT 1 FROM public.children
            WHERE id = child_id
            AND parent_id = auth_uid
        ) THEN '✅✅✅ ALL CHECKS PASS - RLS should allow insert ✅✅✅'
        ELSE '❌❌❌ CHECKS FAILED - RLS will block insert (403) ❌❌❌'
    END as final_result
FROM test_payload;

-- =====================================================
-- TEST CHILD MESSAGE INSERT
-- Use this if sender_type = "child"
-- =====================================================
-- REPLACE THESE VALUES WITH YOUR ACTUAL VALUES FROM CONSOLE:
-- YOUR_SENDER_ID = sender_id from console log
-- YOUR_SENDER_TYPE = sender_type from console log (should be "child")
-- YOUR_CHILD_ID = child_id from console log

WITH test_payload AS (
    SELECT 
        '00000000-0000-0000-0000-000000000000'::uuid as sender_id,      -- REPLACE: YOUR_SENDER_ID
        'child'::text as sender_type,                                   -- REPLACE: YOUR_SENDER_TYPE
        '00000000-0000-0000-0000-000000000000'::uuid as child_id       -- REPLACE: YOUR_CHILD_ID
)
SELECT 
    'Child Message Insert Test' as test_name,
    sender_id,
    sender_type,
    child_id,
    -- Check 1: sender_type must be 'child'
    CASE 
        WHEN sender_type = 'child' THEN '✅ PASS - sender_type is correct'
        ELSE '❌ FAIL - Expected "child", got "' || sender_type || '"'
    END as check1_sender_type,
    -- Check 2: sender_id must equal child_id
    CASE 
        WHEN sender_id = child_id THEN '✅ PASS - sender_id matches child_id'
        ELSE '❌ FAIL - sender_id (' || sender_id::text || ') does NOT match child_id (' || child_id::text || ') - THIS IS YOUR PROBLEM!'
    END as check2_sender_id_matches_child_id,
    -- Check 3: child exists
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = child_id
            AND id = sender_id
        ) THEN '✅ PASS - Child exists and sender_id matches'
        ELSE '❌ FAIL - Child does not exist or sender_id mismatch'
    END as check3_child_exists,
    -- Final result
    CASE 
        WHEN sender_type = 'child' 
         AND sender_id = child_id
         AND EXISTS (
            SELECT 1 FROM public.children
            WHERE id = child_id
            AND id = sender_id
        ) THEN '✅✅✅ ALL CHECKS PASS - RLS should allow insert ✅✅✅'
        ELSE '❌❌❌ CHECKS FAILED - RLS will block insert (403) ❌❌❌'
    END as final_result
FROM test_payload;

-- =====================================================
-- QUICK MANUAL CHECKS (Copy and modify these)
-- =====================================================

-- Check 1: Verify sender_id exists in auth.users (for parents)
-- Replace {sender_id} with your actual sender_id from console
/*
SELECT 
    id,
    email,
    '✅ This UUID exists in auth.users' as status
FROM auth.users
WHERE id = '{sender_id}'::uuid;
-- If no rows returned, sender_id is NOT auth.uid() - that's your problem!
*/

-- Check 2: Verify child belongs to parent
-- Replace {child_id} and {parent_id} with your actual values
/*
SELECT 
    c.id as child_id,
    c.name as child_name,
    c.parent_id,
    CASE 
        WHEN c.parent_id = '{parent_id}'::uuid THEN '✅ Child belongs to this parent'
        ELSE '❌ Child does NOT belong to this parent'
    END as status
FROM public.children c
WHERE c.id = '{child_id}'::uuid;
*/

-- Check 3: Compare sender_id vs auth_uid (for parents)
-- This shows if they match (they MUST match for RLS to pass)
/*
SELECT 
    '{sender_id_from_console}'::uuid as sender_id,
    '{auth_uid_from_console}'::uuid as auth_uid,
    CASE 
        WHEN '{sender_id_from_console}'::uuid = '{auth_uid_from_console}'::uuid 
        THEN '✅ MATCH - RLS will pass'
        ELSE '❌ MISMATCH - RLS will fail (403)'
    END as result;
*/


-- =====================================================
-- EASY MESSAGE PAYLOAD TESTER
-- 
-- INSTRUCTIONS:
-- 1. Send a message from your app
-- 2. Check browser console for: 📤 [MESSAGE INSERT] Payload: { ... }
-- 3. Copy the values from that log
-- 4. Replace the UUIDs and text below with your actual values
-- 5. Run this query
-- =====================================================

-- =====================================================
-- STEP 1: SET YOUR VALUES HERE
-- Replace everything between the quotes with your actual values
-- =====================================================

\set sender_id '''YOUR_SENDER_ID_HERE'''
\set sender_type '''YOUR_SENDER_TYPE_HERE'''
\set child_id '''YOUR_CHILD_ID_HERE'''
\set auth_uid '''YOUR_AUTH_UID_HERE'''

-- =====================================================
-- STEP 2: TEST PARENT MESSAGE (if sender_type = "parent")
-- =====================================================

SELECT 
    'Parent Message Insert Test' as test_name,
    :sender_id::uuid as sender_id,
    :sender_type::text as sender_type,
    :child_id::uuid as child_id,
    :auth_uid::uuid as auth_uid,
    -- Check 1: sender_type
    CASE 
        WHEN :sender_type::text = 'parent' THEN '✅ PASS'
        ELSE '❌ FAIL - Expected "parent", got "' || :sender_type::text || '"'
    END as check1_sender_type,
    -- Check 2: sender_id matches auth_uid
    CASE 
        WHEN :sender_id::uuid = :auth_uid::uuid THEN '✅ PASS'
        ELSE '❌ FAIL - sender_id does not match auth_uid'
    END as check2_sender_id_match,
    -- Check 3: child belongs to parent
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = :child_id::uuid
            AND parent_id = :auth_uid::uuid
        ) THEN '✅ PASS'
        ELSE '❌ FAIL - Child does not belong to this parent'
    END as check3_child_belongs_to_parent,
    -- Final result
    CASE 
        WHEN :sender_type::text = 'parent' 
         AND :sender_id::uuid = :auth_uid::uuid
         AND EXISTS (
            SELECT 1 FROM public.children
            WHERE id = :child_id::uuid
            AND parent_id = :auth_uid::uuid
        ) THEN '✅ ALL CHECKS PASS - RLS should allow insert'
        ELSE '❌ CHECKS FAILED - RLS will block (403)'
    END as final_result;

-- =====================================================
-- ALTERNATIVE: Use this version if psql variables don't work
-- Just replace the UUIDs directly in the query below
-- =====================================================

/*
-- TEST PARENT MESSAGE INSERT
-- Replace these UUIDs with your actual values from console log:

SELECT 
    'Parent Message Insert Test' as test_name,
    -- Check 1: sender_type must be 'parent'
    CASE 
        WHEN 'parent' = 'parent' THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as check1_sender_type,
    -- Check 2: sender_id must equal auth.uid()
    CASE 
        WHEN 'YOUR_SENDER_ID'::uuid = 'YOUR_AUTH_UID'::uuid THEN '✅ PASS'
        ELSE '❌ FAIL - sender_id does not match auth_uid'
    END as check2_sender_id_match,
    -- Check 3: child belongs to parent
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = 'YOUR_CHILD_ID'::uuid
            AND parent_id = 'YOUR_AUTH_UID'::uuid
        ) THEN '✅ PASS'
        ELSE '❌ FAIL - Child does not belong to this parent'
    END as check3_child_belongs_to_parent;
*/

-- =====================================================
-- QUICK MANUAL TEST (Copy and modify these)
-- =====================================================

-- Test 1: Verify sender_id exists in auth.users
-- Replace {sender_id} with your actual sender_id from console
/*
SELECT id, email 
FROM auth.users 
WHERE id = '{sender_id}'::uuid;
-- If no rows returned, sender_id is NOT auth.uid() - that's your problem!
*/

-- Test 2: Verify child belongs to parent
-- Replace {child_id} and {parent_id} with your actual values
/*
SELECT 
    c.id,
    c.name,
    c.parent_id,
    CASE 
        WHEN c.parent_id = '{parent_id}'::uuid THEN '✅ Child belongs to this parent'
        ELSE '❌ Child does NOT belong to this parent'
    END as status
FROM public.children c
WHERE c.id = '{child_id}'::uuid;
*/

-- Test 3: Check if sender_id matches auth.uid() for current user
-- This requires you to be logged in as the parent
/*
SELECT 
    auth.uid() as current_auth_uid,
    '{sender_id_from_console}'::uuid as sender_id_from_payload,
    CASE 
        WHEN auth.uid() = '{sender_id_from_console}'::uuid THEN '✅ Match - RLS will pass'
        ELSE '❌ Mismatch - RLS will fail (403)'
    END as result;
*/


-- =====================================================
-- QUICK TEST TEMPLATE - COPY AND PASTE YOUR VALUES
-- =====================================================
-- 
-- STEP 1: Send a message from your app
-- STEP 2: Open browser console, find: 📤 [MESSAGE INSERT] Payload: { ... }
-- STEP 3: Copy the values below
-- STEP 4: Paste them into this query (replace the YOUR_* placeholders)
-- STEP 5: Run in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- YOUR VALUES FROM CONSOLE LOG (REPLACE THESE):
-- =====================================================
-- sender_id: YOUR_SENDER_ID_HERE
-- sender_type: YOUR_SENDER_TYPE_HERE  (should be "parent" or "child")
-- child_id: YOUR_CHILD_ID_HERE
-- auth_uid: YOUR_AUTH_UID_HERE  (only for parent messages)

-- =====================================================
-- TEST PARENT MESSAGE INSERT
-- =====================================================
-- Use this if sender_type = "parent"

SELECT 
    'Parent Message Test' as test_type,
    'YOUR_SENDER_ID_HERE'::uuid as sender_id,
    'YOUR_SENDER_TYPE_HERE'::text as sender_type,
    'YOUR_CHILD_ID_HERE'::uuid as child_id,
    'YOUR_AUTH_UID_HERE'::uuid as auth_uid,
    
    -- Result checks
    CASE WHEN 'YOUR_SENDER_TYPE_HERE'::text = 'parent' 
         THEN '✅ sender_type is correct' 
         ELSE '❌ sender_type is wrong (expected "parent")' 
    END as check1,
    
    CASE WHEN 'YOUR_SENDER_ID_HERE'::uuid = 'YOUR_AUTH_UID_HERE'::uuid 
         THEN '✅ sender_id matches auth_uid' 
         ELSE '❌ sender_id does NOT match auth_uid - THIS IS LIKELY YOUR PROBLEM!' 
    END as check2,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM public.children
        WHERE id = 'YOUR_CHILD_ID_HERE'::uuid
        AND parent_id = 'YOUR_AUTH_UID_HERE'::uuid
    ) THEN '✅ child belongs to parent' 
         ELSE '❌ child does NOT belong to this parent' 
    END as check3;

-- =====================================================
-- TEST CHILD MESSAGE INSERT  
-- =====================================================
-- Use this if sender_type = "child"

SELECT 
    'Child Message Test' as test_type,
    'YOUR_SENDER_ID_HERE'::uuid as sender_id,
    'YOUR_SENDER_TYPE_HERE'::text as sender_type,
    'YOUR_CHILD_ID_HERE'::uuid as child_id,
    
    -- Result checks
    CASE WHEN 'YOUR_SENDER_TYPE_HERE'::text = 'child' 
         THEN '✅ sender_type is correct' 
         ELSE '❌ sender_type is wrong (expected "child")' 
    END as check1,
    
    CASE WHEN 'YOUR_SENDER_ID_HERE'::uuid = 'YOUR_CHILD_ID_HERE'::uuid 
         THEN '✅ sender_id matches child_id' 
         ELSE '❌ sender_id does NOT match child_id - THIS IS YOUR PROBLEM!' 
    END as check2,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM public.children
        WHERE id = 'YOUR_CHILD_ID_HERE'::uuid
        AND id = 'YOUR_SENDER_ID_HERE'::uuid
    ) THEN '✅ child exists and sender_id matches' 
         ELSE '❌ child does not exist or sender_id mismatch' 
    END as check3;

-- =====================================================
-- EXAMPLE WITH REAL VALUES (for reference)
-- =====================================================
/*
-- Example parent message test:
SELECT 
    'Parent Message Test' as test_type,
    '123e4567-e89b-12d3-a456-426614174000'::uuid as sender_id,
    'parent'::text as sender_type,
    '987fcdeb-51a2-43d7-8f9e-123456789abc'::uuid as child_id,
    '123e4567-e89b-12d3-a456-426614174000'::uuid as auth_uid,
    
    CASE WHEN 'parent'::text = 'parent' 
         THEN '✅ sender_type is correct' 
         ELSE '❌ sender_type is wrong' 
    END as check1,
    
    CASE WHEN '123e4567-e89b-12d3-a456-426614174000'::uuid = '123e4567-e89b-12d3-a456-426614174000'::uuid 
         THEN '✅ sender_id matches auth_uid' 
         ELSE '❌ sender_id does NOT match auth_uid' 
    END as check2,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM public.children
        WHERE id = '987fcdeb-51a2-43d7-8f9e-123456789abc'::uuid
        AND parent_id = '123e4567-e89b-12d3-a456-426614174000'::uuid
    ) THEN '✅ child belongs to parent' 
         ELSE '❌ child does NOT belong to this parent' 
    END as check3;
*/


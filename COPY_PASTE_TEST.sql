-- =====================================================
-- COPY-PASTE TEST - WORKS IN SUPABASE SQL EDITOR
-- =====================================================
-- 
-- STEP 1: Send a message from your app
-- STEP 2: Open browser console (F12)
-- STEP 3: Find: 📤 [MESSAGE INSERT] Payload: { ... }
-- STEP 4: Copy the UUIDs from that log
-- STEP 5: Replace the UUIDs below (the long zeros)
-- STEP 6: Run this query
-- =====================================================

-- =====================================================
-- FOR PARENT MESSAGES (sender_type = "parent")
-- =====================================================
-- Replace the zeros with your actual UUIDs from console log

SELECT 
    'Parent Test' as test,
    -- Replace this UUID with sender_id from console:
    '00000000-0000-0000-0000-000000000000'::uuid as sender_id,
    -- Replace this UUID with auth_uid from console:
    '00000000-0000-0000-0000-000000000000'::uuid as auth_uid,
    -- Replace this UUID with child_id from console:
    '00000000-0000-0000-0000-000000000000'::uuid as child_id,
    
    -- Results:
    CASE 
        WHEN '00000000-0000-0000-0000-000000000000'::uuid = '00000000-0000-0000-0000-000000000000'::uuid 
        THEN '✅ sender_id matches auth_uid'
        ELSE '❌ sender_id does NOT match auth_uid - THIS IS YOUR PROBLEM!'
    END as check1,
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = '00000000-0000-0000-0000-000000000000'::uuid
            AND parent_id = '00000000-0000-0000-0000-000000000000'::uuid
        )
        THEN '✅ child belongs to parent'
        ELSE '❌ child does NOT belong to this parent'
    END as check2;

-- =====================================================
-- FOR CHILD MESSAGES (sender_type = "child")
-- =====================================================
-- Replace the zeros with your actual UUIDs from console log

SELECT 
    'Child Test' as test,
    -- Replace this UUID with sender_id from console:
    '00000000-0000-0000-0000-000000000000'::uuid as sender_id,
    -- Replace this UUID with child_id from console:
    '00000000-0000-0000-0000-000000000000'::uuid as child_id,
    
    -- Results:
    CASE 
        WHEN '00000000-0000-0000-0000-000000000000'::uuid = '00000000-0000-0000-0000-000000000000'::uuid 
        THEN '✅ sender_id matches child_id'
        ELSE '❌ sender_id does NOT match child_id - THIS IS YOUR PROBLEM!'
    END as check1,
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = '00000000-0000-0000-0000-000000000000'::uuid
            AND id = '00000000-0000-0000-0000-000000000000'::uuid
        )
        THEN '✅ child exists'
        ELSE '❌ child does NOT exist'
    END as check2;


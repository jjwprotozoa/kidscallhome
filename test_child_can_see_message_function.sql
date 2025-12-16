-- Test Query: Verify child_can_see_message function works correctly
-- Run this in Supabase SQL Editor to test the function

-- =====================================================
-- STEP 1: Test the function with the actual conversation ID
-- =====================================================
SELECT 
    public.child_can_see_message('dea5baf6-5fca-4278-a37b-18f5a89cf19d', 'f91c9458-6ffc-44e6-81a7-a74b851f1d99') as can_see,
    'Should return TRUE if child can see messages in this conversation' as expected_result;

-- =====================================================
-- STEP 2: Test RLS policy as anon (child) role
-- =====================================================
-- This simulates what a child (anon user) can actually see
SET ROLE anon;

SELECT 
    m.id,
    m.sender_type,
    m.sender_id,
    m.family_member_id,
    m.conversation_id,
    m.child_id,
    LEFT(m.content, 50) as content_preview,
    m.created_at,
    CASE 
        WHEN m.sender_type = 'family_member' THEN '🔵 Family member message - SHOULD BE VISIBLE'
        WHEN m.sender_type = 'parent' THEN '🟢 Parent message - SHOULD BE VISIBLE'
        WHEN m.sender_type = 'child' THEN '🟡 Child message - SHOULD BE VISIBLE'
        ELSE '❓ Unknown'
    END as visibility_status,
    -- Test the function for each message
    public.child_can_see_message(m.conversation_id, m.child_id) as function_result
FROM public.messages m
WHERE m.conversation_id = 'dea5baf6-5fca-4278-a37b-18f5a89cf19d'
ORDER BY m.created_at;

RESET ROLE;

-- =====================================================
-- STEP 3: Verify the policy is using the function
-- =====================================================
-- Check the policy definition to ensure it's using the function
SELECT 
    'Policy Definition Check' as info,
    policyname,
    cmd as command,
    roles,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND policyname = 'Messages readable by participants and parents';

-- =====================================================
-- STEP 4: Count messages visible to child vs total
-- =====================================================
-- This will show how many messages a child can see
SET ROLE anon;

SELECT 
    COUNT(*) as total_visible_messages,
    COUNT(CASE WHEN sender_type = 'family_member' THEN 1 END) as family_member_messages_visible,
    COUNT(CASE WHEN sender_type = 'parent' THEN 1 END) as parent_messages_visible,
    COUNT(CASE WHEN sender_type = 'child' THEN 1 END) as child_messages_visible
FROM public.messages
WHERE conversation_id = 'dea5baf6-5fca-4278-a37b-18f5a89cf19d';

RESET ROLE;

-- Expected result: Should see all 7 messages (4 family member + 3 child)



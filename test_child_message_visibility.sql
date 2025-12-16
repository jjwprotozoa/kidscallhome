-- Test Query: Verify Child Can See Family Member Messages
-- Run this in Supabase SQL Editor to test if the RLS policy is working
-- Replace the conversation_id and child_id with actual values

-- =====================================================
-- STEP 1: Check what messages exist in the conversation
-- =====================================================
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
        WHEN m.sender_type = 'family_member' THEN '🔵 Family member message'
        WHEN m.sender_type = 'parent' THEN '🟢 Parent message'
        WHEN m.sender_type = 'child' THEN '🟡 Child message'
        ELSE '❓ Unknown'
    END as message_type
FROM public.messages m
WHERE m.conversation_id = 'dea5baf6-5fca-4278-a37b-18f5a89cf19d'
ORDER BY m.created_at;

-- =====================================================
-- STEP 2: Test RLS policy as anon (child) role
-- =====================================================
-- This simulates what a child (anon user) can see
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
    END as visibility_status
FROM public.messages m
WHERE m.conversation_id = 'dea5baf6-5fca-4278-a37b-18f5a89cf19d'
ORDER BY m.created_at;

RESET ROLE;

-- =====================================================
-- STEP 3: Verify conversation structure
-- =====================================================
SELECT 
    c.id as conversation_id,
    c.adult_id,
    c.child_id,
    c.adult_role,
    CASE 
        WHEN c.child_id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99' THEN '✅ Matches child'
        ELSE '❌ Does not match child'
    END as child_match,
    CASE 
        WHEN c.adult_role = 'family_member' THEN '✅ Family member conversation'
        WHEN c.adult_role = 'parent' THEN '✅ Parent conversation'
        ELSE '❓ Unknown role'
    END as conversation_type,
    -- Check if child_profile exists
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.child_profiles cp WHERE cp.id = c.child_id) 
        THEN '✅ child_profile exists'
        ELSE '❌ child_profile missing'
    END as child_profile_status
FROM public.conversations c
WHERE c.id = 'dea5baf6-5fca-4278-a37b-18f5a89cf19d';

-- =====================================================
-- STEP 4: Check if messages have conversation_id set
-- =====================================================
SELECT 
    COUNT(*) as total_messages,
    COUNT(CASE WHEN conversation_id IS NOT NULL THEN 1 END) as messages_with_conversation_id,
    COUNT(CASE WHEN conversation_id IS NULL THEN 1 END) as messages_without_conversation_id,
    COUNT(CASE WHEN sender_type = 'family_member' THEN 1 END) as family_member_messages,
    COUNT(CASE WHEN sender_type = 'parent' THEN 1 END) as parent_messages,
    COUNT(CASE WHEN sender_type = 'child' THEN 1 END) as child_messages
FROM public.messages
WHERE conversation_id = 'dea5baf6-5fca-4278-a37b-18f5a89cf19d'
   OR (child_id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99' AND conversation_id IS NULL);


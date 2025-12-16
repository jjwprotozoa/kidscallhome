-- Test RLS Isolation - Verify policies are actually working
-- Run this to see what messages are actually returned by RLS

-- =====================================================
-- STEP 1: Get user IDs
-- =====================================================
SELECT 
    'User IDs' as info,
    u.id,
    u.email,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.parents WHERE id = u.id) THEN 'Parent'
        WHEN EXISTS (SELECT 1 FROM public.family_members WHERE id = u.id AND status = 'active') THEN 'Family Member'
        ELSE 'Unknown'
    END as user_type
FROM auth.users u
WHERE u.email IN ('jjwprotozoagmail.com', 'justwessels@gmail.com')
ORDER BY u.email;

-- =====================================================
-- STEP 2: Test what family member can see (simulated)
-- =====================================================
-- Replace FAMILY_MEMBER_USER_ID with the actual ID from STEP 1
-- This simulates what the RLS policy returns
/*
-- First, set the role and user context
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = 'FAMILY_MEMBER_USER_ID';

-- Now query messages - RLS should filter automatically
SELECT 
    'Messages visible to family member (RLS active)' as test_type,
    id,
    sender_type,
    sender_id,
    family_member_id,
    child_id,
    LEFT(content, 50) as content_preview,
    created_at,
    CASE 
        WHEN sender_type = 'parent' THEN '❌ ERROR: Should NOT see parent messages!'
        WHEN sender_type = 'child' THEN '✅ Correct: Can see child messages'
        WHEN sender_type = 'family_member' AND family_member_id = 'FAMILY_MEMBER_USER_ID' THEN '✅ Correct: Can see own messages'
        WHEN sender_type = 'family_member' THEN '❌ ERROR: Should NOT see other family member messages!'
        ELSE '⚠️ Unknown'
    END as isolation_status
FROM public.messages
WHERE child_id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'  -- Replace with actual child ID
ORDER BY created_at DESC;
*/

-- =====================================================
-- STEP 3: Verify policy definitions are correct
-- =====================================================
SELECT 
    'Policy Definition Check' as check_type,
    policyname,
    cmd,
    roles,
    -- Show a snippet of the USING clause
    LEFT(qual::text, 200) as policy_condition_preview
FROM pg_policies
WHERE tablename = 'messages'
AND cmd = 'SELECT'
AND policyname LIKE '%isolated%'
ORDER BY policyname;

-- =====================================================
-- STEP 4: Check if RLS is enabled on messages table
-- =====================================================
SELECT 
    'RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'messages';

-- RLS should be enabled (true). If false, that's the problem!












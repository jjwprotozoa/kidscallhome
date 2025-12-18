-- Direct RLS Test: Simulate what a family member actually sees
-- This will show if RLS is working or not

-- =====================================================
-- STEP 1: Get family member user ID
-- =====================================================
SELECT 
    'Family Member Info' as info,
    u.id as user_id,
    u.email,
    fm.id as family_member_id,
    fm.status,
    fm.parent_id
FROM auth.users u
LEFT JOIN public.family_members fm ON fm.id = u.id
WHERE u.email = 'jjwprotozoagmail.com';

-- =====================================================
-- STEP 2: Check RLS is enabled
-- =====================================================
SELECT 
    'RLS Status' as info,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'messages';

-- =====================================================
-- STEP 3: Test RLS by setting user context
-- =====================================================
-- Replace USER_ID_HERE with the actual user ID from STEP 1
-- This simulates what Supabase RLS returns for that user
/*
-- Set the authenticated user context
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = 'USER_ID_HERE';

-- Now query messages - RLS should automatically filter
SELECT 
    'RLS Filtered Results' as info,
    COUNT(*) as total_messages,
    COUNT(*) FILTER (WHERE sender_type = 'parent') as parent_messages,
    COUNT(*) FILTER (WHERE sender_type = 'child') as child_messages,
    COUNT(*) FILTER (WHERE sender_type = 'family_member') as family_member_messages
FROM public.messages
WHERE child_id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99';

-- If parent_messages > 0, RLS is NOT working correctly!
-- If parent_messages = 0, RLS is working correctly
*/

-- =====================================================
-- STEP 4: Show all messages without RLS (for comparison)
-- =====================================================
-- This shows what exists in the database (bypassing RLS)
SELECT 
    'All Messages (RLS Bypassed)' as info,
    sender_type,
    COUNT(*) as count
FROM public.messages
WHERE child_id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'
GROUP BY sender_type
ORDER BY sender_type;

-- Compare this with STEP 3 results to see if RLS is filtering















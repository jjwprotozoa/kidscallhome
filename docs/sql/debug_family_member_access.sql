-- Debug script: Test what family member can actually see
-- Run this to verify RLS policies are working correctly

-- =====================================================
-- STEP 1: Get family member user ID
-- =====================================================
SELECT 
    'Family Member User Info' as check_type,
    u.id as user_id,
    u.email,
    fm.id as family_member_id,
    fm.name,
    fm.status,
    fm.parent_id,
    p.email as parent_email
FROM auth.users u
LEFT JOIN public.family_members fm ON fm.id = u.id
LEFT JOIN public.parents p ON p.id = fm.parent_id
WHERE u.email = 'jjwprotozoagmail.com';

-- =====================================================
-- STEP 2: Get parent user ID (justwessels@gmail.com)
-- =====================================================
SELECT 
    'Parent User Info' as check_type,
    u.id as user_id,
    u.email,
    p.id as parent_id,
    p.name
FROM auth.users u
LEFT JOIN public.parents p ON p.id = u.id
WHERE u.email = 'justwessels@gmail.com';

-- =====================================================
-- STEP 3: Check which children belong to which family
-- =====================================================
SELECT 
    'Child Family Mapping' as check_type,
    c.id as child_id,
    c.name as child_name,
    c.parent_id,
    p.email as parent_email,
    -- Check if family member has access
    EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.parent_id = c.parent_id
        AND fm.id IN (SELECT id FROM auth.users WHERE email = 'jjwprotozoagmail.com')
        AND fm.status = 'active'
    ) as family_member_has_access
FROM public.children c
LEFT JOIN public.parents p ON p.id = c.parent_id
WHERE c.id IN (
    'f91c9458-6ffc-44e6-81a7-a74b851f1d99',
    'b791c91f-9e41-4ded-b05a-9260c2665841',
    '2f690a3e-fd0e-429c-b524-54102b048d13'
);

-- =====================================================
-- STEP 4: Test RLS policy as family member (simulated)
-- =====================================================
-- This shows what messages would be visible to family member
-- Replace FAMILY_MEMBER_USER_ID with actual user ID from STEP 1
/*
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = 'FAMILY_MEMBER_USER_ID';

SELECT 
    'Messages visible to family member (RLS active)' as check_type,
    id,
    sender_type,
    sender_id,
    family_member_id,
    child_id,
    LEFT(content, 50) as content_preview,
    created_at,
    CASE 
        WHEN sender_type = 'parent' THEN '❌ Should NOT see this'
        WHEN sender_type = 'child' THEN '✅ Should see this'
        WHEN sender_type = 'family_member' AND family_member_id = 'FAMILY_MEMBER_USER_ID' THEN '✅ Should see this'
        ELSE '❌ Should NOT see this'
    END as visibility_status
FROM public.messages
WHERE child_id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'  -- Replace with actual child ID
ORDER BY created_at DESC;
*/

-- =====================================================
-- STEP 5: Verify RLS policy definitions
-- =====================================================
SELECT 
    'RLS Policy Definitions' as check_type,
    policyname,
    cmd,
    roles,
    qual as using_clause
FROM pg_policies
WHERE tablename = 'messages'
AND cmd = 'SELECT'
AND policyname LIKE '%isolated%'
ORDER BY policyname;

-- =====================================================
-- STEP 6: Check if user is both parent AND family member
-- =====================================================
-- This shouldn't happen, but if it does, it could cause issues
SELECT 
    'Users who are both parent and family member' as check_type,
    u.id,
    u.email,
    p.id as parent_id,
    fm.id as family_member_id,
    fm.status
FROM auth.users u
INNER JOIN public.parents p ON p.id = u.id
INNER JOIN public.family_members fm ON fm.id = u.id
WHERE u.email = 'jjwprotozoagmail.com';


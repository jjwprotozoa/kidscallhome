-- Test: See what RLS actually returns for a family member
-- This will show if RLS is working or if there's a policy issue

-- =====================================================
-- STEP 1: Get family member user ID
-- =====================================================
SELECT 
    'Family Member User' as info,
    u.id as user_id,
    u.email,
    fm.id as family_member_id,
    fm.status,
    fm.parent_id
FROM auth.users u
LEFT JOIN public.family_members fm ON fm.id = u.id
WHERE u.email = 'jjwprotozoagmail.com';

-- =====================================================
-- STEP 2: Check if user is BOTH parent AND family member
-- =====================================================
-- This would cause both policies to match!
SELECT 
    'User Role Check' as info,
    u.id,
    u.email,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.parents WHERE id = u.id) THEN '✅ Is Parent'
        ELSE '❌ Not Parent'
    END as is_parent,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.family_members WHERE id = u.id AND status = 'active') THEN '✅ Is Family Member'
        ELSE '❌ Not Family Member'
    END as is_family_member,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.parents WHERE id = u.id)
         AND EXISTS (SELECT 1 FROM public.family_members WHERE id = u.id AND status = 'active')
        THEN '⚠️ PROBLEM: User is BOTH parent and family member!'
        ELSE '✅ User has single role'
    END as role_conflict
FROM auth.users u
WHERE u.email = 'jjwprotozoagmail.com';

-- =====================================================
-- STEP 3: Test RLS by simulating family member query
-- =====================================================
-- Replace USER_ID with the actual user ID from STEP 1
-- This simulates what Supabase RLS returns
/*
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = 'USER_ID_HERE';

SELECT 
    'RLS Test Results' as info,
    id,
    sender_type,
    sender_id,
    family_member_id,
    LEFT(content, 50) as content,
    created_at,
    CASE 
        WHEN sender_type = 'parent' THEN '❌ ERROR: Should NOT see this!'
        WHEN sender_type = 'child' THEN '✅ OK: Can see child messages'
        WHEN sender_type = 'family_member' AND family_member_id = 'USER_ID_HERE' THEN '✅ OK: Own message'
        ELSE '⚠️ Check'
    END as status
FROM public.messages
WHERE child_id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'
ORDER BY created_at DESC;
*/

-- =====================================================
-- STEP 4: Check policy evaluation
-- =====================================================
-- Show which policies would match for a family member
SELECT 
    'Policy Match Analysis' as info,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN policyname LIKE '%parent%' THEN 
            'Would match if: NOT family_member AND owns child AND (own message OR child message)'
        WHEN policyname LIKE '%family%' THEN 
            'Would match if: IS family_member AND child in family AND (own message OR child message)'
        ELSE 'Other'
    END as match_conditions
FROM pg_policies
WHERE tablename = 'messages'
AND cmd = 'SELECT'
AND roles::text LIKE '%authenticated%'
ORDER BY policyname;

















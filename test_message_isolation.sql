-- Test script: Verify message isolation is working
-- Run this in Supabase SQL Editor to see what messages each user type can see

-- =====================================================
-- STEP 1: Check current policies and their definitions
-- =====================================================
SELECT 
    policyname,
    cmd,
    roles,
    qual as using_clause
FROM pg_policies
WHERE tablename = 'messages'
AND cmd = 'SELECT'
ORDER BY policyname;

-- =====================================================
-- STEP 2: Check if a user is both parent and family member
-- =====================================================
-- This shouldn't happen, but let's verify
SELECT 
    'Users who are both parent and family member' as check_type,
    p.id as user_id,
    p.email as parent_email,
    fm.email as family_member_email,
    fm.status as family_member_status
FROM public.parents p
INNER JOIN public.family_members fm ON fm.id = p.id
WHERE fm.status = 'active';

-- =====================================================
-- STEP 3: Test what messages a family member can see
-- =====================================================
-- Replace 'FAMILY_MEMBER_USER_ID' with the actual user ID of jjwprotozoagmail.com
-- This simulates what the RLS policy would return
/*
-- First, get the family member's user ID
SELECT id, email 
FROM auth.users 
WHERE email = 'jjwprotozoagmail.com';

-- Then test what messages they can see (replace USER_ID and CHILD_ID)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = 'USER_ID_HERE';

SELECT 
    id,
    sender_type,
    sender_id,
    family_member_id,
    child_id,
    LEFT(content, 50) as content_preview,
    created_at
FROM public.messages
WHERE child_id = 'CHILD_ID_HERE'
ORDER BY created_at;
*/

-- =====================================================
-- STEP 4: Check actual messages in database
-- =====================================================
-- This shows ALL messages (bypassing RLS) to see what exists
-- Run this as a superuser or with RLS disabled temporarily
SELECT 
    'All messages (RLS bypassed)' as info,
    id,
    sender_type,
    sender_id,
    family_member_id,
    child_id,
    LEFT(content, 50) as content_preview,
    created_at
FROM public.messages
ORDER BY created_at DESC
LIMIT 20;

-- =====================================================
-- STEP 5: Verify family member record exists and is active
-- =====================================================
SELECT 
    'Family member verification' as check_type,
    fm.id,
    fm.email,
    fm.name,
    fm.status,
    fm.parent_id,
    p.email as parent_email
FROM public.family_members fm
LEFT JOIN public.parents p ON p.id = fm.parent_id
WHERE fm.email = 'jjwprotozoagmail.com'
   OR fm.id IN (SELECT id FROM auth.users WHERE email = 'jjwprotozoagmail.com');

-- =====================================================
-- STEP 6: Check if old policy still exists (it shouldn't)
-- =====================================================
SELECT 
    'Old policy check' as check_type,
    policyname
FROM pg_policies
WHERE tablename = 'messages'
AND policyname = 'Family members can view messages in their family';

-- If this returns a row, the old policy still exists and needs to be dropped!






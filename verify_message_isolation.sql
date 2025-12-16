-- Verification script: Check if message isolation is working
-- Run this in Supabase SQL Editor to verify the policies are correct

-- =====================================================
-- STEP 1: Check if isolation policies exist
-- =====================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'messages'
AND policyname LIKE '%isolated%'
ORDER BY policyname;

-- =====================================================
-- STEP 2: Check all message policies
-- =====================================================
SELECT 
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY policyname;

-- =====================================================
-- STEP 3: Test as a family member (replace with actual family member user ID)
-- =====================================================
-- This will show what messages a family member can see
-- Replace 'FAMILY_MEMBER_USER_ID' with the actual user ID
/*
SET ROLE authenticated;
SET request.jwt.claim.sub = 'FAMILY_MEMBER_USER_ID';

SELECT 
    id,
    sender_type,
    sender_id,
    family_member_id,
    child_id,
    content,
    created_at
FROM public.messages
WHERE child_id = 'CHILD_ID_HERE'
ORDER BY created_at;
*/

-- =====================================================
-- STEP 4: Check if old policies still exist (they should be dropped)
-- =====================================================
SELECT 
    policyname
FROM pg_policies
WHERE tablename = 'messages'
AND (
    policyname = 'Parents can view messages for their children'
    OR policyname = 'Family members can view messages in their family'
);

-- If any of these exist, the migration hasn't fully run













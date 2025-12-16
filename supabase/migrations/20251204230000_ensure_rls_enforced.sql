-- Migration: Ensure RLS is properly enforced
-- Purpose: Verify RLS is enabled and policies are correct
-- Date: 2025-12-04

-- =====================================================
-- STEP 1: Ensure RLS is enabled on messages table
-- =====================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Verify RLS is enabled
-- =====================================================
SELECT 
    'RLS Status Check' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS is enabled'
        ELSE '❌ RLS is DISABLED - This is the problem!'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'messages';

-- =====================================================
-- STEP 3: Show current policy conditions
-- =====================================================
SELECT 
    'Current Policy Conditions' as check_type,
    policyname,
    cmd,
    roles,
    -- Show first 500 chars of the USING clause
    LEFT(qual::text, 500) as policy_condition
FROM pg_policies
WHERE tablename = 'messages'
AND cmd = 'SELECT'
AND policyname LIKE '%isolated%'
ORDER BY policyname;

-- =====================================================
-- STEP 4: Test if policies are working
-- =====================================================
-- This will help identify if the issue is with policy logic
-- Run this as a family member user to see what they can actually access
/*
-- Get family member user ID first
SELECT id FROM auth.users WHERE email = 'jjwprotozoagmail.com';

-- Then test (replace USER_ID with actual ID)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = 'USER_ID';

-- This query should ONLY return child messages and family member's own messages
-- It should NOT return parent messages
SELECT 
    id,
    sender_type,
    sender_id,
    family_member_id,
    LEFT(content, 50) as content_preview,
    created_at
FROM public.messages
WHERE child_id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'
ORDER BY created_at DESC;

-- If you see parent messages here, the RLS policies are NOT working correctly
*/












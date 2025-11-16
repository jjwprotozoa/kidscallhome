-- =====================================================
-- DIAGNOSTIC SCRIPT FOR 403 ERRORS ON MESSAGE INSERT
-- Run this in Supabase SQL Editor to diagnose RLS issues
-- =====================================================

-- =====================================================
-- STEP 1: Verify RLS is enabled
-- =====================================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'messages';

-- Expected: rls_enabled = true

-- =====================================================
-- STEP 2: List all current policies on messages table
-- =====================================================
SELECT 
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
ORDER BY 
    CASE cmd 
        WHEN 'SELECT' THEN 1
        WHEN 'INSERT' THEN 2
        WHEN 'UPDATE' THEN 3
        WHEN 'DELETE' THEN 4
    END,
    policyname;

-- Expected: 4 policies
-- 1. "Children can send messages" (INSERT, anon)
-- 2. "Children can view their messages" (SELECT, anon)
-- 3. "Parents can send messages" (INSERT, authenticated)
-- 4. "Parents can view messages for their children" (SELECT, authenticated)

-- =====================================================
-- STEP 3: Check messages table schema
-- =====================================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'messages'
ORDER BY ordinal_position;

-- Expected columns:
-- id, sender_id, sender_type, child_id, content, created_at

-- =====================================================
-- STEP 4: Verify parent INSERT policy requirements
-- =====================================================
-- This shows what the RLS policy expects for parent inserts
SELECT 
    'Parent INSERT Policy Requirements' as check_type,
    'sender_type must equal ''parent''' as requirement_1,
    'sender_id must equal auth.uid()' as requirement_2,
    'child_id must belong to parent (children.parent_id = auth.uid())' as requirement_3;

-- =====================================================
-- STEP 5: Verify child INSERT policy requirements
-- =====================================================
SELECT 
    'Child INSERT Policy Requirements' as check_type,
    'sender_type must equal ''child''' as requirement_1,
    'sender_id must equal child_id' as requirement_2,
    'child must exist and sender_id must match child.id' as requirement_3;

-- =====================================================
-- STEP 6: Test parent policy logic (replace with actual values)
-- =====================================================
-- Replace '{parent_uuid}' with the actual auth.uid() from your frontend
-- Replace '{child_uuid}' with the actual child_id from your frontend
-- 
-- This simulates what the RLS policy checks:
/*
SELECT 
    'Parent INSERT Test' as test_name,
    'parent' = 'parent' as sender_type_check,
    '{parent_uuid}' = '{parent_uuid}' as sender_id_check,
    EXISTS (
        SELECT 1 FROM public.children
        WHERE children.id = '{child_uuid}'::uuid
        AND children.parent_id = '{parent_uuid}'::uuid
    ) as child_belongs_to_parent_check;
*/

-- =====================================================
-- STEP 7: Check if a specific parent-child relationship exists
-- =====================================================
-- Replace '{parent_uuid}' and '{child_uuid}' with actual values from your frontend console log
-- Uncomment and run:
/*
SELECT 
    c.id as child_id,
    c.name as child_name,
    c.parent_id,
    p.id as parent_id_from_auth,
    c.parent_id = p.id as relationship_valid,
    p.id = '{parent_uuid}'::uuid as parent_matches_auth_uid
FROM public.children c
LEFT JOIN auth.users p ON p.id = c.parent_id
WHERE c.id = '{child_uuid}'::uuid;
*/

-- =====================================================
-- STEP 8: Verify auth.users vs parents table relationship
-- =====================================================
-- This checks if parents.id matches auth.users.id (required for RLS)
SELECT 
    'Auth Users vs Parents Table' as check_type,
    COUNT(DISTINCT au.id) as auth_users_count,
    COUNT(DISTINCT p.id) as parents_count,
    COUNT(DISTINCT CASE WHEN au.id = p.id THEN au.id END) as matching_ids
FROM auth.users au
LEFT JOIN public.parents p ON p.id = au.id;

-- Expected: matching_ids should equal parents_count
-- If not, parents table has IDs that don't match auth.users

-- =====================================================
-- STEP 9: Sample recent messages to see what was successfully inserted
-- =====================================================
SELECT 
    id,
    sender_id,
    sender_type,
    child_id,
    LEFT(content, 50) as content_preview,
    created_at
FROM public.messages
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- STEP 10: Check for common RLS policy issues
-- =====================================================
SELECT 
    'RLS Policy Check' as check_type,
    CASE 
        WHEN COUNT(*) = 4 THEN '✅ Correct number of policies (4)'
        ELSE '❌ Wrong number of policies: ' || COUNT(*)::text
    END as policy_count_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages';

SELECT 
    'INSERT Policy Check' as check_type,
    CASE 
        WHEN COUNT(*) >= 2 THEN '✅ INSERT policies exist'
        ELSE '❌ Missing INSERT policies'
    END as insert_policy_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT';

-- =====================================================
-- INSTRUCTIONS FOR USE:
-- =====================================================
-- 1. Run this entire script in Supabase SQL Editor
-- 2. Check the output of STEP 2 - verify 4 policies exist
-- 3. Check STEP 8 - verify parents.id matches auth.users.id
-- 4. When you get a 403 error, check your browser console for the payload log
-- 5. Use the payload values in STEP 6 and STEP 7 to verify the relationship
-- 6. Common issues:
--    a) sender_id !== auth.uid() for parents
--    b) sender_type !== 'parent' or 'child' (case sensitive!)
--    c) child_id doesn't belong to parent
--    d) sender_id !== child_id for children


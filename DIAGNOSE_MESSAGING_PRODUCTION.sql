-- DIAGNOSE_MESSAGING_PRODUCTION.sql
-- Diagnostic script to check why child-to-parent messaging works in dev but not prod
-- Run this in Supabase SQL Editor

-- =====================================================
-- STEP 1: Check current RLS policies for messages
-- =====================================================
SELECT 
    'Current Messages Policies' as info,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
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

-- =====================================================
-- STEP 2: Verify children table has anon SELECT policy
-- (Required for child INSERT policy to work)
-- =====================================================
SELECT 
    'Children Table Policies (anon)' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
  AND 'anon' = ANY(roles)
ORDER BY policyname;

-- =====================================================
-- STEP 3: Check if realtime is enabled for messages
-- =====================================================
SELECT 
    'Realtime Status' as info,
    tablename,
    CASE 
        WHEN tablename IS NOT NULL THEN '✅ Enabled'
        ELSE '❌ NOT Enabled'
    END as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND schemaname = 'public'
  AND tablename = 'messages';

-- =====================================================
-- STEP 4: Test parent SELECT policy
-- (This simulates what realtime needs to do)
-- =====================================================
-- Replace PARENT_ID and CHILD_ID with actual IDs from your database
-- This query should return messages if parent SELECT policy is working
/*
SELECT 
    'Test Parent SELECT Policy' as test,
    id,
    sender_type,
    sender_id,
    child_id,
    content,
    created_at
FROM public.messages
WHERE child_id = 'CHILD_ID_HERE'
ORDER BY created_at DESC
LIMIT 5;
*/

-- =====================================================
-- STEP 5: Test child SELECT policy
-- (This simulates what realtime needs to do for children)
-- =====================================================
-- Replace CHILD_ID with actual ID
-- This query should return messages if child SELECT policy is working
/*
SELECT 
    'Test Child SELECT Policy' as test,
    id,
    sender_type,
    sender_id,
    child_id,
    content,
    created_at
FROM public.messages
WHERE child_id = 'CHILD_ID_HERE'
ORDER BY created_at DESC
LIMIT 5;
*/

-- =====================================================
-- STEP 6: Check for potential issues
-- =====================================================

-- Check if parent SELECT policy uses EXISTS correctly
SELECT 
    'Parent SELECT Policy Details' as info,
    policyname,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND policyname = 'Parents can view messages for their children'
  AND cmd = 'SELECT';

-- Check if child SELECT policy exists and is correct
SELECT 
    'Child SELECT Policy Details' as info,
    policyname,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND policyname = 'Children can view their messages'
  AND cmd = 'SELECT';

-- =====================================================
-- EXPECTED RESULTS:
-- =====================================================
-- 1. Should see 4 policies:
--    - "Children can send messages" (INSERT, anon)
--    - "Children can view their messages" (SELECT, anon)
--    - "Parents can send messages" (INSERT, authenticated)
--    - "Parents can view messages for their children" (SELECT, authenticated)
--
-- 2. Should see "Anyone can verify login codes" policy on children table
--
-- 3. Should see "✅ Enabled" for messages table in realtime
--
-- 4. Parent SELECT policy should use EXISTS subquery checking children.parent_id = auth.uid()
--
-- 5. Child SELECT policy should use EXISTS subquery checking children.id = messages.child_id
-- =====================================================


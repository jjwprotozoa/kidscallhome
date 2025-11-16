-- FIX_MESSAGING_RLS_PRODUCTION.sql
-- Fix RLS policies to ensure child-to-parent messaging works in production
-- Run this in Supabase SQL Editor

-- =====================================================
-- ISSUE: Child-to-parent messages work in dev but not prod
-- Root Cause: Parent SELECT policy may not allow realtime subscriptions
-- =====================================================

-- =====================================================
-- STEP 1: Ensure children table allows anonymous reads
-- (Required for child INSERT policy EXISTS checks)
-- =====================================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- =====================================================
-- STEP 2: Drop and recreate parent SELECT policy
-- (Ensure it works correctly for realtime subscriptions)
-- =====================================================
DROP POLICY IF EXISTS "Parents can view messages for their children" ON public.messages;

CREATE POLICY "Parents can view messages for their children"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = messages.child_id
    AND children.parent_id = auth.uid()
  )
);

-- =====================================================
-- STEP 3: Ensure child SELECT policy exists and is correct
-- =====================================================
DROP POLICY IF EXISTS "Children can view their messages" ON public.messages;

CREATE POLICY "Children can view their messages"
ON public.messages
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = messages.child_id
  )
);

-- =====================================================
-- STEP 4: Verify child INSERT policy is correct
-- =====================================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

CREATE POLICY "Children can send messages"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  sender_type = 'child' AND
  sender_id = child_id AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = messages.child_id
    AND children.id = messages.sender_id
  )
);

-- =====================================================
-- STEP 5: Verify parent INSERT policy is correct
-- =====================================================
DROP POLICY IF EXISTS "Parents can send messages" ON public.messages;

CREATE POLICY "Parents can send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'parent' AND
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = messages.child_id
    AND children.parent_id = auth.uid()
  )
);

-- =====================================================
-- STEP 6: Verify realtime is enabled
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    RAISE NOTICE '✅ Added messages table to realtime publication';
  ELSE
    RAISE NOTICE '✅ Messages table already in realtime publication';
  END IF;
END $$;

-- =====================================================
-- STEP 7: Verify all policies were created correctly
-- =====================================================
SELECT 
    'Messages Policies Verification' as info,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN qual IS NOT NULL THEN '✅ Has USING'
        ELSE '❌ Missing USING'
    END as using_status,
    CASE 
        WHEN with_check IS NOT NULL THEN '✅ Has WITH CHECK'
        ELSE '❌ Missing WITH CHECK'
    END as with_check_status
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
-- EXPECTED OUTPUT:
-- =====================================================
-- Should see 4 policies:
-- 1. "Children can send messages" (INSERT, anon) ✅
-- 2. "Children can view their messages" (SELECT, anon) ✅
-- 3. "Parents can send messages" (INSERT, authenticated) ✅
-- 4. "Parents can view messages for their children" (SELECT, authenticated) ✅
-- =====================================================

-- =====================================================
-- STEP 8: Test query (run as authenticated parent)
-- =====================================================
-- Replace CHILD_ID with an actual child ID that belongs to the parent
-- This should return messages if parent SELECT policy is working
/*
SELECT 
    'Test Parent SELECT' as test,
    id,
    sender_type,
    sender_id,
    child_id,
    LEFT(content, 50) as content_preview,
    created_at
FROM public.messages
WHERE child_id = 'CHILD_ID_HERE'
ORDER BY created_at DESC
LIMIT 5;
*/

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. Realtime subscriptions require SELECT permissions
-- 2. If parent can't SELECT messages, they won't receive realtime events
-- 3. The parent SELECT policy checks: child belongs to parent (children.parent_id = auth.uid())
-- 4. This ensures parents only see messages for their own children
-- 5. The code now includes polling fallback (every 3 seconds) if realtime fails
-- =====================================================


-- Migration: Fix Child Chat RLS Policies
-- Purpose: Ensure children can read parent names and send messages
-- Date: 2025-01-15

-- =====================================================
-- STEP 1: Ensure children table allows anonymous reads
-- (Required for all child RLS policies)
-- =====================================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- Grant explicit permissions
GRANT SELECT ON public.children TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- =====================================================
-- STEP 2: Ensure children can read parent names
-- =====================================================
DROP POLICY IF EXISTS "Children can view their parent's name" ON public.parents;

CREATE POLICY "Children can view their parent's name"
ON public.parents
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.parent_id = parents.id
  )
);

-- Grant explicit permissions
GRANT SELECT ON public.parents TO anon;

-- =====================================================
-- STEP 3: Ensure children can send messages
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
    WHERE children.id = child_id
    AND children.id = sender_id
  )
);

-- =====================================================
-- STEP 4: Ensure children can view their messages
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
-- STEP 5: Verify policies were created
-- =====================================================
SELECT 
    'Policy Verification' as info,
    tablename,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (tablename = 'parents' AND policyname = 'Children can view their parent''s name')
    OR
    (tablename = 'messages' AND policyname IN ('Children can send messages', 'Children can view their messages'))
    OR
    (tablename = 'children' AND policyname = 'Anyone can verify login codes')
  )
ORDER BY tablename, cmd;




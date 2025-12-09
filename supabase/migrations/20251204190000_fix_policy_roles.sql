-- Migration: Fix Policy Roles
-- Purpose: Ensure policies have correct roles (no anon/authenticated mix, no public)
-- Date: 2025-12-04
-- Issue: 
--   1. "Children can send messages" has both anon and authenticated (should be anon only)
--   2. "Family members can send messages" has public (should be authenticated)

-- =====================================================
-- STEP 1: Fix "Children can send messages" policy
-- =====================================================
-- Children are anonymous users, should NOT have authenticated role
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

CREATE POLICY "Children can send messages"
  ON public.messages FOR INSERT
  TO anon  -- ONLY anon, not authenticated
  WITH CHECK (
    sender_type = 'child' AND
    sender_id = child_id AND
    EXISTS (
      SELECT 1 
      FROM public.children 
      WHERE children.id = messages.child_id
        AND children.id = messages.sender_id
    )
  );

-- =====================================================
-- STEP 2: Fix "Family members can send messages" policy
-- =====================================================
-- Family members are authenticated users, should NOT have public role
-- The original migration didn't specify TO authenticated, so it defaulted to public
DROP POLICY IF EXISTS "Family members can send messages" ON public.messages;

CREATE POLICY "Family members can send messages"
  ON public.messages FOR INSERT
  TO authenticated  -- authenticated, not public
  WITH CHECK (
    sender_type = 'family_member' AND
    family_member_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.children c ON c.parent_id = fm.parent_id
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
      AND c.id = child_id
    )
  );

-- =====================================================
-- STEP 3: Verify policies have correct roles
-- =====================================================
SELECT 
    'Policy Role Verification' as check_type,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN policyname = 'Children can send messages' AND 'anon' = ANY(roles) AND array_length(roles, 1) = 1 THEN '✅ Correct'
        WHEN policyname = 'Children can send messages' THEN '❌ Wrong - should be {anon} only'
        WHEN policyname = 'Family members can send messages' AND 'authenticated' = ANY(roles) AND 'public' != ANY(roles) THEN '✅ Correct'
        WHEN policyname = 'Family members can send messages' THEN '❌ Wrong - should be {authenticated} only'
        ELSE 'N/A'
    END as status
FROM pg_policies
WHERE tablename = 'messages'
AND policyname IN ('Children can send messages', 'Family members can send messages')
ORDER BY policyname;

-- =====================================================
-- Migration complete
-- =====================================================
-- Result: 
-- - Children policies: {anon} only
-- - Family member policies: {authenticated} only
-- - No mixed roles, no public roles


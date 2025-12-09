-- Migration: Fix RLS Policy Logic for Message Isolation
-- Purpose: Ensure policies are mutually exclusive and correctly filter messages
-- Date: 2025-12-04
-- Issue: Family members can still see parent messages despite policies
-- Root Cause: Policy conditions might not be strict enough or have logic errors

-- =====================================================
-- STEP 1: Drop existing isolated policies
-- =====================================================
DROP POLICY IF EXISTS "Parents can view isolated messages for their children" ON public.messages;
DROP POLICY IF EXISTS "Family members can view isolated messages" ON public.messages;

-- =====================================================
-- STEP 2: Create stricter parent policy
-- =====================================================
-- CRITICAL: Must check user is NOT a family member FIRST
-- Then check ownership and message type
CREATE POLICY "Parents can view isolated messages for their children"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    -- FIRST: User must be a parent (NOT a family member)
    -- This ensures family members can't match this policy
    NOT EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_members.id = auth.uid()
      AND family_members.status = 'active'
    )
    -- SECOND: Must be a child they own
    AND EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
      AND children.parent_id = auth.uid()
    )
    -- THIRD: Only their own messages OR child messages
    AND (
      (sender_type = 'parent' AND sender_id = auth.uid())
      OR
      sender_type = 'child'
    )
    -- FOURTH: Explicitly exclude family member messages
    AND sender_type != 'family_member'
  );

-- =====================================================
-- STEP 3: Create stricter family member policy
-- =====================================================
-- CRITICAL: Must check user IS a family member FIRST
-- Then check family relationship and message type
CREATE POLICY "Family members can view isolated messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    -- FIRST: User must be an active family member
    -- This ensures parents can't match this policy
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
    )
    -- SECOND: Must be a child in their family
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.children c ON c.parent_id = fm.parent_id
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
      AND c.id = messages.child_id
    )
    -- THIRD: Only their own messages OR child messages
    AND (
      (sender_type = 'family_member' AND family_member_id = auth.uid())
      OR
      sender_type = 'child'
    )
    -- FOURTH: Explicitly exclude parent messages
    AND sender_type != 'parent'
    -- FIFTH: Explicitly exclude other family members' messages
    AND NOT (
      sender_type = 'family_member' 
      AND (family_member_id IS NULL OR family_member_id != auth.uid())
    )
  );

-- =====================================================
-- STEP 4: Verify policies are mutually exclusive
-- =====================================================
-- Test that a family member can't match parent policy
SELECT 
    'Policy Mutually Exclusive Check' as check_type,
    'Family members should NOT match parent policy' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies p1
            CROSS JOIN pg_policies p2
            WHERE p1.tablename = 'messages'
            AND p2.tablename = 'messages'
            AND p1.policyname = 'Parents can view isolated messages for their children'
            AND p2.policyname = 'Family members can view isolated messages'
            AND p1.cmd = 'SELECT'
            AND p2.cmd = 'SELECT'
        ) THEN '✅ Both policies exist'
        ELSE '❌ Missing policies'
    END as status;

-- =====================================================
-- STEP 5: Show final policy definitions
-- =====================================================
SELECT 
    'Final Policy Definitions' as check_type,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN policyname LIKE '%parent%' AND qual::text LIKE '%NOT EXISTS%family_members%' THEN '✅ Has family member exclusion'
        WHEN policyname LIKE '%family%' AND qual::text LIKE '%EXISTS%family_members%' THEN '✅ Has family member check'
        ELSE '⚠️ Check manually'
    END as logic_check
FROM pg_policies
WHERE tablename = 'messages'
AND cmd = 'SELECT'
AND policyname LIKE '%isolated%'
ORDER BY policyname;






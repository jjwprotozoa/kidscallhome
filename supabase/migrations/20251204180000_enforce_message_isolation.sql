-- Migration: Enforce Message Isolation (WhatsApp-style)
-- Purpose: Ensure each adult (parent/family member) has isolated conversations with children
-- Date: 2025-12-04
-- Issue: Parents and family members could see each other's messages
-- Solution: Each adult can only see their own messages + child messages

-- =====================================================
-- STEP 1: Drop ALL existing message SELECT policies for authenticated users
-- =====================================================
-- Drop old policies that don't enforce isolation
DROP POLICY IF EXISTS "Parents can view messages for their children" ON public.messages;
DROP POLICY IF EXISTS "Family members can view messages in their family" ON public.messages;
DROP POLICY IF EXISTS "Parents can view isolated messages for their children" ON public.messages;
DROP POLICY IF EXISTS "Family members can view isolated messages" ON public.messages;

-- =====================================================
-- STEP 2: Create isolated parent SELECT policy
-- =====================================================
-- Parents can ONLY see:
-- 1. Messages they sent (sender_type='parent' AND sender_id=auth.uid())
-- 2. Messages from the child (sender_type='child')
-- They CANNOT see family member messages
-- CRITICAL: Must check they're NOT a family member first to avoid conflicts
CREATE POLICY "Parents can view isolated messages for their children"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    -- User must be a parent (not a family member)
    NOT EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_members.id = auth.uid()
      AND family_members.status = 'active'
    )
    -- Must be a child they own
    AND EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = messages.child_id
      AND children.parent_id = auth.uid()
    )
    AND (
      -- Parent's own messages
      (sender_type = 'parent' AND sender_id = auth.uid())
      OR
      -- Child messages
      sender_type = 'child'
    )
    -- Explicitly exclude family member messages
    AND sender_type != 'family_member'
  );

-- =====================================================
-- STEP 3: Create isolated family member SELECT policy
-- =====================================================
-- Family members can ONLY see:
-- 1. Messages they sent (sender_type='family_member' AND family_member_id=auth.uid())
-- 2. Messages from the child (sender_type='child')
-- They CANNOT see parent messages or other family member messages
CREATE POLICY "Family members can view isolated messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    -- User must be an active family member
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
    )
    -- Must be a child in their family
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.children c ON c.parent_id = fm.parent_id
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
      AND c.id = messages.child_id
    )
    AND (
      -- This family member's own messages
      (sender_type = 'family_member' AND family_member_id = auth.uid())
      OR
      -- Child messages
      sender_type = 'child'
    )
    -- Explicitly exclude parent messages
    AND sender_type != 'parent'
    -- Explicitly exclude other family members' messages
    AND NOT (sender_type = 'family_member' AND (family_member_id IS NULL OR family_member_id != auth.uid()))
  );

-- =====================================================
-- Migration complete
-- =====================================================
-- Result: Each adult now has isolated conversations with children
-- - Parent <> Child (isolated)
-- - Grandparent <> Child (isolated)
-- - Aunt <> Child (isolated)
-- - etc.
-- Just like WhatsApp, each conversation is private


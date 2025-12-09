-- Migration: Force Remove Old Message Policies
-- Purpose: Ensure old policies that don't enforce isolation are completely removed
-- Date: 2025-12-04
-- Issue: Old "Family members can view messages in their family" policy might still exist
--        and allowing family members to see parent messages

-- =====================================================
-- STEP 1: Drop ALL old policies that don't enforce isolation
-- =====================================================
-- These are the old policies that allowed family members to see all messages
DROP POLICY IF EXISTS "Family members can view messages in their family" ON public.messages;
DROP POLICY IF EXISTS "Parents can view messages for their children" ON public.messages;

-- =====================================================
-- STEP 2: Verify only isolated policies exist
-- =====================================================
-- Check what policies currently exist
SELECT 
    'Current SELECT Policies' as check_type,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'messages'
AND cmd = 'SELECT'
ORDER BY policyname;

-- =====================================================
-- STEP 3: If isolated policies don't exist, recreate them
-- =====================================================
-- Only run this if the isolated policies are missing
DO $$
BEGIN
    -- Check if isolated parent policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'messages' 
        AND policyname = 'Parents can view isolated messages for their children'
    ) THEN
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
    END IF;

    -- Check if isolated family member policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'messages' 
        AND policyname = 'Family members can view isolated messages'
    ) THEN
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
    END IF;
END $$;

-- =====================================================
-- STEP 4: Final verification
-- =====================================================
SELECT 
    'Final Policy Check' as check_type,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN policyname LIKE '%isolated%' THEN '✅ Correct'
        WHEN policyname = 'Family members can view messages in their family' THEN '❌ OLD - Should be removed'
        WHEN policyname = 'Parents can view messages for their children' THEN '❌ OLD - Should be removed'
        ELSE '⚠️ Check manually'
    END as status
FROM pg_policies
WHERE tablename = 'messages'
AND cmd = 'SELECT'
ORDER BY policyname;






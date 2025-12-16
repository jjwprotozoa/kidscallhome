-- supabase/migrations/20251212000001_fix_parent_message_rls.sql
-- Fix RLS policies for parent-initiated messages
-- Ensures parents can send messages to their children

-- ============================================
-- STEP 1: Drop existing parent message policies to recreate them
-- ============================================
DROP POLICY IF EXISTS "Parents can send messages" ON public.messages;
DROP POLICY IF EXISTS "Parents can send messages to their children" ON public.messages;
DROP POLICY IF EXISTS "Adults can send messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Parents can send messages in their conversations" ON public.messages;

-- ============================================
-- STEP 2: Create parent INSERT policy
-- ============================================
-- Parent can INSERT messages to their own children (with permission check)
-- This policy allows authenticated parents to create messages where:
-- 1. sender_type = 'parent'
-- 2. sender_id matches auth.uid()
-- 3. The child belongs to the parent (supports both old and new schema)
-- 4. Communication is allowed (not blocked, etc.)
CREATE POLICY "Parents can send messages to their children"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'parent' AND
    sender_id = auth.uid() AND
    -- Verify parent owns this child
    -- Support both new schema (child_family_memberships + adult_profiles) and old schema (children table)
    (
      -- New schema: Check via child_family_memberships and adult_profiles
      EXISTS (
        SELECT 1 FROM public.child_family_memberships cfm
        JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
        WHERE cfm.child_profile_id = messages.child_id
          AND ap.user_id = auth.uid()
          AND ap.role = 'parent'
      )
      OR
      -- Fallback: Old schema - check via children table (for backward compatibility)
      EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = messages.child_id
          AND c.parent_id = auth.uid()
      )
    ) AND
    -- CRITICAL: Check communication permission (blocks, etc.)
    -- Note: If can_users_communicate function doesn't exist or fails, 
    -- the policy will fail. Ensure the function is properly created.
    can_users_communicate(
      p_sender_id := auth.uid(),
      p_sender_type := 'parent',
      p_receiver_id := messages.child_id,
      p_receiver_type := 'child'
    )
  );

-- ============================================
-- STEP 3: Ensure parent SELECT policy exists for viewing messages
-- ============================================
DROP POLICY IF EXISTS "Parents can view messages for their children" ON public.messages;
DROP POLICY IF EXISTS "Messages readable by participants and parents" ON public.messages;

-- Parents can view messages where they are the sender or the child belongs to them
CREATE POLICY "Parents can view messages for their children"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    -- Parent can see messages where they are the sender
    (sender_type = 'parent' AND sender_id = auth.uid())
    OR
    -- Parent can see messages for their children
    (
      child_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.child_family_memberships cfm
          JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
          WHERE cfm.child_profile_id = messages.child_id
            AND ap.user_id = auth.uid()
            AND ap.role = 'parent'
        )
        OR
        EXISTS (
          SELECT 1 FROM public.children c
          WHERE c.id = messages.child_id
            AND c.parent_id = auth.uid()
        )
      )
    )
  );

-- ============================================
-- STEP 4: Ensure parent UPDATE policy exists (if needed)
-- ============================================
-- Note: Messages are typically immutable, but if you need updates, add policy here

COMMENT ON POLICY "Parents can send messages to their children" ON public.messages IS 
'Allows authenticated parents to create messages to their own children. 
Requires: sender_type=parent, sender_id=auth.uid(), child belongs to parent via child_family_memberships or children table, and can_users_communicate returns true.';





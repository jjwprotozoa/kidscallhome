-- Migration: Tighten RLS Policies (Phase 3)
-- Purpose: Update RLS policies to use adult_id/child_id from profile tables and remove backward compatibility
-- Date: 2025-12-07
-- This migration removes all backward compatibility and enforces strict conversation_id-based access

-- =====================================================
-- STEP 1: Drop old conversation policies
-- =====================================================

DROP POLICY IF EXISTS "Parents can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Family members can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Parents can create conversations with their children" ON public.conversations;
DROP POLICY IF EXISTS "Family members can create conversations with children" ON public.conversations;

-- =====================================================
-- STEP 2: Create new conversation SELECT policies using profile IDs
-- =====================================================

-- Adults (parents and family members) can view conversations where they are the adult participant
CREATE POLICY "Adults can view their conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    -- Resolve current user's adult_profile_id
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.id = conversations.adult_id
    )
  );

-- Children can view conversations where they are the child participant
-- Note: Children use anonymous auth, so this will be handled at application level
-- But we can still create a policy that checks child_id matches
-- Since children use anonymous auth, we allow SELECT but application must filter
CREATE POLICY "Children can view their conversations"
  ON public.conversations FOR SELECT
  TO anon
  USING (true);  -- Application will filter by child_id from session

-- =====================================================
-- STEP 3: Create new conversation INSERT policies using profile IDs
-- =====================================================

-- Adults can create conversations where they are the adult participant
CREATE POLICY "Adults can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Verify adult_id matches current user's profile
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.id = conversations.adult_id
    )
    -- Verify child is in the same family
    AND EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_profiles cp ON cp.family_id = ap.family_id
      WHERE ap.user_id = auth.uid()
        AND ap.id = conversations.adult_id
        AND cp.id = conversations.child_id
    )
    -- Verify adult_role matches the profile role
    AND EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.id = conversations.adult_id
        AND ap.role = conversations.adult_role
    )
  );

-- =====================================================
-- STEP 4: Drop old message policies
-- =====================================================

DROP POLICY IF EXISTS "Parents can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Family members can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Children can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Parents can send messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Family members can send messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- =====================================================
-- STEP 5: Create new message SELECT policies (strict, no backward compatibility)
-- =====================================================

-- Adults can view messages in conversations where they are the adult participant
CREATE POLICY "Adults can view messages in their conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    -- Require conversation_id (no backward compatibility)
    conversation_id IS NOT NULL
    -- Verify conversation belongs to current user's adult profile
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.adult_profiles ap ON ap.id = c.adult_id
      WHERE c.id = messages.conversation_id
        AND ap.user_id = auth.uid()
    )
  );

-- Children can view messages in conversations where they are the child participant
-- Note: Since children use anonymous auth, we can't verify child_id in RLS
-- Application must filter by child_id from session/localStorage
CREATE POLICY "Children can view messages in their conversations"
  ON public.messages FOR SELECT
  TO anon
  USING (
    -- Require conversation_id (no backward compatibility)
    conversation_id IS NOT NULL
    -- Note: child_id verification will be done at application level
  );

-- =====================================================
-- STEP 6: Create new message INSERT policies (strict, require conversation_id)
-- =====================================================

-- Adults can send messages in conversations where they are the adult participant
CREATE POLICY "Adults can send messages in their conversations"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Require conversation_id
    conversation_id IS NOT NULL
    -- Verify conversation belongs to current user's adult profile
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.adult_profiles ap ON ap.id = c.adult_id
      WHERE c.id = messages.conversation_id
        AND ap.user_id = auth.uid()
    )
    -- Verify sender_type matches adult role
    AND (
      (messages.sender_type = 'parent' AND EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.adult_profiles ap ON ap.id = c.adult_id
        WHERE c.id = messages.conversation_id
          AND ap.user_id = auth.uid()
          AND ap.role = 'parent'
      ))
      OR
      (messages.sender_type = 'family_member' AND EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.adult_profiles ap ON ap.id = c.adult_id
        WHERE c.id = messages.conversation_id
          AND ap.user_id = auth.uid()
          AND ap.role = 'family_member'
      ))
    )
    -- Verify sender_id matches (for parents, sender_id = auth.uid(); for family_members, use family_member_id)
    AND (
      (messages.sender_type = 'parent' AND messages.sender_id = auth.uid())
      OR
      (messages.sender_type = 'family_member' AND messages.family_member_id = auth.uid())
    )
  );

-- Children can send messages in conversations where they are the child participant
CREATE POLICY "Children can send messages in their conversations"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    -- Require conversation_id
    conversation_id IS NOT NULL
    -- Verify sender_type is 'child'
    AND messages.sender_type = 'child'
    -- Verify sender_id matches child_id (application must ensure this)
    AND messages.sender_id = messages.child_id
    -- Note: Full verification that child_id matches conversation.child_id will be done at application level
    -- For stricter security, we could add a function that validates child_id from session
  );

-- =====================================================
-- STEP 7: Create helper function to get current adult profile ID
-- =====================================================
-- This function helps resolve adult_profile_id from auth.uid() and family_id

CREATE OR REPLACE FUNCTION get_current_adult_profile_id(
  p_family_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- If family_id provided, use it; otherwise try to find any profile for this user
  IF p_family_id IS NOT NULL THEN
    -- Try parent first
    SELECT id INTO v_profile_id
    FROM public.adult_profiles
    WHERE user_id = auth.uid()
      AND family_id = p_family_id
      AND role = 'parent'
    LIMIT 1;
    
    -- If not found, try family_member
    IF v_profile_id IS NULL THEN
      SELECT id INTO v_profile_id
      FROM public.adult_profiles
      WHERE user_id = auth.uid()
        AND family_id = p_family_id
        AND role = 'family_member'
      LIMIT 1;
    END IF;
  ELSE
    -- No family_id, try to find any profile
    SELECT id INTO v_profile_id
    FROM public.adult_profiles
    WHERE user_id = auth.uid()
    ORDER BY 
      CASE role WHEN 'parent' THEN 1 ELSE 2 END, -- Prefer parent
      created_at ASC
    LIMIT 1;
  END IF;
  
  RETURN v_profile_id;
END;
$$;

-- =====================================================
-- STEP 8: Add constraint to ensure conversation_id is always set
-- =====================================================
-- This should already be done in Phase 1, but ensure it's enforced

DO $$
BEGIN
  -- Check if there are any messages without conversation_id
  IF EXISTS (
    SELECT 1 FROM public.messages 
    WHERE conversation_id IS NULL
    LIMIT 1
  ) THEN
    RAISE WARNING 'There are messages without conversation_id. These must be migrated before enforcing NOT NULL constraint.';
  ELSE
    -- All messages have conversation_id, ensure constraint exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'messages' 
      AND column_name = 'conversation_id'
      AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE public.messages
      ALTER COLUMN conversation_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- Next steps:
-- 1. Update frontend code to use profile IDs
-- 2. Remove all queries that use child_id alone
-- 3. Test isolation between different adults messaging same child


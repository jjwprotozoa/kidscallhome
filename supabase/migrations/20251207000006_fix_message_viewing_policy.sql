-- Migration: Fix Message Viewing Policy for Parents
-- Purpose: Ensure parents can see ALL messages in their conversations (both parent and child messages)
-- Date: 2025-12-07
-- Issue: Parents can only see their own messages, not child messages in the conversation

-- =====================================================
-- STEP 1: Verify current policy allows all messages
-- =====================================================
-- The current policy "Adults can view messages in their conversations" should already
-- allow viewing all messages in conversations where they are the adult participant.
-- However, let's ensure it's correct and doesn't have any hidden filters.

-- =====================================================
-- STEP 2: Drop and recreate the policy to ensure it's correct
-- =====================================================

DROP POLICY IF EXISTS "Adults can view messages in their conversations" ON public.messages;

-- Recreate the policy - it should allow viewing ALL messages in conversations
-- where the adult is a participant, regardless of sender_type
CREATE POLICY "Adults can view messages in their conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    -- Require conversation_id (no backward compatibility)
    conversation_id IS NOT NULL
    -- Verify conversation belongs to current user's adult profile
    -- This allows viewing ALL messages in the conversation (parent, child, family_member)
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.adult_profiles ap ON ap.id = c.adult_id
      WHERE c.id = messages.conversation_id
        AND ap.user_id = auth.uid()
    )
    -- NOTE: We do NOT filter by sender_type here
    -- Parents should see ALL messages in their conversations:
    -- - Their own messages (sender_type = 'parent' AND sender_id = auth.uid())
    -- - Child messages (sender_type = 'child')
    -- - Family member messages (sender_type = 'family_member') - but client-side filtering handles isolation
  );

-- =====================================================
-- STEP 3: Verify no messages are missing conversation_id
-- =====================================================

DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  -- Check how many messages still don't have conversation_id
  SELECT COUNT(*) INTO v_null_count
  FROM public.messages
  WHERE conversation_id IS NULL;
  
  IF v_null_count > 0 THEN
    RAISE WARNING 'There are % messages without conversation_id. These messages will not be visible to parents. Consider migrating these messages.', v_null_count;
  ELSE
    RAISE NOTICE 'All messages have conversation_id. Policy should work correctly.';
  END IF;
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- The policy now explicitly allows viewing ALL messages in conversations
-- where the adult is a participant, regardless of sender_type.
-- Client-side filtering in Chat.tsx handles isolation between different adults.


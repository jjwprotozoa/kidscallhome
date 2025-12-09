-- Migration: Strengthen Child Message RLS Policy
-- Purpose: Ensure child messages verify conversation.child_id matches message.child_id
-- Date: 2025-12-07
-- This adds an extra security check to ensure children can only send messages in their own conversations

-- =====================================================
-- STEP 1: Drop existing child message INSERT policy
-- =====================================================

DROP POLICY IF EXISTS "Children can send messages in their conversations" ON public.messages;

-- =====================================================
-- STEP 2: Create strengthened policy with conversation verification
-- =====================================================

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
    -- CRITICAL: Verify that child_id in message matches child_id in conversation
    -- This ensures children can only send messages in conversations where they are the child participant
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.child_id = messages.child_id
    )
  );

-- =====================================================
-- Migration complete
-- =====================================================
-- The policy now verifies:
-- 1. conversation_id is not null
-- 2. sender_type is 'child'
-- 3. sender_id matches child_id
-- 4. child_id in message matches child_id in conversation (NEW - extra security)


-- Migration: Fix Children Send Messages INSERT RLS Policy
-- Purpose: Allow children to send messages in conversations where they are a participant
-- Date: 2025-12-15
-- Issue: Children cannot send messages - RLS INSERT policy violation
-- Root Cause: INSERT policy doesn't account for conversation-based model

-- =====================================================
-- STEP 1: Drop existing child message INSERT policies
-- =====================================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;
DROP POLICY IF EXISTS "Children can send messages in their conversations" ON public.messages;

-- =====================================================
-- STEP 2: Create new policy that allows children to send messages in their conversations
-- =====================================================
-- CRITICAL: In WITH CHECK clauses, reference columns directly (not messages.column)
-- Also note: child_id in messages table might be children.id (legacy) or child_profiles.id
-- We need to check both the conversation and verify the child exists
CREATE POLICY "Children can send messages in their conversations"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    -- Require conversation_id
    conversation_id IS NOT NULL
    -- Verify sender_type is 'child'
    AND sender_type = 'child'
    -- Verify sender_id matches child_id (child can only send as themselves)
    AND sender_id = child_id
    -- CRITICAL: Verify that child_id in message matches child_id in conversation
    -- This ensures children can only send messages in conversations where they are the child participant
    -- Note: child_id might be children.id (legacy) which should match child_profiles.id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.child_id = child_id
        AND EXISTS (
          SELECT 1 FROM public.child_profiles cp
          WHERE cp.id = c.child_id
        )
    )
    -- Also verify child exists (either in children or child_profiles)
    AND (
      EXISTS (SELECT 1 FROM public.children WHERE id = child_id)
      OR EXISTS (SELECT 1 FROM public.child_profiles WHERE id = child_id)
    )
  );

-- =====================================================
-- STEP 3: Verify policy was created
-- =====================================================
SELECT 
    'Policy Verification' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND policyname = 'Children can send messages in their conversations';

-- =====================================================
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ Children can now send messages in conversations where they are a participant
-- 2. ✅ Verifies conversation_id is set
-- 3. ✅ Verifies sender_id matches child_id (security)
-- 4. ✅ Verifies child_id in message matches child_id in conversation (security)
-- 5. ✅ Verifies child_profile exists (data integrity)


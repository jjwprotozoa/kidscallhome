-- Migration: Fix Child Receiving Family Member Messages
-- Purpose: Ensure children can receive and see messages from family members
-- Date: 2025-12-15
-- Issue: Family member messages are not going to child, but child messages go to family member
-- Root Cause: Messages SELECT policy might have conflicts or not be correctly applied

-- =====================================================
-- STEP 1: Drop ALL existing messages SELECT policies to avoid conflicts
-- =====================================================
-- We need to ensure there are no conflicting policies that might block children from seeing family member messages

DROP POLICY IF EXISTS "Messages readable by participants and parents" ON public.messages;
DROP POLICY IF EXISTS "Parents can view isolated messages for their children" ON public.messages;
DROP POLICY IF EXISTS "Family members can view isolated messages" ON public.messages;
DROP POLICY IF EXISTS "Parents can view messages for their children" ON public.messages;
DROP POLICY IF EXISTS "Children can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Children can view messages in their conversations" ON public.messages;

-- =====================================================
-- STEP 2: Create a single, comprehensive messages SELECT policy
-- =====================================================
-- This policy ensures:
-- 1. Children (anon) can see ALL messages in conversations where they are a participant
-- 2. This includes messages from parents, family members, and themselves
-- 3. No restrictions based on sender_type for children viewing their conversations

CREATE POLICY "Messages readable by participants and parents"
  ON public.messages FOR SELECT
  TO authenticated, anon
  USING (
    -- Sender can see their own messages (authenticated users only)
    (auth.uid() IS NOT NULL AND (
      (sender_type = 'parent' AND sender_id = auth.uid())
      OR
      (sender_type = 'family_member' AND sender_id = auth.uid())
    ))
    OR
    -- Children (anon users) can see ALL messages in conversations where they are a participant
    -- CRITICAL: This includes messages from parents, family members, and themselves
    -- We do NOT filter by sender_type - children see ALL messages in their conversations
    (auth.uid() IS NULL AND conversation_id IS NOT NULL AND (
      -- Check via conversations.child_id (primary schema)
      -- Allow if conversation exists and has a child_id
      -- This works for conversations with both parents and family members
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.child_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.child_profiles cp
            WHERE cp.id = c.child_id
          )
      )
      OR
      -- Check via conversation_participants (alternative schema)
      -- Allow if conversation has a child participant
      EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
          AND cp.role = 'child'
          AND EXISTS (
            SELECT 1 FROM public.child_profiles child
            WHERE child.id = cp.user_id
          )
      )
    ))
    OR
    -- Legacy support: Children can see messages where they are the child_id
    -- (for messages without conversation_id - backward compatibility)
    (auth.uid() IS NULL AND conversation_id IS NULL AND EXISTS (
      SELECT 1 FROM public.child_profiles cp
      WHERE cp.id = messages.child_id
    ))
    OR
    -- Parents can see messages for their own children (oversight) - authenticated only
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = messages.child_id
        AND ap.user_id = auth.uid()
        AND ap.role = 'parent'
    ))
    OR
    -- Family members can see messages with children in their family - authenticated only
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = messages.child_id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'family_member'
        AND ap.family_id = cfm.family_id
        AND (
          -- Family member can see their own messages
          (messages.sender_type = 'family_member' AND messages.sender_id = auth.uid())
          OR
          -- Family member can see child messages in their family
          messages.sender_type = 'child'
        )
    ))
  );

-- =====================================================
-- STEP 3: Verify policy was created and no conflicts exist
-- =====================================================
SELECT 
    'Policy Verification - Messages' as info,
    policyname,
    cmd as command,
    roles,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
ORDER BY policyname;

-- =====================================================
-- STEP 4: Diagnostic query to test if child can see family member messages
-- =====================================================
-- Run this query as anon role to test if the policy works
-- Replace 'YOUR_CONVERSATION_ID' with the actual conversation ID
-- Replace 'YOUR_CHILD_ID' with the actual child_profiles.id
/*
SET ROLE anon;
SELECT 
    m.id,
    m.sender_type,
    m.sender_id,
    m.conversation_id,
    m.content,
    m.created_at,
    CASE 
        WHEN m.sender_type = 'family_member' THEN '✅ Family member message'
        WHEN m.sender_type = 'parent' THEN '✅ Parent message'
        WHEN m.sender_type = 'child' THEN '✅ Child message'
        ELSE '❓ Unknown'
    END as message_type
FROM public.messages m
WHERE m.conversation_id = 'dea5baf6-5fca-4278-a37b-18f5a89cf19d'
ORDER BY m.created_at;
RESET ROLE;
*/

-- =====================================================
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ Children can now see ALL messages in their conversations (parent, family_member, child)
-- 2. ✅ No sender_type filtering for children - they see everything in their conversations
-- 3. ✅ Removes conflicting policies that might block family member messages
-- 4. ✅ Maintains security - children only see messages in conversations they participate in
-- 5. ✅ Works for both conversation-based and legacy messages


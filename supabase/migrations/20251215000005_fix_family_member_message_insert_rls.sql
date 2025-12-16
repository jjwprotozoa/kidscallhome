-- Migration: Fix Family Member Message INSERT RLS Policy
-- Purpose: Allow family members to send messages with conversation_id
-- Date: 2025-12-15
-- Issue: Family members cannot send messages - RLS INSERT policy violation when conversation_id is set
-- Root Cause: INSERT policy doesn't handle conversation-based messages for family members

-- =====================================================
-- STEP 1: Drop existing family member message INSERT policy
-- =====================================================
DROP POLICY IF EXISTS "Family members can send messages to children in their family" ON public.messages;

-- =====================================================
-- STEP 2: Create new policy that handles both conversation-based and direct messages
-- =====================================================
-- This policy allows family members to send messages if:
-- 1. Message has conversation_id AND conversation belongs to the family member's adult_profile, OR
-- 2. Message doesn't have conversation_id AND family member and child are in same family
CREATE POLICY "Family members can send messages to children in their family"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'family_member' AND
    sender_id = auth.uid() AND
    (
      -- Case 1: Conversation-based message (conversation_id is set)
      (conversation_id IS NOT NULL AND
       EXISTS (
         SELECT 1 FROM public.conversations c
         JOIN public.adult_profiles ap ON ap.id = c.adult_id
         WHERE c.id = conversation_id
           AND ap.user_id = auth.uid()
           AND ap.role = 'family_member'
           AND c.child_id = messages.child_id
       ))
      OR
      -- Case 2: Direct message (no conversation_id) - verify family membership
      (conversation_id IS NULL AND
       EXISTS (
         SELECT 1 FROM public.adult_profiles ap_sender
         JOIN public.child_family_memberships cfm ON cfm.child_profile_id = messages.child_id
         WHERE ap_sender.user_id = auth.uid()
           AND ap_sender.role = 'family_member'
           AND ap_sender.family_id = cfm.family_id
       ))
    ) AND
    -- CRITICAL: Check communication permission (blocks, etc.)
    -- Note: If can_users_communicate function doesn't exist, this will fail
    -- In that case, remove this check or create the function first
    can_users_communicate(
      p_sender_id := auth.uid(),
      p_sender_type := 'family_member',
      p_receiver_id := messages.child_id,
      p_receiver_type := 'child',
      p_sender_family_id := (
        SELECT family_id FROM public.adult_profiles 
        WHERE user_id = auth.uid() 
        AND role = 'family_member'
        LIMIT 1
      ),
      p_receiver_family_id := (
        SELECT family_id FROM public.child_family_memberships 
        WHERE child_profile_id = messages.child_id 
        LIMIT 1
      )
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
  AND policyname = 'Family members can send messages to children in their family';

-- =====================================================
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ Family members can now send messages with conversation_id
-- 2. ✅ Verifies conversation belongs to the family member's adult_profile
-- 3. ✅ Still supports direct messages (without conversation_id) for backward compatibility
-- 4. ✅ Maintains security by checking family membership
-- 5. ✅ Includes communication permission checks (blocks, etc.)


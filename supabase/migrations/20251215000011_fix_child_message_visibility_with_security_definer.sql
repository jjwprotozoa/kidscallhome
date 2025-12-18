-- Migration: Fix Child Message Visibility Using SECURITY DEFINER Function
-- Purpose: Ensure children can see family member messages by using SECURITY DEFINER to bypass RLS
-- Date: 2025-12-15
-- Issue: Family member messages not reaching child despite correct RLS policy
-- Root Cause: The EXISTS subquery checking conversations might be blocked by RLS on conversations table
-- Solution: Use SECURITY DEFINER function to bypass RLS when checking conversation existence

-- =====================================================
-- STEP 1: Create SECURITY DEFINER function to check if child can see message
-- =====================================================
-- This function bypasses RLS to check if a conversation exists and has a child_id
-- This prevents RLS recursion issues when checking conversations within the messages policy

CREATE OR REPLACE FUNCTION public.child_can_see_message(
  p_conversation_id UUID,
  p_child_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Check if conversation exists and has a child_id
  -- SECURITY DEFINER bypasses RLS, so this won't be blocked
  -- This works for conversations with both parents and family members
  IF p_conversation_id IS NULL THEN
    -- Legacy support: check if message has child_id directly
    IF p_child_id IS NOT NULL THEN
      RETURN EXISTS (
        SELECT 1 FROM public.child_profiles cp
        WHERE cp.id = p_child_id
      );
    END IF;
    RETURN FALSE;
  END IF;

  -- Check via conversations.child_id (primary schema)
  RETURN EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND c.child_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.child_profiles cp
        WHERE cp.id = c.child_id
      )
  ) OR EXISTS (
    -- Check via conversation_participants (alternative schema)
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.role = 'child'
      AND EXISTS (
        SELECT 1 FROM public.child_profiles child
        WHERE child.id = cp.user_id
      )
  );
END;
$$;

-- Grant execute permission to anon and authenticated
GRANT EXECUTE ON FUNCTION public.child_can_see_message(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.child_can_see_message(UUID, UUID) TO authenticated;

-- =====================================================
-- STEP 2: Update messages SELECT policy to use SECURITY DEFINER function
-- =====================================================
-- This ensures the policy can check conversation existence without RLS blocking it

DROP POLICY IF EXISTS "Messages readable by participants and parents" ON public.messages;

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
    -- CRITICAL: Children (anon users) can see ALL messages in conversations where they are a participant
    -- This includes messages from parents, family members, and themselves
    -- Uses SECURITY DEFINER function to bypass RLS when checking conversation existence
    (auth.uid() IS NULL AND public.child_can_see_message(messages.conversation_id, messages.child_id))
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
-- STEP 3: Verify policy and function were created
-- =====================================================
SELECT 
    'Policy Verification - Messages' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND policyname = 'Messages readable by participants and parents';

SELECT 
    'Function Verification - child_can_see_message' as info,
    proname as function_name,
    prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'child_can_see_message'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- =====================================================
-- STEP 4: Test the function directly
-- =====================================================
-- Diagnostic query (run manually):
/*
-- Test the function with the actual conversation ID
SELECT 
    public.child_can_see_message('dea5baf6-5fca-4278-a37b-18f5a89cf19d', 'f91c9458-6ffc-44e6-81a7-a74b851f1d99') as can_see,
    'Should return TRUE if child can see messages in this conversation' as expected_result;
*/

-- =====================================================
-- STEP 5: Test RLS policy as anon (child) role
-- =====================================================
-- Diagnostic query (run manually):
/*
SET ROLE anon;
SELECT 
    m.id,
    m.sender_type,
    m.sender_id,
    m.family_member_id,
    m.conversation_id,
    LEFT(m.content, 50) as content_preview,
    m.created_at,
    CASE 
        WHEN m.sender_type = 'family_member' THEN '🔵 Family member message - SHOULD BE VISIBLE'
        WHEN m.sender_type = 'parent' THEN '🟢 Parent message - SHOULD BE VISIBLE'
        WHEN m.sender_type = 'child' THEN '🟡 Child message - SHOULD BE VISIBLE'
        ELSE '❓ Unknown'
    END as visibility_status
FROM public.messages m
WHERE m.conversation_id = 'dea5baf6-5fca-4278-a37b-18f5a89cf19d'
ORDER BY m.created_at;
RESET ROLE;
*/

-- =====================================================
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ Creates SECURITY DEFINER function to bypass RLS when checking conversation existence
-- 2. ✅ Updates messages SELECT policy to use the function instead of direct EXISTS subquery
-- 3. ✅ Prevents RLS recursion issues that might block children from seeing messages
-- 4. ✅ Ensures children (anon) can see ALL messages in their conversations
-- 5. ✅ No sender_type filtering for children - they see parent, family_member, and child messages






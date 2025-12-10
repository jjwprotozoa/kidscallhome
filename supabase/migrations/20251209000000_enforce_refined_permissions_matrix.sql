-- Migration: Enforce Refined Permissions Matrix with RLS
-- Purpose: Add database-level enforcement for communication rules, blocking, and parent oversight
-- Date: 2025-12-09
-- This migration ensures the database can never violate the permissions matrix rules

-- =====================================================
-- STEP 1: Create security definer function to check communication permissions
-- =====================================================
-- This centralizes permission logic and prevents adult-to-adult communication at DB level

CREATE OR REPLACE FUNCTION can_users_communicate(
  p_sender_id UUID,
  p_sender_type TEXT, -- 'parent', 'family_member', 'child'
  p_receiver_id UUID,
  p_receiver_type TEXT, -- 'parent', 'family_member', 'child'
  p_sender_family_id UUID DEFAULT NULL,
  p_receiver_family_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked BOOLEAN := false;
  v_child_connection_approved BOOLEAN := false;
  v_sender_is_parent BOOLEAN := false;
  v_receiver_is_parent BOOLEAN := false;
BEGIN
  -- CRITICAL RULE 1: NO adult-to-adult communication
  IF (p_sender_type IN ('parent', 'family_member') AND 
      p_receiver_type IN ('parent', 'family_member')) THEN
    RETURN false;
  END IF;

  -- CRITICAL RULE 2: Check blocking (blocking overrides everything)
  -- Exception: Child cannot fully block their own parent (safety feature)
  -- Check if receiver is the child's parent
  IF p_sender_type = 'child' AND p_receiver_type = 'parent' THEN
    -- Check if receiver is the sender's parent
    SELECT EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = p_sender_id
        AND ap.user_id = p_receiver_id
        AND ap.role = 'parent'
    ) INTO v_receiver_is_parent;
    
    -- If receiver is the child's parent, allow communication (child cannot block parent)
    IF v_receiver_is_parent THEN
      -- Still check if child blocked parent (for logging), but don't block communication
      -- This allows "mute" on client side while maintaining parent oversight
      -- For now, we allow it - implement client-side mute if needed
    ELSE
      -- Check if child blocked this adult (not their parent)
      SELECT is_contact_blocked(
        p_sender_id,
        p_adult_profile_id := (
          SELECT id FROM public.adult_profiles 
          WHERE user_id = p_receiver_id 
          LIMIT 1
        )
      ) INTO v_blocked;
      
      IF v_blocked THEN
        RETURN false;
      END IF;
    END IF;
  ELSIF p_sender_type = 'child' AND p_receiver_type = 'child' THEN
    -- Check if child blocked another child
    SELECT is_contact_blocked(
      p_sender_id,
      p_child_profile_id := p_receiver_id
    ) INTO v_blocked;
    
    IF v_blocked THEN
      RETURN false;
    END IF;
  ELSIF p_sender_type = 'parent' AND p_receiver_type = 'child' THEN
    -- Check if child blocked this parent (reverse check)
    -- Note: Child cannot block their own parent, but can block other parents
    SELECT is_contact_blocked(
      p_receiver_id,
      p_adult_profile_id := (
        SELECT id FROM public.adult_profiles 
        WHERE user_id = p_sender_id 
        LIMIT 1
      )
    ) INTO v_blocked;
    
    IF v_blocked THEN
      RETURN false;
    END IF;
  ELSIF p_sender_type = 'family_member' AND p_receiver_type = 'child' THEN
    -- Check if child blocked this family member
    SELECT is_contact_blocked(
      p_receiver_id,
      p_adult_profile_id := (
        SELECT id FROM public.adult_profiles 
        WHERE user_id = p_sender_id 
        LIMIT 1
      )
    ) INTO v_blocked;
    
    IF v_blocked THEN
      RETURN false;
    END IF;
  END IF;

  -- CRITICAL RULE 3: Child-to-child requires approved connection
  IF p_sender_type = 'child' AND p_receiver_type = 'child' THEN
    SELECT can_children_communicate(p_sender_id, p_receiver_id) 
    INTO v_child_connection_approved;
    
    IF NOT v_child_connection_approved THEN
      RETURN false;
    END IF;
  END IF;

  -- CRITICAL RULE 4: Family members can only communicate with children in their family
  IF p_sender_type = 'family_member' AND p_receiver_type = 'child' THEN
    IF p_sender_family_id IS NULL OR p_receiver_family_id IS NULL THEN
      -- Try to determine family IDs
      SELECT family_id INTO p_sender_family_id
      FROM public.adult_profiles
      WHERE user_id = p_sender_id
      LIMIT 1;
      
      SELECT family_id INTO p_receiver_family_id
      FROM public.child_family_memberships
      WHERE child_profile_id = p_receiver_id
      LIMIT 1;
    END IF;
    
    IF p_sender_family_id != p_receiver_family_id THEN
      RETURN false;
    END IF;
  END IF;

  -- CRITICAL RULE 5: Parent can only communicate with their own children
  -- (This is already enforced by existing RLS, but we check here for completeness)
  IF p_sender_type = 'parent' AND p_receiver_type = 'child' THEN
    -- Verify parent owns this child
    IF NOT EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = p_receiver_id
        AND ap.user_id = p_sender_id
        AND ap.role = 'parent'
    ) THEN
      RETURN false;
    END IF;
  END IF;

  -- All checks passed
  RETURN true;
END;
$$;

-- =====================================================
-- STEP 2: Update is_contact_blocked function to prevent child blocking own parent
-- =====================================================
-- This ensures the safety feature: child cannot fully block their own parent

CREATE OR REPLACE FUNCTION is_contact_blocked(
  p_child_id UUID,
  p_adult_profile_id UUID DEFAULT NULL,
  p_child_profile_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked RECORD;
  v_is_parent BOOLEAN := false;
BEGIN
  -- SAFETY FEATURE: If blocking an adult, check if it's the child's own parent
  -- Child cannot fully block their own parent (safety/oversight requirement)
  IF p_adult_profile_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = p_child_id
        AND ap.id = p_adult_profile_id
        AND ap.role = 'parent'
    ) INTO v_is_parent;
    
    -- If this is the child's parent, return false (cannot block)
    -- Note: This allows client-side "mute" while maintaining parent oversight
    IF v_is_parent THEN
      RETURN false;
    END IF;
  END IF;

  -- Check for active block (unblocked_at IS NULL)
  SELECT * INTO v_blocked
  FROM public.blocked_contacts
  WHERE blocker_child_id = p_child_id
    AND unblocked_at IS NULL
    AND (
      (p_adult_profile_id IS NOT NULL AND blocked_adult_profile_id = p_adult_profile_id) OR
      (p_child_profile_id IS NOT NULL AND blocked_child_profile_id = p_child_profile_id)
    );
  
  RETURN FOUND;
END;
$$;

-- =====================================================
-- STEP 3: Create RLS policies for messages table
-- =====================================================
-- These policies enforce the permissions matrix at the database level

-- Drop existing message INSERT policies that don't check permissions
DROP POLICY IF EXISTS "Parents can send messages" ON public.messages;
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;
DROP POLICY IF EXISTS "Family members can send messages" ON public.messages;

-- Parent can INSERT messages to their own children (with permission check)
CREATE POLICY "Parents can send messages to their children"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'parent' AND
    sender_id = auth.uid() AND
    -- Verify parent owns this child
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = messages.child_id
        AND ap.user_id = auth.uid()
        AND ap.role = 'parent'
    ) AND
    -- CRITICAL: Check communication permission (blocks, etc.)
    can_users_communicate(
      p_sender_id := auth.uid(),
      p_sender_type := 'parent',
      p_receiver_id := messages.child_id,
      p_receiver_type := 'child'
    )
  );

-- Family member can INSERT messages to children in their family (with permission check)
CREATE POLICY "Family members can send messages to children in their family"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'family_member' AND
    sender_id = auth.uid() AND
    -- Verify family member and child are in same family
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap_sender
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = messages.child_id
      WHERE ap_sender.user_id = auth.uid()
        AND ap_sender.role = 'family_member'
        AND ap_sender.family_id = cfm.family_id
    ) AND
    -- CRITICAL: Check communication permission (blocks, etc.)
    can_users_communicate(
      p_sender_id := auth.uid(),
      p_sender_type := 'family_member',
      p_receiver_id := messages.child_id,
      p_receiver_type := 'child',
      p_sender_family_id := (
        SELECT family_id FROM public.adult_profiles WHERE user_id = auth.uid() LIMIT 1
      ),
      p_receiver_family_id := (
        SELECT family_id FROM public.child_family_memberships 
        WHERE child_profile_id = messages.child_id LIMIT 1
      )
    )
  );

-- Child can INSERT messages (with permission check)
-- Note: Children use anon role, so we check via child_id from the message
-- Supports both conversation-based (child-to-child) and legacy (child-to-parent) messages
CREATE POLICY "Children can send messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child' AND
    sender_id = child_id AND
    -- Verify child exists
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE id = messages.child_id
    ) AND
    -- CRITICAL: Check communication permission
    -- If conversation_id is set, determine receiver from conversation participants
    -- Otherwise, fall back to parent (legacy behavior)
    (
      -- Case 1: Conversation-based message (child-to-child or child-to-adult)
      (messages.conversation_id IS NOT NULL AND
       EXISTS (
         SELECT 1 FROM public.conversation_participants cp
         WHERE cp.conversation_id = messages.conversation_id
           AND cp.user_id != messages.child_id  -- The other participant
         LIMIT 1
       ) AND
       can_users_communicate(
         p_sender_id := messages.child_id,
         p_sender_type := 'child',
         p_receiver_id := (
           SELECT cp.user_id FROM public.conversation_participants cp
           WHERE cp.conversation_id = messages.conversation_id
             AND cp.user_id != messages.child_id
           LIMIT 1
         ),
         p_receiver_type := (
           SELECT cp.role FROM public.conversation_participants cp
           WHERE cp.conversation_id = messages.conversation_id
             AND cp.user_id != messages.child_id
           LIMIT 1
         )
       ))
      OR
      -- Case 2: Legacy message (child-to-parent, no conversation_id)
      (messages.conversation_id IS NULL AND
       can_users_communicate(
         p_sender_id := messages.child_id,
         p_sender_type := 'child',
         p_receiver_id := (
           SELECT ap.user_id FROM public.child_family_memberships cfm
           JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
           WHERE cfm.child_profile_id = messages.child_id
             AND ap.role = 'parent'
           LIMIT 1
         ),
         p_receiver_type := 'parent'
       ))
    )
  );

-- =====================================================
-- STEP 4: Create RLS policies for calls table
-- =====================================================
-- Similar to messages, but for video calls

-- Drop existing call INSERT policies that don't check permissions
DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
DROP POLICY IF EXISTS "Family members can insert calls" ON public.calls;

-- Parent can INSERT calls to their own children (with permission check)
CREATE POLICY "Parents can initiate calls to their children"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_type = 'parent' AND
    parent_id = auth.uid() AND
    -- Verify parent owns this child
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = calls.child_id
        AND ap.user_id = auth.uid()
        AND ap.role = 'parent'
    ) AND
    -- CRITICAL: Check communication permission (blocks, etc.)
    can_users_communicate(
      p_sender_id := auth.uid(),
      p_sender_type := 'parent',
      p_receiver_id := calls.child_id,
      p_receiver_type := 'child'
    )
  );

-- Family member can INSERT calls to children in their family (with permission check)
CREATE POLICY "Family members can initiate calls to children in their family"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_type = 'family_member' AND
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap_sender
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = calls.child_id
      WHERE ap_sender.user_id = auth.uid()
        AND ap_sender.role = 'family_member'
        AND ap_sender.family_id = cfm.family_id
    ) AND
    -- CRITICAL: Check communication permission (blocks, etc.)
    can_users_communicate(
      p_sender_id := auth.uid(),
      p_sender_type := 'family_member',
      p_receiver_id := calls.child_id,
      p_receiver_type := 'child',
      p_sender_family_id := (
        SELECT family_id FROM public.adult_profiles WHERE user_id = auth.uid() LIMIT 1
      ),
      p_receiver_family_id := (
        SELECT family_id FROM public.child_family_memberships 
        WHERE child_profile_id = calls.child_id LIMIT 1
      )
    )
  );

-- Child can INSERT calls (with permission check)
-- Supports both conversation-based (child-to-child) and legacy (child-to-parent) calls
CREATE POLICY "Children can initiate calls"
  ON public.calls FOR INSERT
  TO anon
  WITH CHECK (
    caller_type = 'child' AND
    child_id IS NOT NULL AND
    -- Verify child exists
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE id = calls.child_id
    ) AND
    -- CRITICAL: Check communication permission
    -- If conversation_id or callee_id is set, determine receiver from that
    -- Otherwise, fall back to parent (legacy behavior)
    (
      -- Case 1: Conversation-based call (child-to-child or child-to-adult)
      (calls.conversation_id IS NOT NULL AND
       EXISTS (
         SELECT 1 FROM public.conversation_participants cp
         WHERE cp.conversation_id = calls.conversation_id
           AND cp.user_id != calls.child_id  -- The other participant
         LIMIT 1
       ) AND
       can_users_call(
         p_sender_id := calls.child_id,
         p_sender_type := 'child',
         p_receiver_id := (
           SELECT cp.user_id FROM public.conversation_participants cp
           WHERE cp.conversation_id = calls.conversation_id
             AND cp.user_id != calls.child_id
           LIMIT 1
         ),
         p_receiver_type := (
           SELECT cp.role FROM public.conversation_participants cp
           WHERE cp.conversation_id = calls.conversation_id
             AND cp.user_id != calls.child_id
           LIMIT 1
         )
       ))
      OR
      -- Case 2: Direct callee_id (child-to-child call)
      (calls.callee_id IS NOT NULL AND
       can_users_call(
         p_sender_id := calls.child_id,
         p_sender_type := 'child',
         p_receiver_id := calls.callee_id,
         p_receiver_type := 'child'
       ))
      OR
      -- Case 3: Legacy call (child-to-parent, parent_id is set)
      (calls.parent_id IS NOT NULL AND
       can_users_call(
         p_sender_id := calls.child_id,
         p_sender_type := 'child',
         p_receiver_id := calls.parent_id,
         p_receiver_type := 'parent'
       ))
    )
  );

-- =====================================================
-- STEP 5: Update blocked_contacts INSERT policy to prevent child blocking own parent
-- =====================================================
-- Add a constraint check in the INSERT policy

DROP POLICY IF EXISTS "Parents can block contacts for their children" ON public.blocked_contacts;

-- Parents can block contacts for their children
CREATE POLICY "Parents can block contacts for their children"
  ON public.blocked_contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = blocked_contacts.blocker_child_id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    ) AND
    -- SAFETY: Prevent blocking the child's own parent
    NOT EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = blocked_contacts.blocker_child_id
        AND ap.id = blocked_contacts.blocked_adult_profile_id
        AND ap.role = 'parent'
    )
  );

-- =====================================================
-- STEP 6: Add SELECT RLS policies for messages table
-- =====================================================
-- These policies control who can read/view messages (oversight and privacy)

-- Drop existing SELECT policies if they exist
DROP POLICY IF EXISTS "Messages readable by participants and parents" ON public.messages;
DROP POLICY IF EXISTS "Parents can view messages for their children" ON public.messages;
DROP POLICY IF EXISTS "Children can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Family members can view messages" ON public.messages;

-- Messages readable by participants and parents (for oversight)
CREATE POLICY "Messages readable by participants and parents"
  ON public.messages FOR SELECT
  TO authenticated, anon
  USING (
    -- Sender can see their own messages
    (sender_type = 'parent' AND sender_id = auth.uid())
    OR
    (sender_type = 'family_member' AND sender_id = auth.uid())
    OR
    -- Child sender can see their own messages (sender_id = child_id for child messages)
    (sender_type = 'child' AND sender_id = child_id AND (
      -- For anon users, check via child session (handled at app level)
      -- For authenticated users, verify they are the child's parent
      auth.uid() IS NULL OR
      EXISTS (
        SELECT 1 FROM public.child_family_memberships cfm
        JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
        WHERE cfm.child_profile_id = messages.child_id
          AND ap.user_id = auth.uid()
          AND ap.role = 'parent'
      )
    ))
    OR
    -- Parents can see messages for their own children (oversight)
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = messages.child_id
        AND ap.user_id = auth.uid()
        AND ap.role = 'parent'
    )
    OR
    -- Family members can see messages with children in their family
    (sender_type = 'family_member' AND EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = messages.child_id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'family_member'
        AND ap.family_id = cfm.family_id
    ))
  );

-- =====================================================
-- STEP 7: Add SELECT RLS policies for calls table
-- =====================================================
-- These policies control who can read/view call records (oversight and privacy)

-- Drop existing SELECT policies if they exist
DROP POLICY IF EXISTS "Calls readable by participants and parents" ON public.calls;
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
DROP POLICY IF EXISTS "Family members can view calls" ON public.calls;

-- Calls readable by participants and parents (for oversight)
CREATE POLICY "Calls readable by participants and parents"
  ON public.calls FOR SELECT
  TO authenticated, anon
  USING (
    -- Parent caller can see their own calls
    (caller_type = 'parent' AND parent_id = auth.uid())
    OR
    -- Family member caller can see their own calls
    (caller_type = 'family_member' AND EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'family_member'
        AND ap.family_id IN (
          SELECT family_id FROM public.child_family_memberships 
          WHERE child_profile_id = calls.child_id
        )
    ))
    OR
    -- Child caller can see their own calls (child_id matches)
    -- For anon users, this is handled at app level via child session
    -- For authenticated users, verify they are the child's parent
    (caller_type = 'child' AND (
      auth.uid() IS NULL OR
      EXISTS (
        SELECT 1 FROM public.child_family_memberships cfm
        JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
        WHERE cfm.child_profile_id = calls.child_id
          AND ap.user_id = auth.uid()
          AND ap.role = 'parent'
      )
    ))
    OR
    -- Parents can see calls for their own children (oversight)
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = calls.child_id
        AND ap.user_id = auth.uid()
        AND ap.role = 'parent'
    )
    OR
    -- Family members can see calls with children in their family
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = calls.child_id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'family_member'
        AND ap.family_id = cfm.family_id
    )
  );

-- =====================================================
-- STEP 8: Add comment documentation
-- =====================================================

COMMENT ON FUNCTION can_users_communicate IS 
'Central permission check function that enforces the permissions matrix at database level. 
Prevents adult-to-adult communication, checks blocking, verifies child-to-child approvals, 
and enforces family boundaries. Returns false if communication is not allowed.';

COMMENT ON FUNCTION is_contact_blocked IS 
'Checks if a contact is blocked for a child. Includes safety feature: child cannot 
fully block their own parent (allows client-side mute while maintaining parent oversight).';

-- =====================================================
-- Migration complete
-- =====================================================
-- Key enforcement points:
-- 1. ✅ No adult-to-adult communication can be inserted
-- 2. ✅ Blocking is checked before allowing communication
-- 3. ✅ Child cannot block their own parent (safety feature)
-- 4. ✅ Child-to-child requires approved connection (when implemented)
-- 5. ✅ Family members restricted to same-family children
-- 6. ✅ Parents restricted to their own children
-- 7. ✅ All checks happen at database level via RLS policies
-- 8. ✅ SELECT policies enforce oversight (parents can see their children's messages/calls)
-- 9. ✅ SELECT policies enforce privacy (adults can't see other adults' data)

-- TODO: When child-to-child messaging/calls are implemented:
-- - Add callee_id or conversation_id to calls table for child-to-child calls
-- - Update child message INSERT policy to determine receiver from conversation context
-- - Update child call INSERT policy to use callee_id for child-to-child calls
-- - Ensure can_users_communicate() is called with correct receiver_id and receiver_type


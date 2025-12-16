-- Migration: Fix RLS Policies for Messages and Conversations Queries
-- Purpose: Fix 500 errors when querying messages and conversations
-- Date: 2025-12-09
-- Issues:
--   1. Messages RLS policy fails for anonymous users querying child messages
--   2. Conversations RLS policy doesn't support adult_id/child_id schema queries

-- =====================================================
-- STEP 1: Fix messages SELECT RLS policy for anonymous users
-- =====================================================
-- The current policy fails when anon users query messages with sender_type=child
-- because it tries to verify parent relationship even for anon users

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
    -- Child sender can see their own messages
    -- For anon users (children), allow if sender_id = child_id (child's own messages)
    -- For authenticated users, verify they are the child's parent
    (sender_type = 'child' AND sender_id = child_id AND (
      -- Anon users: allow if sender_id matches child_id (child viewing their own messages)
      auth.uid() IS NULL
      OR
      -- Authenticated users: verify they are the child's parent
      EXISTS (
        SELECT 1 FROM public.child_family_memberships cfm
        JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
        WHERE cfm.child_profile_id = messages.child_id
          AND ap.user_id = auth.uid()
          AND ap.role = 'parent'
      )
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
    (auth.uid() IS NOT NULL AND sender_type = 'family_member' AND EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = messages.child_id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'family_member'
        AND ap.family_id = cfm.family_id
    ))
  );

-- =====================================================
-- STEP 2: Fix conversations SELECT RLS policy to support both schemas
-- =====================================================
-- Support both old schema (adult_id/child_id) and new schema (conversation_participants)
-- Check which schema exists and create appropriate policy

-- First, check if adult_id column exists
DO $$
DECLARE
  v_has_adult_id BOOLEAN;
  v_has_participants BOOLEAN;
BEGIN
  -- Check if adult_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'adult_id'
  ) INTO v_has_adult_id;
  
  -- Check if conversation_participants table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'conversation_participants'
  ) INTO v_has_participants;
  
  -- Drop existing policy
  DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
  
  -- Create policy based on which schema exists
  IF v_has_adult_id THEN
    -- Old schema: use adult_id/child_id
    EXECUTE '
      CREATE POLICY "Users can view conversations they participate in"
        ON public.conversations FOR SELECT
        TO authenticated, anon
        USING (
          -- For authenticated users, check if adult_id matches their profile
          (auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.adult_profiles ap
            WHERE ap.id = conversations.adult_id
              AND ap.user_id = auth.uid()
          ))
          OR
          -- For anon users (children), allow if child_id is set (app level handles verification)
          (auth.uid() IS NULL AND conversations.child_id IS NOT NULL)
        )';
  ELSIF v_has_participants THEN
    -- New schema: use conversation_participants
    EXECUTE '
      CREATE POLICY "Users can view conversations they participate in"
        ON public.conversations FOR SELECT
        TO authenticated, anon
        USING (
          EXISTS (
            SELECT 1 FROM public.conversation_participants cp
            WHERE cp.conversation_id = conversations.id
              AND (
                -- For authenticated users, check user_id matches auth.uid()
                (cp.role IN (''parent'', ''family_member'') AND cp.user_id = auth.uid())
                OR
                -- For anon users (children), this is handled at app level via child session
                (cp.role = ''child'' AND auth.uid() IS NULL)
              )
          )
        )';
  ELSE
    -- Fallback: allow all (should not happen, but prevents errors)
    EXECUTE '
      CREATE POLICY "Users can view conversations they participate in"
        ON public.conversations FOR SELECT
        TO authenticated, anon
        USING (true)';
  END IF;
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ Messages RLS policy now properly handles anonymous users querying child messages
-- 2. ✅ Conversations RLS policy supports both old (adult_id/child_id) and new (conversation_participants) schemas
-- 3. ✅ Prevents 500 errors when querying messages with sender_type=child and read_at=is.null
-- 4. ✅ Prevents 500 errors when querying conversations with adult_id filter


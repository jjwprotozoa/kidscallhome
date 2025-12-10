-- Migration: Add Conversations and Feature Flags for Child-to-Child Support
-- Purpose: Future-proof schema for child-to-child messaging/calls, gated by feature flags
-- Date: 2025-12-09
-- This migration adds conversation support and feature flags so child-to-child can be enabled/disabled per family

-- =====================================================
-- STEP 1: Create conversations table
-- =====================================================
-- Supports 1:1 and group conversations (future-proof for group chats)

-- Check if table exists and create/alter accordingly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations'
  ) THEN
    CREATE TABLE public.conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL CHECK (type IN ('one_to_one', 'group')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  ELSE
    -- Table exists, add missing columns if needed
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'conversations' 
      AND column_name = 'type'
    ) THEN
      ALTER TABLE public.conversations 
      ADD COLUMN type TEXT NOT NULL DEFAULT 'one_to_one' CHECK (type IN ('one_to_one', 'group'));
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'conversations' 
      AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.conversations 
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- Create indexes for efficient lookups (only if table exists and has the columns)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'type'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(type);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at);
  END IF;
END $$;

-- =====================================================
-- STEP 2: Create conversation_participants table
-- =====================================================
-- Links users/children to conversations
-- Supports adults (user_id = auth.users.id) and children (user_id = child_profiles.id)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'conversation_participants'
  ) THEN
    CREATE TABLE public.conversation_participants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,  -- auth.users.id for adults OR child_profiles.id for children
      role TEXT NOT NULL CHECK (role IN ('parent', 'family_member', 'child')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      -- Ensure unique participant per conversation
      UNIQUE (conversation_id, user_id)
    );
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_role ON public.conversation_participants(role);

-- =====================================================
-- STEP 3: Create family_feature_flags table
-- =====================================================
-- Allows enabling/disabling features per family without migrations

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'family_feature_flags'
  ) THEN
    CREATE TABLE public.family_feature_flags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
      key TEXT NOT NULL,  -- e.g. 'child_to_child_messaging', 'child_to_child_calls'
      enabled BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      -- One flag per family per key
      UNIQUE (family_id, key)
    );
  ELSE
    -- Table exists, add missing columns if needed
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'family_feature_flags' 
      AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.family_feature_flags 
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_family_feature_flags_family ON public.family_feature_flags(family_id);
CREATE INDEX IF NOT EXISTS idx_family_feature_flags_key ON public.family_feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_family_feature_flags_enabled ON public.family_feature_flags(enabled) WHERE enabled = true;

-- =====================================================
-- STEP 4: Add conversation support to messages table
-- =====================================================
-- Make conversation_id nullable for backward compatibility
-- Gradually migrate existing messages to use conversations

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE public.messages 
    ADD COLUMN conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add receiver_type for explicit typing (optional but helpful)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'receiver_type'
  ) THEN
    ALTER TABLE public.messages 
    ADD COLUMN receiver_type TEXT CHECK (receiver_type IN ('parent', 'family_member', 'child'));
  END IF;
END $$;

-- Create index for conversation lookups
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id) WHERE conversation_id IS NOT NULL;

-- =====================================================
-- STEP 5: Add conversation support to calls table
-- =====================================================
-- Make conversation_id nullable for backward compatibility
-- Add callee_id for child-to-child calls

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE public.calls 
    ADD COLUMN conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'callee_id'
  ) THEN
    ALTER TABLE public.calls 
    ADD COLUMN callee_id UUID REFERENCES public.child_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calls_conversation_id ON public.calls(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_callee_id ON public.calls(callee_id) WHERE callee_id IS NOT NULL;

-- =====================================================
-- STEP 6: Enable RLS on new tables
-- =====================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_feature_flags ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: Create RLS policies for conversations
-- =====================================================

-- Users can see conversations they participate in
CREATE POLICY "Users can view conversations they participate in"
  ON public.conversations FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND (
          -- For authenticated users, check user_id matches auth.uid()
          (cp.role IN ('parent', 'family_member') AND cp.user_id = auth.uid())
          OR
          -- For anon users (children), this is handled at app level via child session
          (cp.role = 'child' AND auth.uid() IS NULL)
        )
    )
  );

-- Parents can create conversations for their children
CREATE POLICY "Parents can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
    )
  );

-- =====================================================
-- STEP 8: Create RLS policies for conversation_participants
-- =====================================================

-- Users can see participants in conversations they're part of
CREATE POLICY "Users can view participants in their conversations"
  ON public.conversation_participants FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
        AND (
          (cp2.role IN ('parent', 'family_member') AND cp2.user_id = auth.uid())
          OR
          (cp2.role = 'child' AND auth.uid() IS NULL)
        )
    )
  );

-- Parents can add participants to conversations
CREATE POLICY "Parents can manage conversation participants"
  ON public.conversation_participants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
    )
  );

-- =====================================================
-- STEP 9: Create RLS policies for family_feature_flags
-- =====================================================

-- Parents can view feature flags for their family
CREATE POLICY "Parents can view feature flags for their family"
  ON public.family_feature_flags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = family_feature_flags.family_id
    )
  );

-- Parents can update feature flags for their family
CREATE POLICY "Parents can update feature flags for their family"
  ON public.family_feature_flags FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = family_feature_flags.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = family_feature_flags.family_id
    )
  );

-- Parents can insert feature flags for their family
CREATE POLICY "Parents can insert feature flags for their family"
  ON public.family_feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = family_feature_flags.family_id
    )
  );

-- =====================================================
-- STEP 10: Create helper function to check feature flags
-- =====================================================

CREATE OR REPLACE FUNCTION is_feature_enabled_for_children(
  p_child_a_id UUID,
  p_child_b_id UUID,
  p_feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if feature is enabled for at least one of the children's families
  -- This allows child-to-child if either family has it enabled
  RETURN EXISTS (
    SELECT 1
    FROM public.child_family_memberships cfa
    JOIN public.family_feature_flags ffa
      ON ffa.family_id = cfa.family_id
     AND ffa.key = p_feature_key
     AND ffa.enabled = true
    WHERE cfa.child_profile_id = p_child_a_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.child_family_memberships cfb
    JOIN public.family_feature_flags ffb
      ON ffb.family_id = cfb.family_id
     AND ffb.key = p_feature_key
     AND ffb.enabled = true
    WHERE cfb.child_profile_id = p_child_b_id
  );
END;
$$;

-- =====================================================
-- STEP 11: Update can_users_communicate to check feature flags
-- =====================================================

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

  -- CRITICAL RULE 3: Child-to-child requires approved connection AND feature flag
  IF p_sender_type = 'child' AND p_receiver_type = 'child' THEN
    SELECT can_children_communicate(p_sender_id, p_receiver_id) 
    INTO v_child_connection_approved;
    
    IF NOT v_child_connection_approved THEN
      RETURN false;
    END IF;
    
    -- Check feature flag for child-to-child messaging
    -- Note: For calls, use 'child_to_child_calls' instead
    IF NOT is_feature_enabled_for_children(p_sender_id, p_receiver_id, 'child_to_child_messaging') THEN
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
-- STEP 12: Create helper function for calls (separate feature flag)
-- =====================================================

CREATE OR REPLACE FUNCTION can_users_call(
  p_sender_id UUID,
  p_sender_type TEXT,
  p_receiver_id UUID,
  p_receiver_type TEXT,
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
BEGIN
  -- Use same logic as can_users_communicate, but check 'child_to_child_calls' flag
  -- For non-child-to-child, use can_users_communicate
  IF p_sender_type = 'child' AND p_receiver_type = 'child' THEN
    SELECT can_children_communicate(p_sender_id, p_receiver_id) 
    INTO v_child_connection_approved;
    
    IF NOT v_child_connection_approved THEN
      RETURN false;
    END IF;
    
    -- Check feature flag for child-to-child calls
    IF NOT is_feature_enabled_for_children(p_sender_id, p_receiver_id, 'child_to_child_calls') THEN
      RETURN false;
    END IF;
  END IF;
  
  -- For all other cases, use the messaging permission check
  RETURN can_users_communicate(
    p_sender_id,
    p_sender_type,
    p_receiver_id,
    p_receiver_type,
    p_sender_family_id,
    p_receiver_family_id
  );
END;
$$;

-- =====================================================
-- STEP 13: Add triggers for updated_at timestamps
-- =====================================================

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();

DROP TRIGGER IF EXISTS update_family_feature_flags_updated_at ON public.family_feature_flags;
CREATE TRIGGER update_family_feature_flags_updated_at
  BEFORE UPDATE ON public.family_feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();

-- =====================================================
-- STEP 14: Enable realtime for new tables
-- =====================================================

-- Add tables to realtime publication if not already added
DO $$
BEGIN
  -- Check and add conversations
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
  
  -- Check and add conversation_participants
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'conversation_participants'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  END IF;
  
  -- Check and add family_feature_flags
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'family_feature_flags'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'family_feature_flags'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.family_feature_flags;
  END IF;
END $$;

-- =====================================================
-- STEP 15: Add comments
-- =====================================================

COMMENT ON TABLE public.conversations IS 
'Conversations table supporting 1:1 and group chats. Used for child-to-child messaging/calls when enabled.';

COMMENT ON TABLE public.conversation_participants IS 
'Links users/children to conversations. Supports adults (user_id = auth.users.id) and children (user_id = child_profiles.id).';

COMMENT ON TABLE public.family_feature_flags IS 
'Feature flags per family. Allows enabling/disabling features like child-to-child messaging/calls without migrations.';

COMMENT ON FUNCTION is_feature_enabled_for_children IS 
'Checks if a feature is enabled for at least one of the children''s families. Returns true if either child''s family has the feature enabled.';

COMMENT ON FUNCTION can_users_call IS 
'Same as can_users_communicate but checks ''child_to_child_calls'' feature flag instead of ''child_to_child_messaging''.';

-- =====================================================
-- STEP 16: Update existing RLS policies to use conversation context
-- =====================================================
-- Update child message and call policies to support conversations

-- Drop and recreate child message policy with conversation support
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

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

-- Drop and recreate child call policy with conversation/callee support
DROP POLICY IF EXISTS "Children can initiate calls" ON public.calls;

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
-- Migration complete
-- =====================================================
-- What this migration provides:
-- 1. ✅ Conversations table for 1:1 and group chats
-- 2. ✅ Conversation participants linking users to conversations
-- 3. ✅ Feature flags per family (child_to_child_messaging, child_to_child_calls)
-- 4. ✅ Helper function to check feature flags
-- 5. ✅ Updated can_users_communicate to check feature flags
-- 6. ✅ New can_users_call function for calls (separate feature flag)
-- 7. ✅ Updated RLS policies to use conversation context when available
-- 8. ✅ Backward compatible (legacy messages/calls still work)

-- Next steps:
-- 1. Create admin UI to toggle feature flags (family_feature_flags table)
-- 2. Gradually migrate existing messages/calls to use conversations
-- 3. Update application code to create conversations for child-to-child
-- 4. Test feature flag toggling (should work immediately, no restart needed)


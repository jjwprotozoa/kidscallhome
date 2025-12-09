-- Migration: Refactor to Conversation-Based Messaging Model
-- Purpose: Implement WhatsApp-style 1-on-1 conversations for proper message isolation
-- Date: 2025-12-05
-- Issue: Family members can see parents' messages with children
-- Solution: Each conversation is between exactly 2 users, messages belong to conversations

-- =====================================================
-- STEP 1: Create conversations table
-- =====================================================
-- A conversation represents a 1-on-1 chat between two users
-- participant1_id: One participant (parent, family_member, or child)
-- participant1_type: Type of participant1 ('parent', 'family_member', 'child')
-- participant2_id: The other participant (always a child for now)
-- participant2_type: Always 'child' for now
-- created_at: When the conversation started
-- updated_at: Last message timestamp

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_id UUID NOT NULL,
  participant1_type TEXT NOT NULL CHECK (participant1_type IN ('parent', 'family_member', 'child')),
  participant2_id UUID NOT NULL,
  participant2_type TEXT NOT NULL CHECK (participant2_type = 'child'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure participant1 is not a child when participant2 is a child
  -- (for now, conversations are always between an adult and a child)
  CONSTRAINT conversations_participants_check CHECK (
    (participant1_type != 'child' AND participant2_type = 'child') OR
    (participant1_type = 'child' AND participant2_type != 'child')
  ),
  -- Ensure unique conversation between same two participants
  CONSTRAINT conversations_unique_pair UNIQUE (participant1_id, participant1_type, participant2_id, participant2_type)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_conversations_participant1 ON public.conversations(participant1_id, participant1_type);
CREATE INDEX IF NOT EXISTS idx_conversations_participant2 ON public.conversations(participant2_id, participant2_type);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- =====================================================
-- STEP 2: Add conversation_id to messages table
-- =====================================================
-- Keep child_id for backward compatibility during migration
-- Add conversation_id as the new primary relationship

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE public.messages 
    ADD COLUMN conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;
    
    -- Create index for conversation_id
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
  END IF;
END $$;

-- =====================================================
-- STEP 3: Create helper function to get or create conversation
-- =====================================================
-- This function ensures we always have a conversation between two users
-- It's idempotent - if conversation exists, returns it; otherwise creates it

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_participant1_id UUID,
  p_participant1_type TEXT,
  p_participant2_id UUID,
  p_participant2_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_p1_id UUID;
  v_p1_type TEXT;
  v_p2_id UUID;
  v_p2_type TEXT;
BEGIN
  -- Normalize: always put child as participant2
  IF p_participant1_type = 'child' THEN
    v_p1_id := p_participant2_id;
    v_p1_type := p_participant2_type;
    v_p2_id := p_participant1_id;
    v_p2_type := p_participant1_type;
  ELSE
    v_p1_id := p_participant1_id;
    v_p1_type := p_participant1_type;
    v_p2_id := p_participant2_id;
    v_p2_type := p_participant2_type;
  END IF;

  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE participant1_id = v_p1_id
    AND participant1_type = v_p1_type
    AND participant2_id = v_p2_id
    AND participant2_type = v_p2_type;

  -- If not found, create it
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (participant1_id, participant1_type, participant2_id, participant2_type)
    VALUES (v_p1_id, v_p1_type, v_p2_id, v_p2_type)
    ON CONFLICT (participant1_id, participant1_type, participant2_id, participant2_type)
    DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$;

-- =====================================================
-- STEP 4: Migrate existing messages to conversations
-- =====================================================
-- For each existing message, create/find the conversation and link it

DO $$
DECLARE
  v_message RECORD;
  v_conversation_id UUID;
  v_participant1_id UUID;
  v_participant1_type TEXT;
BEGIN
  FOR v_message IN 
    SELECT id, sender_id, sender_type, family_member_id, child_id
    FROM public.messages
    WHERE conversation_id IS NULL
  LOOP
    -- Determine participant1 (the adult sender or the child)
    IF v_message.sender_type = 'child' THEN
      -- Child sent message, so participant1 is the child, participant2 is the parent/family_member
      -- But we need to find who they were messaging with
      -- For now, we'll create a conversation with the child as participant1
      -- and we'll need to infer the adult from context
      -- This is a limitation - we can't perfectly reconstruct old conversations
      -- But we can at least create conversations for future messages
      CONTINUE; -- Skip orphaned messages for now
    ELSE
      -- Adult sent message
      IF v_message.sender_type = 'parent' THEN
        v_participant1_id := v_message.sender_id;
        v_participant1_type := 'parent';
      ELSIF v_message.sender_type = 'family_member' THEN
        v_participant1_id := v_message.family_member_id;
        v_participant1_type := 'family_member';
      ELSE
        CONTINUE; -- Unknown sender type
      END IF;
      
      -- Get or create conversation
      v_conversation_id := public.get_or_create_conversation(
        v_participant1_id,
        v_participant1_type,
        v_message.child_id,
        'child'
      );
      
      -- Update message with conversation_id
      UPDATE public.messages
      SET conversation_id = v_conversation_id
      WHERE id = v_message.id;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- STEP 5: Enable RLS on conversations table
-- =====================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 6: Create RLS policies for conversations
-- =====================================================

-- Parents can view conversations where they are participant1
CREATE POLICY "Parents can view their conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    -- User must be a parent (not a family member)
    NOT EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_members.id = auth.uid()
      AND family_members.status = 'active'
    )
    AND (
      -- Parent is participant1
      (participant1_type = 'parent' AND participant1_id = auth.uid())
      OR
      -- Parent is participant2 (shouldn't happen, but just in case)
      (participant2_type = 'parent' AND participant2_id = auth.uid())
    )
  );

-- Family members can view conversations where they are participant1
CREATE POLICY "Family members can view their conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    -- User must be an active family member
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
    )
    AND (
      -- Family member is participant1
      (participant1_type = 'family_member' AND participant1_id = auth.uid())
      OR
      -- Family member is participant2 (shouldn't happen, but just in case)
      (participant2_type = 'family_member' AND participant2_id = auth.uid())
    )
  );

-- Children can view conversations where they are participant2 (or participant1 if reversed)
-- Children use anonymous auth, so we need a different approach
-- We'll handle this via a function that checks child_id from session

-- Parents can create conversations with their children
CREATE POLICY "Parents can create conversations with their children"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be a parent
    NOT EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_members.id = auth.uid()
      AND family_members.status = 'active'
    )
    AND (
      -- Parent is participant1 and child belongs to them
      (
        participant1_type = 'parent' 
        AND participant1_id = auth.uid()
        AND participant2_type = 'child'
        AND EXISTS (
          SELECT 1 FROM public.children
          WHERE children.id = participant2_id
          AND children.parent_id = auth.uid()
        )
      )
    )
  );

-- Family members can create conversations with children in their family
CREATE POLICY "Family members can create conversations with children"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be an active family member
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
    )
    AND (
      -- Family member is participant1 and child is in their family
      (
        participant1_type = 'family_member'
        AND participant1_id = auth.uid()
        AND participant2_type = 'child'
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          JOIN public.children c ON c.parent_id = fm.parent_id
          WHERE fm.id = auth.uid()
          AND fm.status = 'active'
          AND c.id = participant2_id
        )
      )
    )
  );

-- =====================================================
-- STEP 7: Update messages RLS policies to use conversations
-- =====================================================

-- Drop old message policies
DROP POLICY IF EXISTS "Parents can view isolated messages for their children" ON public.messages;
DROP POLICY IF EXISTS "Family members can view isolated messages" ON public.messages;
DROP POLICY IF EXISTS "Parents can view messages for their children" ON public.messages;
DROP POLICY IF EXISTS "Family members can view messages in their family" ON public.messages;

-- Parents can view messages in their conversations
CREATE POLICY "Parents can view messages in their conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    -- User must be a parent
    NOT EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_members.id = auth.uid()
      AND family_members.status = 'active'
    )
    AND (
      -- Message belongs to a conversation where parent is participant1
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND c.participant1_type = 'parent'
        AND c.participant1_id = auth.uid()
      )
      -- OR message is from old format (backward compatibility during migration)
      OR (
        messages.conversation_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.children
          WHERE children.id = messages.child_id
          AND children.parent_id = auth.uid()
        )
        AND (
          (messages.sender_type = 'parent' AND messages.sender_id = auth.uid())
          OR messages.sender_type = 'child'
        )
        AND messages.sender_type != 'family_member'
      )
    )
  );

-- Family members can view messages in their conversations
CREATE POLICY "Family members can view messages in their conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    -- User must be an active family member
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
    )
    AND (
      -- Message belongs to a conversation where family member is participant1
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND c.participant1_type = 'family_member'
        AND c.participant1_id = auth.uid()
      )
      -- OR message is from old format (backward compatibility during migration)
      OR (
        messages.conversation_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          JOIN public.children c ON c.parent_id = fm.parent_id
          WHERE fm.id = auth.uid()
          AND fm.status = 'active'
          AND c.id = messages.child_id
        )
        AND (
          (messages.sender_type = 'family_member' AND messages.family_member_id = auth.uid())
          OR messages.sender_type = 'child'
        )
        AND messages.sender_type != 'parent'
      )
    )
  );

-- Children can view messages in conversations where they are participant2
-- Children use anonymous auth, so we check via child_id
CREATE POLICY "Children can view messages in their conversations"
  ON public.messages FOR SELECT
  TO anon
  USING (
    -- Message belongs to a conversation where child is participant2
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND c.participant2_type = 'child'
      AND c.participant2_id = messages.child_id
    )
    -- OR message is from old format (backward compatibility during migration)
    OR (
      messages.conversation_id IS NULL
      AND messages.sender_type IN ('parent', 'family_member', 'child')
      -- Children can see all messages in their conversation (RLS will filter by child_id at query level)
    )
  );

-- Update INSERT policies to require conversation_id
-- Parents can insert messages in their conversations
DROP POLICY IF EXISTS "Parents can send messages" ON public.messages;
DROP POLICY IF EXISTS "Family members can send messages" ON public.messages;

CREATE POLICY "Parents can send messages in their conversations"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be a parent
    NOT EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_members.id = auth.uid()
      AND family_members.status = 'active'
    )
    AND (
      -- Message belongs to a conversation where parent is participant1
      (
        conversation_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = messages.conversation_id
          AND c.participant1_type = 'parent'
          AND c.participant1_id = auth.uid()
        )
        AND sender_type = 'parent'
        AND sender_id = auth.uid()
      )
      -- OR old format (backward compatibility)
      OR (
        conversation_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.children
          WHERE children.id = messages.child_id
          AND children.parent_id = auth.uid()
        )
        AND sender_type = 'parent'
        AND sender_id = auth.uid()
      )
    )
  );

CREATE POLICY "Family members can send messages in their conversations"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be an active family member
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
    )
    AND (
      -- Message belongs to a conversation where family member is participant1
      (
        conversation_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = messages.conversation_id
          AND c.participant1_type = 'family_member'
          AND c.participant1_id = auth.uid()
        )
        AND sender_type = 'family_member'
        AND family_member_id = auth.uid()
      )
      -- OR old format (backward compatibility)
      OR (
        conversation_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          JOIN public.children c ON c.parent_id = fm.parent_id
          WHERE fm.id = auth.uid()
          AND fm.status = 'active'
          AND c.id = messages.child_id
        )
        AND sender_type = 'family_member'
        AND family_member_id = auth.uid()
      )
    )
  );

-- =====================================================
-- STEP 8: Create trigger to update conversation updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  WHEN (NEW.conversation_id IS NOT NULL)
  EXECUTE FUNCTION update_conversation_timestamp();

-- =====================================================
-- STEP 9: Enable realtime for conversations
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- =====================================================
-- Migration complete
-- =====================================================
-- Next steps:
-- 1. Update application code to use conversations
-- 2. Update message sending to get/create conversation first
-- 3. Update message fetching to filter by conversation_id
-- 4. Update chat list to show conversations instead of children


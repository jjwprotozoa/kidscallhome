-- Migration: Refactor Conversations to Adult/Child Schema (Phase 1)
-- Purpose: Update conversations table to use adult_id (references adult_profiles.id) and child_id (references child_profiles.id)
-- Date: 2025-12-07
-- This migration refactors conversations from participant1/participant2 to adult_id/child_id using profile IDs

-- =====================================================
-- STEP 1: Add new columns to conversations table
-- =====================================================

DO $$
BEGIN
  -- Add adult_id column (will reference adult_profiles.id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'adult_id'
  ) THEN
    ALTER TABLE public.conversations 
    ADD COLUMN adult_id UUID REFERENCES public.adult_profiles(id) ON DELETE CASCADE;
  END IF;

  -- Add child_id column (will reference child_profiles.id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'child_id'
  ) THEN
    ALTER TABLE public.conversations 
    ADD COLUMN child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE;
  END IF;

  -- Add adult_role column (denormalized for performance: 'parent' | 'family_member')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'adult_role'
  ) THEN
    ALTER TABLE public.conversations 
    ADD COLUMN adult_role TEXT CHECK (adult_role IN ('parent', 'family_member'));
  END IF;
END $$;

-- =====================================================
-- STEP 2: Migrate existing conversations data
-- =====================================================
-- Map participant1_id/participant2_id to adult_id/child_id using profile tables

DO $$
DECLARE
  v_conv RECORD;
  v_adult_profile_id UUID;
  v_child_profile_id UUID;
  v_adult_role TEXT;
BEGIN
  FOR v_conv IN 
    SELECT id, participant1_id, participant1_type, participant2_id, participant2_type
    FROM public.conversations
    WHERE adult_id IS NULL OR child_id IS NULL
  LOOP
    -- Determine adult and child
    -- participant1 is always adult (parent or family_member), participant2 is always child
    IF v_conv.participant1_type IN ('parent', 'family_member') THEN
      -- participant1 is adult, participant2 is child
      v_adult_role := v_conv.participant1_type;
      
      -- Resolve adult_profile_id
      -- For parents: user_id = participant1_id, family_id = participant1_id (parent's own ID)
      -- For family_members: user_id = participant1_id, family_id = parent_id from family_members
      IF v_conv.participant1_type = 'parent' THEN
        SELECT id INTO v_adult_profile_id
        FROM public.adult_profiles
        WHERE user_id = v_conv.participant1_id
          AND family_id = v_conv.participant1_id
          AND role = 'parent'
        LIMIT 1;
      ELSIF v_conv.participant1_type = 'family_member' THEN
        -- Get parent_id from family_members to determine family_id
        SELECT ap.id INTO v_adult_profile_id
        FROM public.family_members fm
        JOIN public.adult_profiles ap ON ap.user_id = fm.id AND ap.family_id = fm.parent_id
        WHERE fm.id = v_conv.participant1_id
          AND ap.role = 'family_member'
        LIMIT 1;
      END IF;
      
      -- Resolve child_profile_id (should match participant2_id since we preserved IDs)
      SELECT id INTO v_child_profile_id
      FROM public.child_profiles
      WHERE id = v_conv.participant2_id
      LIMIT 1;
      
    ELSE
      -- This shouldn't happen based on constraints, but handle it
      CONTINUE;
    END IF;
    
    -- Update conversation with profile IDs
    IF v_adult_profile_id IS NOT NULL AND v_child_profile_id IS NOT NULL THEN
      UPDATE public.conversations
      SET 
        adult_id = v_adult_profile_id,
        child_id = v_child_profile_id,
        adult_role = v_adult_role
      WHERE id = v_conv.id;
    ELSE
      -- Log warning if we can't resolve profiles
      RAISE WARNING 'Could not resolve profiles for conversation %: adult_profile_id=%, child_profile_id=%', 
        v_conv.id, v_adult_profile_id, v_child_profile_id;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- STEP 3: Add unique constraint on (adult_id, child_id)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'conversations_unique_adult_child' 
    AND table_name = 'conversations'
  ) THEN
    ALTER TABLE public.conversations
    ADD CONSTRAINT conversations_unique_adult_child 
    UNIQUE (adult_id, child_id);
  END IF;
END $$;

-- =====================================================
-- STEP 4: Create indexes for new columns
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_conversations_adult_id ON public.conversations(adult_id);
CREATE INDEX IF NOT EXISTS idx_conversations_child_id ON public.conversations(child_id);
CREATE INDEX IF NOT EXISTS idx_conversations_adult_role ON public.conversations(adult_role);
CREATE INDEX IF NOT EXISTS idx_conversations_adult_child ON public.conversations(adult_id, child_id);

-- =====================================================
-- STEP 5: Update get_or_create_conversation() function
-- =====================================================
-- Change to use adult_id (profile ID) and child_id (profile ID)

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_adult_id UUID,  -- References adult_profiles.id
  p_adult_role TEXT, -- 'parent' | 'family_member'
  p_child_id UUID   -- References child_profiles.id
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Validate inputs
  IF p_adult_id IS NULL OR p_child_id IS NULL OR p_adult_role IS NULL THEN
    RAISE EXCEPTION 'All parameters must be provided: p_adult_id, p_adult_role, p_child_id';
  END IF;
  
  IF p_adult_role NOT IN ('parent', 'family_member') THEN
    RAISE EXCEPTION 'p_adult_role must be ''parent'' or ''family_member''';
  END IF;
  
  -- Verify adult_profile exists
  IF NOT EXISTS (
    SELECT 1 FROM public.adult_profiles 
    WHERE id = p_adult_id AND role = p_adult_role
  ) THEN
    RAISE EXCEPTION 'Adult profile with id % and role % does not exist', p_adult_id, p_adult_role;
  END IF;
  
  -- Verify child_profile exists
  IF NOT EXISTS (
    SELECT 1 FROM public.child_profiles 
    WHERE id = p_child_id
  ) THEN
    RAISE EXCEPTION 'Child profile with id % does not exist', p_child_id;
  END IF;
  
  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE adult_id = p_adult_id
    AND child_id = p_child_id;
  
  -- If not found, create it
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (adult_id, child_id, adult_role)
    VALUES (p_adult_id, p_child_id, p_adult_role)
    ON CONFLICT (adult_id, child_id)
    DO UPDATE SET updated_at = NOW(), adult_role = p_adult_role
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$$;

-- =====================================================
-- STEP 6: Migrate all messages to have conversation_id
-- =====================================================
-- First, ensure all messages have conversation_id
-- This is critical - we must migrate ALL messages before setting NOT NULL

DO $$
DECLARE
  v_message RECORD;
  v_adult_profile_id UUID;
  v_child_profile_id UUID;
  v_conversation_id UUID;
  v_family_id UUID;
  v_adult_role TEXT;
BEGIN
  -- Process all messages that don't have conversation_id
  FOR v_message IN 
    SELECT id, sender_id, sender_type, family_member_id, child_id
    FROM public.messages
    WHERE conversation_id IS NULL
  LOOP
    -- Resolve child_profile_id (should match child_id)
    SELECT id INTO v_child_profile_id
    FROM public.child_profiles
    WHERE id = v_message.child_id
    LIMIT 1;
    
    IF v_child_profile_id IS NULL THEN
      RAISE WARNING 'Could not find child_profile for child_id %', v_message.child_id;
      CONTINUE;
    END IF;
    
    -- Resolve adult_profile_id based on sender_type
    IF v_message.sender_type = 'parent' THEN
      -- For parents: user_id = sender_id, family_id = sender_id (parent's own ID)
      SELECT id INTO v_adult_profile_id
      FROM public.adult_profiles
      WHERE user_id = v_message.sender_id
        AND role = 'parent'
        AND family_id = v_message.sender_id
      LIMIT 1;
      
    ELSIF v_message.sender_type = 'family_member' THEN
      -- For family members: need to get parent_id (family_id) first
      IF v_message.family_member_id IS NOT NULL THEN
        SELECT parent_id INTO v_family_id
        FROM public.family_members
        WHERE id = v_message.family_member_id
        LIMIT 1;
        
        IF v_family_id IS NOT NULL THEN
          SELECT id INTO v_adult_profile_id
          FROM public.adult_profiles
          WHERE user_id = v_message.family_member_id
            AND role = 'family_member'
            AND family_id = v_family_id
          LIMIT 1;
        END IF;
      END IF;
      
    ELSIF v_message.sender_type = 'child' THEN
      -- For child messages: need to find or create the conversation
      -- Get the child's family_id first
      SELECT family_id INTO v_family_id
      FROM public.child_profiles
      WHERE id = v_message.child_id
      LIMIT 1;
      
      IF v_family_id IS NULL THEN
        RAISE WARNING 'Could not find family_id for child %', v_message.child_id;
        CONTINUE;
      END IF;
      
      -- Try to find existing conversation for this child
      -- Look for the most recent conversation with this child
      SELECT c.id INTO v_conversation_id
      FROM public.conversations c
      WHERE c.child_id = v_child_profile_id
      ORDER BY c.updated_at DESC
      LIMIT 1;
      
      -- If no conversation exists, create one with the parent
      -- (Child messages are typically in response to parent messages)
      IF v_conversation_id IS NULL THEN
        -- Find the parent's adult_profile_id
        SELECT id INTO v_adult_profile_id
        FROM public.adult_profiles
        WHERE family_id = v_family_id
          AND role = 'parent'
        ORDER BY created_at ASC  -- Get the primary parent (first one)
        LIMIT 1;
        
        IF v_adult_profile_id IS NOT NULL THEN
          -- Create conversation with parent
          INSERT INTO public.conversations (adult_id, child_id, adult_role)
          VALUES (v_adult_profile_id, v_child_profile_id, 'parent')
          ON CONFLICT (adult_id, child_id)
          DO UPDATE SET updated_at = NOW()
          RETURNING id INTO v_conversation_id;
        ELSE
          -- No parent found, try to find any adult in the family
          SELECT id INTO v_adult_profile_id
          FROM public.adult_profiles
          WHERE family_id = v_family_id
          ORDER BY 
            CASE role WHEN 'parent' THEN 1 ELSE 2 END,  -- Prefer parent
            created_at ASC
          LIMIT 1;
          
          IF v_adult_profile_id IS NOT NULL THEN
            -- Get the role for this adult
            SELECT role INTO v_adult_role
            FROM public.adult_profiles
            WHERE id = v_adult_profile_id;
            
            -- Create conversation
            INSERT INTO public.conversations (adult_id, child_id, adult_role)
            VALUES (v_adult_profile_id, v_child_profile_id, v_adult_role)
            ON CONFLICT (adult_id, child_id)
            DO UPDATE SET updated_at = NOW()
            RETURNING id INTO v_conversation_id;
          END IF;
        END IF;
      END IF;
      
      -- Update message with conversation_id
      IF v_conversation_id IS NOT NULL THEN
        UPDATE public.messages
        SET conversation_id = v_conversation_id
        WHERE id = v_message.id;
      ELSE
        RAISE WARNING 'Could not find or create conversation for child message %', v_message.id;
      END IF;
      
      CONTINUE;  -- Skip to next message
    ELSE
      RAISE WARNING 'Unknown sender_type % for message %', v_message.sender_type, v_message.id;
      CONTINUE;
    END IF;
    
    -- If we have both profile IDs, get or create conversation
    IF v_adult_profile_id IS NOT NULL AND v_child_profile_id IS NOT NULL THEN
      -- Try to find existing conversation
      SELECT id INTO v_conversation_id
      FROM public.conversations
      WHERE adult_id = v_adult_profile_id
        AND child_id = v_child_profile_id
      LIMIT 1;
      
      -- If not found, create it
      IF v_conversation_id IS NULL THEN
        INSERT INTO public.conversations (adult_id, child_id, adult_role)
        SELECT 
          v_adult_profile_id,
          v_child_profile_id,
          ap.role
        FROM public.adult_profiles ap
        WHERE ap.id = v_adult_profile_id
        ON CONFLICT (adult_id, child_id)
        DO UPDATE SET updated_at = NOW()
        RETURNING id INTO v_conversation_id;
      END IF;
      
      -- Update message with conversation_id
      IF v_conversation_id IS NOT NULL THEN
        UPDATE public.messages
        SET conversation_id = v_conversation_id
        WHERE id = v_message.id;
      ELSE
        RAISE WARNING 'Could not create conversation for message %', v_message.id;
      END IF;
    ELSE
      RAISE WARNING 'Could not resolve profiles for message %: adult_profile_id=%, child_profile_id=%', 
        v_message.id, v_adult_profile_id, v_child_profile_id;
    END IF;
  END LOOP;
END $$;

-- Now add NOT NULL constraint (only if all messages have conversation_id)
DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  -- Check how many messages still don't have conversation_id
  SELECT COUNT(*) INTO v_null_count
  FROM public.messages
  WHERE conversation_id IS NULL;
  
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'Cannot set NOT NULL: % messages still have NULL conversation_id. Please migrate these messages first.', v_null_count;
  END IF;
  
  -- Check if constraint already exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'conversation_id'
    AND is_nullable = 'NO'
  ) THEN
    -- Already NOT NULL, skip
    RAISE NOTICE 'conversation_id is already NOT NULL';
    RETURN;
  END IF;
  
  -- Make conversation_id NOT NULL
  ALTER TABLE public.messages
  ALTER COLUMN conversation_id SET NOT NULL;
  
  RAISE NOTICE 'Successfully set conversation_id to NOT NULL';
END $$;

-- =====================================================
-- STEP 7: Drop old RLS policies that reference participant columns
-- =====================================================
-- Must drop these before we can drop the columns

DROP POLICY IF EXISTS "Parents can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Family members can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Parents can create conversations with their children" ON public.conversations;
DROP POLICY IF EXISTS "Family members can create conversations with children" ON public.conversations;
DROP POLICY IF EXISTS "Parents can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Family members can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Parents can send messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Family members can send messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Children can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- Note: New policies will be created in Phase 3 migration (20251207000002_tighten_rls_policies.sql)

-- =====================================================
-- STEP 8: Drop old participant columns (after ensuring migration is complete)
-- =====================================================
-- Only drop if all conversations have been migrated

DO $$
DECLARE
  v_unmigrated_count INTEGER;
BEGIN
  -- Count conversations without adult_id or child_id
  SELECT COUNT(*) INTO v_unmigrated_count
  FROM public.conversations
  WHERE adult_id IS NULL OR child_id IS NULL;
  
  IF v_unmigrated_count > 0 THEN
    RAISE WARNING 'Cannot drop old columns: % conversations still need migration', v_unmigrated_count;
  ELSE
    -- All conversations migrated, safe to drop old columns
    -- Drop constraints first
    ALTER TABLE public.conversations
    DROP CONSTRAINT IF EXISTS conversations_unique_pair,
    DROP CONSTRAINT IF EXISTS conversations_participants_check;
    
    -- Drop old indexes
    DROP INDEX IF EXISTS idx_conversations_participant1;
    DROP INDEX IF EXISTS idx_conversations_participant2;
    
    -- Drop old columns (now safe since policies are dropped)
    ALTER TABLE public.conversations
    DROP COLUMN IF EXISTS participant1_id,
    DROP COLUMN IF EXISTS participant1_type,
    DROP COLUMN IF EXISTS participant2_id,
    DROP COLUMN IF EXISTS participant2_type;
    
    RAISE NOTICE 'Successfully dropped old participant columns';
  END IF;
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- Next steps:
-- 1. Update RLS policies to use adult_id and child_id
-- 2. Update frontend code to use profile IDs
-- 3. Remove all backward compatibility code


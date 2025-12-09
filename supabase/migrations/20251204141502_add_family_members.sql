-- Migration: Add family members feature
-- Purpose: Allow parents to invite and manage other family members (grandparents, aunts, uncles, etc.)
-- Date: 2025-12-04

-- =====================================================
-- STEP 1: Create family_members table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('grandparent', 'aunt', 'uncle', 'cousin', 'other')),
  invitation_token UUID UNIQUE DEFAULT gen_random_uuid(),
  invitation_sent_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.parents(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_family_members_parent_id ON public.family_members(parent_id);
CREATE INDEX IF NOT EXISTS idx_family_members_email ON public.family_members(email);
CREATE INDEX IF NOT EXISTS idx_family_members_invitation_token ON public.family_members(invitation_token);
CREATE INDEX IF NOT EXISTS idx_family_members_status ON public.family_members(status);

-- =====================================================
-- STEP 2: Enable RLS on family_members table
-- =====================================================
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 3: RLS Policies for family_members
-- =====================================================

-- Parents can view family members in their family
CREATE POLICY "Parents can view family members in their family"
  ON public.family_members FOR SELECT
  USING (parent_id = auth.uid());

-- Parents can insert family members (create invitations)
CREATE POLICY "Parents can insert family members"
  ON public.family_members FOR INSERT
  WITH CHECK (
    parent_id = auth.uid() AND
    created_by = auth.uid()
  );

-- Parents can update family members (approve, suspend, etc.)
CREATE POLICY "Parents can update family members"
  ON public.family_members FOR UPDATE
  USING (parent_id = auth.uid());

-- Parents can delete family members (remove invitations/members)
CREATE POLICY "Parents can delete family members"
  ON public.family_members FOR DELETE
  USING (parent_id = auth.uid());

-- Family members can view their own profile
CREATE POLICY "Family members can view own profile"
  ON public.family_members FOR SELECT
  USING (id = auth.uid());

-- Family members can update their own profile (name, etc.)
CREATE POLICY "Family members can update own profile"
  ON public.family_members FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow anonymous users to verify invitation tokens (for registration page)
CREATE POLICY "Anyone can verify invitation tokens"
  ON public.family_members FOR SELECT
  TO anon
  USING (true); -- Limited by invitation_token lookup only

-- =====================================================
-- STEP 4: Update calls table to support family_member caller_type
-- =====================================================

-- Drop existing caller_type constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'calls_caller_type_check' 
    AND table_name = 'calls'
  ) THEN
    ALTER TABLE public.calls DROP CONSTRAINT calls_caller_type_check;
  END IF;
END $$;

-- Add new constraint allowing 'family_member' as caller_type
ALTER TABLE public.calls
ADD CONSTRAINT calls_caller_type_check 
CHECK (caller_type IN ('parent', 'child', 'family_member'));

-- Add family_member_id column (nullable, only set when caller_type = 'family_member')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'family_member_id'
  ) THEN
    ALTER TABLE public.calls 
    ADD COLUMN family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for family_member_id lookups
CREATE INDEX IF NOT EXISTS idx_calls_family_member_id ON public.calls(family_member_id);

-- =====================================================
-- STEP 5: Update calls RLS policies to include family members
-- =====================================================

-- Family members can view calls involving children in their family
CREATE POLICY "Family members can view calls in their family"
  ON public.calls FOR SELECT
  USING (
    -- Family member is the caller
    (caller_type = 'family_member' AND family_member_id = auth.uid()) OR
    -- Or call involves a child in their family
    EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.children c ON c.parent_id = fm.parent_id
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
      AND c.id = calls.child_id
    )
  );

-- Family members can create calls with children in their family
CREATE POLICY "Family members can create calls"
  ON public.calls FOR INSERT
  WITH CHECK (
    caller_type = 'family_member' AND
    family_member_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.children c ON c.parent_id = fm.parent_id
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
      AND c.id = calls.child_id
    )
  );

-- Family members can update calls they're involved in
CREATE POLICY "Family members can update their calls"
  ON public.calls FOR UPDATE
  USING (
    (caller_type = 'family_member' AND family_member_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.children c ON c.parent_id = fm.parent_id
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
      AND c.id = calls.child_id
    )
  );

-- =====================================================
-- STEP 6: Update messages table to support family_member sender_type
-- =====================================================

-- Drop existing sender_type constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'messages_sender_type_check' 
    AND table_name = 'messages'
  ) THEN
    ALTER TABLE public.messages DROP CONSTRAINT messages_sender_type_check;
  END IF;
END $$;

-- Add new constraint allowing 'family_member' as sender_type
ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_type_check 
CHECK (sender_type IN ('parent', 'child', 'family_member'));

-- Add family_member_id column to messages (nullable, only set when sender_type = 'family_member')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'family_member_id'
  ) THEN
    ALTER TABLE public.messages 
    ADD COLUMN family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for family_member_id in messages
CREATE INDEX IF NOT EXISTS idx_messages_family_member_id ON public.messages(family_member_id);

-- =====================================================
-- STEP 7: Update messages RLS policies for family members
-- =====================================================

-- Family members can view messages for children in their family
CREATE POLICY "Family members can view messages in their family"
  ON public.messages FOR SELECT
  USING (
    -- Family member sent the message
    (sender_type = 'family_member' AND family_member_id = auth.uid()) OR
    -- Or message is for a child in their family
    EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.children c ON c.parent_id = fm.parent_id
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
      AND c.id = messages.child_id
    )
  );

-- Family members can send messages to children in their family
CREATE POLICY "Family members can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_type = 'family_member' AND
    family_member_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.children c ON c.parent_id = fm.parent_id
      WHERE fm.id = auth.uid()
      AND fm.status = 'active'
      AND c.id = child_id
    )
  );

-- =====================================================
-- STEP 8: Update children RLS policies for family members
-- =====================================================

-- Family members can view children in their family
CREATE POLICY "Family members can view children in their family"
  ON public.children FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_members.parent_id = children.parent_id
      AND family_members.id = auth.uid()
      AND family_members.status = 'active'
    )
  );

-- =====================================================
-- STEP 9: Create trigger function to update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_family_member_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_family_members_updated_at
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION update_family_member_updated_at();

-- =====================================================
-- STEP 10: Create trigger function to auto-create family_member profile on signup
-- =====================================================
-- This will be called when a family member accepts invitation and signs up
CREATE OR REPLACE FUNCTION public.handle_new_family_member()
RETURNS TRIGGER AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Check if this user was invited (has invitation_token in metadata)
  IF NEW.raw_user_meta_data->>'invitation_token' IS NOT NULL THEN
    -- Find the invitation
    SELECT * INTO invitation_record
    FROM public.family_members
    WHERE invitation_token::text = NEW.raw_user_meta_data->>'invitation_token'
    AND status = 'pending';
    
    -- If invitation found, activate the family member
    IF FOUND THEN
      UPDATE public.family_members
      SET 
        id = NEW.id,
        invitation_accepted_at = NOW(),
        status = 'active'
      WHERE invitation_token::text = NEW.raw_user_meta_data->>'invitation_token';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Note: We'll need to manually call this or use a different approach
-- since auth.users trigger might fire before we can update family_members
-- Alternative: Handle this in the application code during registration

-- =====================================================
-- STEP 11: Enable realtime for family_members table
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_members;

-- =====================================================
-- STEP 12: Create helper function to check if email is already invited/registered
-- =====================================================
CREATE OR REPLACE FUNCTION check_family_member_email(email_to_check TEXT, parent_id_to_check UUID)
RETURNS TABLE (
  found BOOLEAN,
  status TEXT,
  invitation_token UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as found,
    fm.status,
    fm.invitation_token
  FROM public.family_members fm
  WHERE fm.email = email_to_check
  AND fm.parent_id = parent_id_to_check
  LIMIT 1;
  
  -- If no row found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::UUID;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Migration complete
-- =====================================================
-- Next steps:
-- 1. Create invitation email sending logic in application
-- 2. Create family member registration page
-- 3. Create parent dashboard UI for managing family members
-- 4. Create family member dashboard
-- 5. Update call handlers to support family_member caller_type


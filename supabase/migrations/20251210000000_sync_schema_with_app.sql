-- Migration: Sync Database Schema with Application Requirements
-- Purpose: Ensure all tables and columns exist that are required by the application
-- Date: 2025-12-10
-- This migration creates missing tables and adds missing columns to match the application code

-- =====================================================
-- STEP 1: Create adult_profiles table if missing
-- =====================================================

CREATE TABLE IF NOT EXISTS public.adult_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'family_member')),
  relationship_type TEXT CHECK (relationship_type IN ('grandparent', 'aunt', 'uncle', 'cousin', 'other')),
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, family_id, role)
);

-- Create indexes for adult_profiles
CREATE INDEX IF NOT EXISTS idx_adult_profiles_user_id ON public.adult_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_adult_profiles_family_id ON public.adult_profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_adult_profiles_role ON public.adult_profiles(role);
CREATE INDEX IF NOT EXISTS idx_adult_profiles_user_family ON public.adult_profiles(user_id, family_id);

-- =====================================================
-- STEP 2: Create child_profiles table if missing
-- =====================================================

CREATE TABLE IF NOT EXISTS public.child_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  name TEXT NOT NULL,
  login_code TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  avatar_color TEXT DEFAULT '#3B82F6',
  age INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for child_profiles
CREATE INDEX IF NOT EXISTS idx_child_profiles_family_id ON public.child_profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_child_profiles_login_code ON public.child_profiles(login_code);

-- =====================================================
-- STEP 3: Create conversations table if missing
-- =====================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'one_to_one' CHECK (type IN ('one_to_one', 'group')),
  adult_id UUID REFERENCES public.adult_profiles(id) ON DELETE CASCADE,
  child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  adult_role TEXT CHECK (adult_role IN ('parent', 'family_member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure unique conversation per adult-child pair
  CONSTRAINT conversations_unique_adult_child UNIQUE (adult_id, child_id)
);

-- Add missing columns to conversations if table exists
DO $$
BEGIN
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
    AND column_name = 'adult_id'
  ) THEN
    ALTER TABLE public.conversations 
    ADD COLUMN adult_id UUID REFERENCES public.adult_profiles(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'child_id'
  ) THEN
    ALTER TABLE public.conversations 
    ADD COLUMN child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'adult_role'
  ) THEN
    ALTER TABLE public.conversations 
    ADD COLUMN adult_role TEXT CHECK (adult_role IN ('parent', 'family_member'));
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
END $$;

-- Create indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_adult_id ON public.conversations(adult_id);
CREATE INDEX IF NOT EXISTS idx_conversations_child_id ON public.conversations(child_id);
CREATE INDEX IF NOT EXISTS idx_conversations_adult_role ON public.conversations(adult_role);
CREATE INDEX IF NOT EXISTS idx_conversations_adult_child ON public.conversations(adult_id, child_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- =====================================================
-- STEP 4: Create conversation_participants table if missing
-- =====================================================

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'family_member', 'child')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, user_id)
);

-- Create indexes for conversation_participants
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_role ON public.conversation_participants(role);

-- =====================================================
-- STEP 5: Create child_family_memberships table if missing
-- =====================================================

CREATE TABLE IF NOT EXISTS public.child_family_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (child_profile_id, family_id)
);

-- Create indexes for child_family_memberships
CREATE INDEX IF NOT EXISTS idx_child_family_memberships_child ON public.child_family_memberships(child_profile_id);
CREATE INDEX IF NOT EXISTS idx_child_family_memberships_family ON public.child_family_memberships(family_id);

-- =====================================================
-- STEP 6: Create child_connections table if missing
-- =====================================================

CREATE TABLE IF NOT EXISTS public.child_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_child_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  requester_family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  target_child_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  target_family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'blocked')),
  approved_by_parent_id UUID REFERENCES public.adult_profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  requested_by_child BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_child_id, target_child_id)
);

-- Create indexes for child_connections
CREATE INDEX IF NOT EXISTS idx_child_connections_requester ON public.child_connections(requester_child_id);
CREATE INDEX IF NOT EXISTS idx_child_connections_target ON public.child_connections(target_child_id);
CREATE INDEX IF NOT EXISTS idx_child_connections_status ON public.child_connections(status);
CREATE INDEX IF NOT EXISTS idx_child_connections_families ON public.child_connections(requester_family_id, target_family_id);

-- =====================================================
-- STEP 7: Create blocked_contacts table if missing
-- =====================================================

CREATE TABLE IF NOT EXISTS public.blocked_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_child_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  blocked_adult_profile_id UUID REFERENCES public.adult_profiles(id) ON DELETE CASCADE,
  blocked_child_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  parent_notified_at TIMESTAMPTZ,
  unblocked_at TIMESTAMPTZ,
  unblocked_by_parent_id UUID REFERENCES public.adult_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT blocked_contacts_one_target CHECK (
    (blocked_adult_profile_id IS NOT NULL AND blocked_child_profile_id IS NULL) OR
    (blocked_adult_profile_id IS NULL AND blocked_child_profile_id IS NOT NULL)
  ),
  UNIQUE (blocker_child_id, blocked_adult_profile_id, blocked_child_profile_id)
);

-- Create indexes for blocked_contacts
CREATE INDEX IF NOT EXISTS idx_blocked_contacts_blocker ON public.blocked_contacts(blocker_child_id);
CREATE INDEX IF NOT EXISTS idx_blocked_contacts_adult ON public.blocked_contacts(blocked_adult_profile_id);
CREATE INDEX IF NOT EXISTS idx_blocked_contacts_child ON public.blocked_contacts(blocked_child_profile_id);
CREATE INDEX IF NOT EXISTS idx_blocked_contacts_active ON public.blocked_contacts(blocker_child_id, unblocked_at) WHERE unblocked_at IS NULL;

-- =====================================================
-- STEP 8: Create reports table if missing
-- =====================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_child_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  reported_adult_profile_id UUID REFERENCES public.adult_profiles(id) ON DELETE CASCADE,
  reported_child_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('inappropriate_content', 'harassment', 'bullying', 'threat', 'other')),
  report_message TEXT,
  related_message_id UUID,
  related_call_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by_parent_id UUID REFERENCES public.adult_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reports_one_target CHECK (
    (reported_adult_profile_id IS NOT NULL AND reported_child_profile_id IS NULL) OR
    (reported_adult_profile_id IS NULL AND reported_child_profile_id IS NOT NULL)
  )
);

-- Create indexes for reports
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_child_id);
CREATE INDEX IF NOT EXISTS idx_reports_adult ON public.reports(reported_adult_profile_id);
CREATE INDEX IF NOT EXISTS idx_reports_child ON public.reports(reported_child_profile_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_pending ON public.reports(status) WHERE status = 'pending';

-- =====================================================
-- STEP 9: Create family_feature_flags table if missing
-- =====================================================

CREATE TABLE IF NOT EXISTS public.family_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, key)
);

-- Create indexes for family_feature_flags
CREATE INDEX IF NOT EXISTS idx_family_feature_flags_family ON public.family_feature_flags(family_id);
CREATE INDEX IF NOT EXISTS idx_family_feature_flags_key ON public.family_feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_family_feature_flags_enabled ON public.family_feature_flags(enabled) WHERE enabled = true;

-- =====================================================
-- STEP 10: Add missing columns to messages table
-- =====================================================

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
    
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id) WHERE conversation_id IS NOT NULL;
  END IF;
  
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

-- =====================================================
-- STEP 11: Add missing columns to calls table
-- =====================================================

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
    
    CREATE INDEX IF NOT EXISTS idx_calls_conversation_id ON public.calls(conversation_id) WHERE conversation_id IS NOT NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'callee_id'
  ) THEN
    ALTER TABLE public.calls 
    ADD COLUMN callee_id UUID REFERENCES public.child_profiles(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_calls_callee_id ON public.calls(callee_id) WHERE callee_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- STEP 12: Add missing columns to families table
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'families' 
    AND column_name = 'household_type'
  ) THEN
    ALTER TABLE public.families 
    ADD COLUMN household_type TEXT NOT NULL DEFAULT 'single' 
    CHECK (household_type IN ('single', 'two_household'));
    
    CREATE INDEX IF NOT EXISTS idx_families_household_type ON public.families(household_type);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'families' 
    AND column_name = 'linked_family_id'
  ) THEN
    ALTER TABLE public.families 
    ADD COLUMN linked_family_id UUID REFERENCES public.families(id) ON DELETE SET NULL;
    
    ALTER TABLE public.families
    ADD CONSTRAINT families_no_self_link CHECK (linked_family_id != id);
    
    CREATE INDEX IF NOT EXISTS idx_families_linked_family_id ON public.families(linked_family_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'families' 
    AND column_name = 'linked_at'
  ) THEN
    ALTER TABLE public.families 
    ADD COLUMN linked_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'families' 
    AND column_name = 'safety_mode_enabled'
  ) THEN
    ALTER TABLE public.families 
    ADD COLUMN safety_mode_enabled BOOLEAN NOT NULL DEFAULT false;
    
    CREATE INDEX IF NOT EXISTS idx_families_safety_mode ON public.families(safety_mode_enabled) WHERE safety_mode_enabled = true;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'families' 
    AND column_name = 'safety_mode_settings'
  ) THEN
    ALTER TABLE public.families 
    ADD COLUMN safety_mode_settings JSONB DEFAULT '{
      "keyword_alerts": true,
      "ai_content_scanning": false,
      "export_conversations": true,
      "alert_threshold": "medium"
    }'::jsonb;
  END IF;
END $$;

-- =====================================================
-- STEP 13: Enable RLS on new tables
-- =====================================================

ALTER TABLE public.adult_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_family_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_feature_flags ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 14: Create update trigger function if missing
-- =====================================================

CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_adult_profiles_updated_at ON public.adult_profiles;
CREATE TRIGGER update_adult_profiles_updated_at
  BEFORE UPDATE ON public.adult_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();

DROP TRIGGER IF EXISTS update_child_profiles_updated_at ON public.child_profiles;
CREATE TRIGGER update_child_profiles_updated_at
  BEFORE UPDATE ON public.child_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();

DROP TRIGGER IF EXISTS update_child_connections_updated_at ON public.child_connections;
CREATE TRIGGER update_child_connections_updated_at
  BEFORE UPDATE ON public.child_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();

DROP TRIGGER IF EXISTS update_family_feature_flags_updated_at ON public.family_feature_flags;
CREATE TRIGGER update_family_feature_flags_updated_at
  BEFORE UPDATE ON public.family_feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();

-- =====================================================
-- STEP 15: Enable realtime for new tables
-- =====================================================

DO $$
BEGIN
  -- Add tables to realtime publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'adult_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.adult_profiles;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'child_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.child_profiles;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'child_family_memberships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.child_family_memberships;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'child_connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.child_connections;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'blocked_contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_contacts;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'family_feature_flags'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.family_feature_flags;
  END IF;
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- This migration ensures all tables and columns exist
-- Note: RLS policies should be created by other migrations
-- This migration only creates the schema structure








-- Migration: Family Communication System - Complete Configuration
-- Purpose: Implement complete family structure models, child-to-child communication, blocking/reporting, and safety features
-- Date: 2025-12-08
-- This migration implements the complete family communication app specification

-- =====================================================
-- STEP 1: Extend families table for household types
-- =====================================================

-- Add household_type column to families table
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
  END IF;
END $$;

-- Add linked_family_id for cooperative co-parents (optional linking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'families' 
    AND column_name = 'linked_family_id'
  ) THEN
    ALTER TABLE public.families 
    ADD COLUMN linked_family_id UUID REFERENCES public.families(id) ON DELETE SET NULL;
    
    -- Prevent self-linking
    ALTER TABLE public.families
    ADD CONSTRAINT families_no_self_link CHECK (linked_family_id != id);
  END IF;
END $$;

-- Add linked_at timestamp for tracking when families were linked
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'families' 
    AND column_name = 'linked_at'
  ) THEN
    ALTER TABLE public.families 
    ADD COLUMN linked_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_families_household_type ON public.families(household_type);
CREATE INDEX IF NOT EXISTS idx_families_linked_family_id ON public.families(linked_family_id);

-- =====================================================
-- STEP 2: Update child_profiles to support multiple families
-- =====================================================
-- For two-household setups, a child can belong to TWO families
-- We'll use a junction table to support this

-- Create child_family_memberships junction table
CREATE TABLE IF NOT EXISTS public.child_family_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure a child can only be in a family once
  UNIQUE (child_profile_id, family_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_child_family_memberships_child ON public.child_family_memberships(child_profile_id);
CREATE INDEX IF NOT EXISTS idx_child_family_memberships_family ON public.child_family_memberships(family_id);

-- First, ensure families exist for all parents
-- child_profiles.family_id contains parent_id, which should be used as family_id
-- Create families for all parents if they don't exist
DO $$
DECLARE
  parent_record RECORD;
BEGIN
  FOR parent_record IN 
    SELECT DISTINCT p.id, p.family_code
    FROM public.parents p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.families f WHERE f.id = p.id
    )
  LOOP
    -- Create family using parent_id as family_id
    INSERT INTO public.families (id, invite_code, household_type, name)
    VALUES (
      parent_record.id,
      COALESCE(parent_record.family_code, 'FAM' || upper(substr(parent_record.id::text, 1, 8))),
      'single',
      NULL
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- Migrate existing child_profiles.family_id to junction table
-- child_profiles.family_id contains parent_id, which should match families.id
DO $$
DECLARE
  child_record RECORD;
  v_family_id UUID;
BEGIN
  FOR child_record IN 
    SELECT id, family_id 
    FROM public.child_profiles 
    WHERE family_id IS NOT NULL
  LOOP
    -- child_profiles.family_id is a parent_id
    -- Check if a family exists with this id (we just created them above)
    IF EXISTS (SELECT 1 FROM public.families WHERE id = child_record.family_id) THEN
      v_family_id := child_record.family_id;
    ELSE
      -- Try to get family_id from adult_profiles (which also uses parent_id as family_id)
      SELECT ap.family_id INTO v_family_id
      FROM public.adult_profiles ap
      WHERE ap.family_id = child_record.family_id
        AND ap.role = 'parent'
      LIMIT 1;
      
      -- If still not found, skip this record
      IF v_family_id IS NULL THEN
        RAISE NOTICE 'Skipping child_profile % - could not find family for parent_id %', child_record.id, child_record.family_id;
        CONTINUE;
      END IF;
    END IF;
    
    -- Insert into junction table
    IF v_family_id IS NOT NULL THEN
      INSERT INTO public.child_family_memberships (child_profile_id, family_id)
      VALUES (child_record.id, v_family_id)
      ON CONFLICT (child_profile_id, family_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- STEP 3: Create child-to-child communication approval system
-- =====================================================

-- Table to track child-to-child connection requests and approvals
CREATE TABLE IF NOT EXISTS public.child_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_child_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  requester_family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  target_child_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  target_family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  -- Approval status: 'pending', 'approved', 'rejected', 'blocked'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'blocked')),
  -- Which parent approved (for tracking)
  approved_by_parent_id UUID REFERENCES public.adult_profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  -- Request metadata
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  requested_by_child BOOLEAN DEFAULT false, -- true if child requested, false if parent requested
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique connection request per child pair
  UNIQUE (requester_child_id, target_child_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_child_connections_requester ON public.child_connections(requester_child_id);
CREATE INDEX IF NOT EXISTS idx_child_connections_target ON public.child_connections(target_child_id);
CREATE INDEX IF NOT EXISTS idx_child_connections_status ON public.child_connections(status);
CREATE INDEX IF NOT EXISTS idx_child_connections_families ON public.child_connections(requester_family_id, target_family_id);

-- =====================================================
-- STEP 4: Create blocking and reporting system
-- =====================================================

-- Table to track blocked contacts (child blocking adults or other children)
CREATE TABLE IF NOT EXISTS public.blocked_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_child_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  blocked_adult_profile_id UUID REFERENCES public.adult_profiles(id) ON DELETE CASCADE,
  blocked_child_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  -- Ensure either adult or child is blocked, but not both
  CONSTRAINT blocked_contacts_one_target CHECK (
    (blocked_adult_profile_id IS NOT NULL AND blocked_child_profile_id IS NULL) OR
    (blocked_adult_profile_id IS NULL AND blocked_child_profile_id IS NOT NULL)
  ),
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  -- Parent notification status
  parent_notified_at TIMESTAMPTZ,
  -- Unblock information
  unblocked_at TIMESTAMPTZ,
  unblocked_by_parent_id UUID REFERENCES public.adult_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique block per child-contact pair
  UNIQUE (blocker_child_id, blocked_adult_profile_id, blocked_child_profile_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_blocked_contacts_blocker ON public.blocked_contacts(blocker_child_id);
CREATE INDEX IF NOT EXISTS idx_blocked_contacts_adult ON public.blocked_contacts(blocked_adult_profile_id);
CREATE INDEX IF NOT EXISTS idx_blocked_contacts_child ON public.blocked_contacts(blocked_child_profile_id);
CREATE INDEX IF NOT EXISTS idx_blocked_contacts_active ON public.blocked_contacts(blocker_child_id, unblocked_at) WHERE unblocked_at IS NULL;

-- Table to track reports (child reporting inappropriate content/behavior)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_child_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  reported_adult_profile_id UUID REFERENCES public.adult_profiles(id) ON DELETE CASCADE,
  reported_child_profile_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  -- Ensure either adult or child is reported, but not both
  CONSTRAINT reports_one_target CHECK (
    (reported_adult_profile_id IS NOT NULL AND reported_child_profile_id IS NULL) OR
    (reported_adult_profile_id IS NULL AND reported_child_profile_id IS NOT NULL)
  ),
  report_type TEXT NOT NULL CHECK (report_type IN ('inappropriate_content', 'harassment', 'bullying', 'threat', 'other')),
  report_message TEXT, -- Optional message from child explaining the report
  -- Related content (message_id, call_id, etc.)
  related_message_id UUID,
  related_call_id UUID,
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by_parent_id UUID REFERENCES public.adult_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_child_id);
CREATE INDEX IF NOT EXISTS idx_reports_adult ON public.reports(reported_adult_profile_id);
CREATE INDEX IF NOT EXISTS idx_reports_child ON public.reports(reported_child_profile_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_pending ON public.reports(status) WHERE status = 'pending';

-- =====================================================
-- STEP 5: Add safety mode settings to families
-- =====================================================

-- Add safety_mode_enabled flag to families table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'families' 
    AND column_name = 'safety_mode_enabled'
  ) THEN
    ALTER TABLE public.families 
    ADD COLUMN safety_mode_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add safety_mode_settings JSONB for flexible configuration
DO $$
BEGIN
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

-- Create index for safety mode queries
CREATE INDEX IF NOT EXISTS idx_families_safety_mode ON public.families(safety_mode_enabled) WHERE safety_mode_enabled = true;

-- =====================================================
-- STEP 6: Enable RLS on new tables
-- =====================================================

ALTER TABLE public.child_family_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: Create RLS policies for child_family_memberships
-- =====================================================

-- Parents can view children in their family
CREATE POLICY "Parents can view child memberships in their family"
  ON public.child_family_memberships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = child_family_memberships.family_id
    )
  );

-- Family members can view children in their family
CREATE POLICY "Family members can view child memberships in their family"
  ON public.child_family_memberships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = child_family_memberships.family_id
    )
  );

-- Parents can manage child memberships in their family
CREATE POLICY "Parents can manage child memberships in their family"
  ON public.child_family_memberships FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = child_family_memberships.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = child_family_memberships.family_id
    )
  );

-- =====================================================
-- STEP 8: Create RLS policies for child_connections
-- =====================================================

-- Parents can view connection requests for children in their family
CREATE POLICY "Parents can view child connections in their family"
  ON public.child_connections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND (
          ap.family_id = child_connections.requester_family_id OR
          ap.family_id = child_connections.target_family_id
        )
    )
  );

-- Parents can create connection requests for children in their family
CREATE POLICY "Parents can create child connection requests"
  ON public.child_connections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = child_connections.requester_family_id
    )
  );

-- Parents can approve/reject connection requests for children in their family
CREATE POLICY "Parents can update child connections in their family"
  ON public.child_connections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND (
          ap.family_id = child_connections.requester_family_id OR
          ap.family_id = child_connections.target_family_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND (
          ap.family_id = child_connections.requester_family_id OR
          ap.family_id = child_connections.target_family_id
        )
    )
  );

-- =====================================================
-- STEP 9: Create RLS policies for blocked_contacts
-- =====================================================

-- Parents can view blocks for children in their family
CREATE POLICY "Parents can view blocked contacts for their children"
  ON public.blocked_contacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = blocked_contacts.blocker_child_id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  );

-- Children can block contacts (handled at application level, but allow inserts)
-- Parents can also block on behalf of children
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
    )
  );

-- Parents can unblock contacts for their children
CREATE POLICY "Parents can unblock contacts for their children"
  ON public.blocked_contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = blocked_contacts.blocker_child_id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = blocked_contacts.blocker_child_id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  );

-- =====================================================
-- STEP 10: Create RLS policies for reports
-- =====================================================

-- Parents can view reports for children in their family
CREATE POLICY "Parents can view reports for their children"
  ON public.reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = reports.reporter_child_id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  );

-- Children can create reports (handled at application level)
-- Parents can also create reports on behalf of children
CREATE POLICY "Parents can create reports for their children"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = reports.reporter_child_id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  );

-- Parents can update reports for their children (review, resolve, etc.)
CREATE POLICY "Parents can update reports for their children"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = reports.reporter_child_id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = reports.reporter_child_id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  );

-- =====================================================
-- STEP 11: Create helper functions
-- =====================================================

-- Function to check if two children can communicate (both parents approved)
CREATE OR REPLACE FUNCTION can_children_communicate(
  p_child1_id UUID,
  p_child2_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_connection RECORD;
BEGIN
  -- Check if there's an approved connection
  SELECT * INTO v_connection
  FROM public.child_connections
  WHERE (
    (requester_child_id = p_child1_id AND target_child_id = p_child2_id) OR
    (requester_child_id = p_child2_id AND target_child_id = p_child1_id)
  )
  AND status = 'approved';
  
  RETURN FOUND;
END;
$$;

-- Function to check if a contact is blocked for a child
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
BEGIN
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

-- Function to get all families a child belongs to
CREATE OR REPLACE FUNCTION get_child_families(p_child_profile_id UUID)
RETURNS TABLE (
  family_id UUID,
  household_type TEXT,
  linked_family_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id as family_id,
    f.household_type,
    f.linked_family_id
  FROM public.child_family_memberships cfm
  JOIN public.families f ON f.id = cfm.family_id
  WHERE cfm.child_profile_id = p_child_profile_id;
END;
$$;

-- =====================================================
-- STEP 12: Create triggers for updated_at timestamps
-- =====================================================

-- Update trigger for child_connections
CREATE TRIGGER update_child_connections_updated_at
  BEFORE UPDATE ON public.child_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();

-- =====================================================
-- STEP 13: Enable realtime for new tables
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.child_family_memberships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.child_connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;

-- =====================================================
-- Migration complete
-- =====================================================
-- Next steps:
-- 1. Update application code to use new family structure models
-- 2. Implement onboarding flow for household type selection
-- 3. Create UI for child-to-child connection requests/approvals
-- 4. Create UI for blocking and reporting
-- 5. Implement safety mode features
-- 6. Update permission checks to use new helper functions
-- 7. Update call and message permissions to check blocks and connections


-- Migration: Enable Child Blocking with Parent Notifications
-- Purpose: Allow authenticated kid users to block family members and notify parents
-- Date: 2025-01-22
-- 
-- This migration:
-- 1. Creates helper functions for child authentication context
-- 2. Adds RLS policies for children to manage their own blocks
-- 3. Creates parent_notifications table
-- 4. Creates trigger to notify parents when children block someone
-- 5. Adds RLS policies for parent notifications

-- =====================================================
-- STEP 1: Ensure RLS is enabled on blocked_contacts
-- =====================================================

ALTER TABLE public.blocked_contacts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Create helper function to get current user's child profile ID
-- =====================================================
-- This function helps identify which child_profile_id corresponds to the current session
-- For authenticated parents, we can't use this directly, but for children we'll use
-- a SECURITY DEFINER function that accepts child_profile_id as parameter

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

-- Revoke execute from anon/authenticated to prevent direct calls
-- This function is only for internal use in RLS policies
REVOKE EXECUTE ON FUNCTION public.current_user_id() FROM anon, authenticated, PUBLIC;

-- =====================================================
-- STEP 3: Create SECURITY DEFINER function for children to insert blocks
-- =====================================================
-- Since children use anonymous auth and don't have auth.uid(), we need a
-- SECURITY DEFINER function that validates the child_profile_id

CREATE OR REPLACE FUNCTION public.block_contact_for_child(
  p_blocker_child_id UUID,
  p_blocked_adult_profile_id UUID DEFAULT NULL,
  p_blocked_child_profile_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_block_id UUID;
  v_child_exists BOOLEAN;
BEGIN
  -- Validate that blocker_child_id exists
  SELECT EXISTS(SELECT 1 FROM public.child_profiles WHERE id = p_blocker_child_id)
  INTO v_child_exists;
  
  IF NOT v_child_exists THEN
    RAISE EXCEPTION 'Invalid child profile ID';
  END IF;
  
  -- Validate that exactly one of blocked_adult_profile_id or blocked_child_profile_id is provided
  IF (p_blocked_adult_profile_id IS NULL AND p_blocked_child_profile_id IS NULL) OR
     (p_blocked_adult_profile_id IS NOT NULL AND p_blocked_child_profile_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Exactly one of blocked_adult_profile_id or blocked_child_profile_id must be provided';
  END IF;
  
  -- Insert the block
  INSERT INTO public.blocked_contacts (
    blocker_child_id,
    blocked_adult_profile_id,
    blocked_child_profile_id,
    blocked_at
  ) VALUES (
    p_blocker_child_id,
    p_blocked_adult_profile_id,
    p_blocked_child_profile_id,
    NOW()
  )
  ON CONFLICT (blocker_child_id, blocked_adult_profile_id, blocked_child_profile_id) 
  DO UPDATE SET
    blocked_at = NOW(),
    unblocked_at = NULL,
    unblocked_by_parent_id = NULL
  RETURNING id INTO v_block_id;
  
  RETURN v_block_id;
END;
$$;

-- Grant execute to anonymous users (children)
GRANT EXECUTE ON FUNCTION public.block_contact_for_child(UUID, UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.block_contact_for_child(UUID, UUID, UUID) TO authenticated;

-- =====================================================
-- STEP 4: Update RLS policies for blocked_contacts
-- =====================================================

-- Drop existing policies that only allow parents (we'll add them back with children support)
DROP POLICY IF EXISTS "Parents can view blocked contacts for their children" ON public.blocked_contacts;
DROP POLICY IF EXISTS "Parents can block contacts for their children" ON public.blocked_contacts;
DROP POLICY IF EXISTS "Parents can unblock contacts for their children" ON public.blocked_contacts;

-- Allow children to select their own blocks (via anonymous role)
-- Note: Application-level validation is still needed to ensure children only see their own blocks
-- since we can't use auth.uid() for anonymous users
CREATE POLICY "Children can select their own blocks"
  ON public.blocked_contacts FOR SELECT
  TO anon, authenticated
  USING (true); -- Application must validate child_profile_id matches session

-- Allow parents to view blocks for children in their family
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

-- Allow parents to insert blocks for their children
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

-- Allow parents to unblock contacts for their children
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

-- Allow children to delete their own blocks (via function or direct if validated)
-- Application-level validation required
CREATE POLICY "Children can delete their own blocks"
  ON public.blocked_contacts FOR DELETE
  TO anon, authenticated
  USING (true); -- Application must validate child_profile_id matches session

-- =====================================================
-- STEP 5: Create parent_notifications table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.parent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL,                 -- references adult_profiles.id (parent)
  child_id UUID NOT NULL,                   -- references child_profiles.id (the kid who blocked someone)
  blocked_id UUID,                          -- references adult_profiles.id or child_profiles.id (the user who was blocked)
  blocked_contact_id UUID REFERENCES public.blocked_contacts(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL DEFAULT 'block' CHECK (notification_type IN ('block', 'report')),
  message TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_parent_notifications_parent_id ON public.parent_notifications(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_child_id ON public.parent_notifications(child_id);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_read_at ON public.parent_notifications(parent_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_parent_notifications_created_at ON public.parent_notifications(created_at DESC);

-- =====================================================
-- STEP 6: Enable RLS on parent_notifications
-- =====================================================

ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: Create RLS policies for parent_notifications
-- =====================================================

-- Parents can select their own notifications
CREATE POLICY "Parents can select their own notifications"
  ON public.parent_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.id = parent_notifications.parent_id
        AND ap.user_id = auth.uid()
        AND ap.role = 'parent'
    )
  );

-- Parents can update their own notifications (e.g., mark as read)
CREATE POLICY "Parents can update their own notifications"
  ON public.parent_notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.id = parent_notifications.parent_id
        AND ap.user_id = auth.uid()
        AND ap.role = 'parent'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.id = parent_notifications.parent_id
        AND ap.user_id = auth.uid()
        AND ap.role = 'parent'
    )
  );

-- Only service role and triggers can insert notifications
-- (No policy needed - service role bypasses RLS)

-- =====================================================
-- STEP 8: Create trigger function to notify parents when child blocks someone
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_parents_on_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_row RECORD;
  child_name TEXT;
  blocked_name TEXT;
  notification_message TEXT;
BEGIN
  -- Get child's name
  SELECT name INTO child_name
  FROM public.child_profiles
  WHERE id = NEW.blocker_child_id;
  
  -- Get blocked contact's name
  IF NEW.blocked_adult_profile_id IS NOT NULL THEN
    SELECT name INTO blocked_name
    FROM public.adult_profiles
    WHERE id = NEW.blocked_adult_profile_id;
  ELSIF NEW.blocked_child_profile_id IS NOT NULL THEN
    SELECT name INTO blocked_name
    FROM public.child_profiles
    WHERE id = NEW.blocked_child_profile_id;
  END IF;
  
  -- Build notification message
  notification_message := format(
    'Your child %s blocked %s',
    COALESCE(child_name, 'your child'),
    COALESCE(blocked_name, 'a contact')
  );
  
  -- For each parent of the blocker, create a notification
  FOR parent_row IN
    SELECT DISTINCT ap.id as parent_profile_id
    FROM public.adult_profiles ap
    JOIN public.child_family_memberships cfm ON cfm.child_profile_id = NEW.blocker_child_id
    WHERE ap.role = 'parent'
      AND ap.family_id = cfm.family_id
  LOOP
    INSERT INTO public.parent_notifications (
      parent_id,
      child_id,
      blocked_id,
      blocked_contact_id,
      notification_type,
      message,
      created_at
    ) VALUES (
      parent_row.parent_profile_id,
      NEW.blocker_child_id,
      COALESCE(NEW.blocked_adult_profile_id, NEW.blocked_child_profile_id),
      NEW.id,
      'block',
      notification_message,
      NOW()
    )
    ON CONFLICT DO NOTHING; -- Prevent duplicate notifications
  END LOOP;
  
  -- Update parent_notified_at timestamp
  UPDATE public.blocked_contacts
  SET parent_notified_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Revoke execute from public (only triggers should call this)
REVOKE EXECUTE ON FUNCTION public.notify_parents_on_block() FROM anon, authenticated, PUBLIC;

-- =====================================================
-- STEP 9: Create trigger on blocked_contacts
-- =====================================================

DROP TRIGGER IF EXISTS trg_notify_parents_on_block ON public.blocked_contacts;

CREATE TRIGGER trg_notify_parents_on_block
  AFTER INSERT ON public.blocked_contacts
  FOR EACH ROW
  WHEN (NEW.unblocked_at IS NULL) -- Only notify for new blocks, not re-blocks
  EXECUTE FUNCTION public.notify_parents_on_block();

-- =====================================================
-- STEP 10: Create helper function for children to get their own blocks
-- =====================================================
-- This function allows children to safely query their own blocks

CREATE OR REPLACE FUNCTION public.get_child_blocks(p_child_profile_id UUID)
RETURNS TABLE (
  id UUID,
  blocker_child_id UUID,
  blocked_adult_profile_id UUID,
  blocked_child_profile_id UUID,
  blocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate child_profile_id exists
  IF NOT EXISTS (SELECT 1 FROM public.child_profiles WHERE id = p_child_profile_id) THEN
    RAISE EXCEPTION 'Invalid child profile ID';
  END IF;
  
  RETURN QUERY
  SELECT 
    bc.id,
    bc.blocker_child_id,
    bc.blocked_adult_profile_id,
    bc.blocked_child_profile_id,
    bc.blocked_at,
    bc.created_at
  FROM public.blocked_contacts bc
  WHERE bc.blocker_child_id = p_child_profile_id
    AND bc.unblocked_at IS NULL
  ORDER BY bc.blocked_at DESC;
END;
$$;

-- Grant execute to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_child_blocks(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_child_blocks(UUID) TO authenticated;

-- =====================================================
-- STEP 11: Create helper function for children to unblock contacts
-- =====================================================

CREATE OR REPLACE FUNCTION public.unblock_contact_for_child(
  p_blocker_child_id UUID,
  p_blocked_contact_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Validate that the block belongs to this child
  UPDATE public.blocked_contacts
  SET unblocked_at = NOW()
  WHERE id = p_blocked_contact_id
    AND blocker_child_id = p_blocker_child_id
    AND unblocked_at IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count > 0;
END;
$$;

-- Grant execute to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.unblock_contact_for_child(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.unblock_contact_for_child(UUID, UUID) TO authenticated;

-- =====================================================
-- STEP 12: Comments and documentation
-- =====================================================

COMMENT ON FUNCTION public.block_contact_for_child IS 
  'Allows children (via anonymous auth) to block contacts. Validates child_profile_id and creates parent notifications.';

COMMENT ON FUNCTION public.get_child_blocks IS 
  'Allows children to safely query their own blocked contacts. Returns only active (non-unblocked) blocks.';

COMMENT ON FUNCTION public.unblock_contact_for_child IS 
  'Allows children to unblock contacts they previously blocked.';

COMMENT ON FUNCTION public.notify_parents_on_block IS 
  'Trigger function that creates parent notifications when a child blocks someone. Runs as SECURITY DEFINER.';

COMMENT ON TABLE public.parent_notifications IS 
  'Stores notifications for parents when their children block contacts or create reports.';









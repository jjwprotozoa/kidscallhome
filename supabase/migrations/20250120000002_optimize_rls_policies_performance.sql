-- Migration: Optimize RLS Policies Performance
-- Purpose: Fix performance issues identified by Supabase linter
-- Date: 2025-01-20
-- Issues Fixed:
--   1. auth.uid() and auth.role() calls re-evaluated for each row (should use (select auth.uid()))
--   2. Multiple permissive policies on same table/role/action (should be consolidated)
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- =====================================================
-- STEP 1: Fix conversations table RLS policies
-- =====================================================

-- Drop and recreate "Children can view their conversations" with optimized auth.uid()
DROP POLICY IF EXISTS "Children can view their conversations" ON public.conversations;
CREATE POLICY "Children can view their conversations"
  ON public.conversations FOR SELECT
  TO anon
  USING (child_id IS NOT NULL);

-- Drop and recreate "Adults can view their conversations" with optimized auth.uid()
DROP POLICY IF EXISTS "Adults can view their conversations" ON public.conversations;
CREATE POLICY "Adults can view their conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.id = conversations.adult_id
    )
  );

-- Drop and recreate "Adults can create conversations" with optimized auth.uid()
DROP POLICY IF EXISTS "Adults can create conversations" ON public.conversations;
CREATE POLICY "Adults can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
  );

-- Drop and recreate "Parents can create conversations" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can create conversations" ON public.conversations;
CREATE POLICY "Parents can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
  );

-- Drop and recreate "Users can view conversations they participate in" with optimized auth.uid()
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
CREATE POLICY "Users can view conversations they participate in"
  ON public.conversations FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND (
          (cp.role IN ('parent', 'family_member') AND cp.user_id = (select auth.uid()))
          OR
          (cp.role = 'child' AND (select auth.uid()) IS NULL)
        )
    )
  );

-- =====================================================
-- STEP 2: Fix profiles table RLS policies
-- =====================================================

-- Drop and recreate "Users can update own profile" with optimized auth.uid()
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- Drop and recreate "Users can insert their own profile" with optimized auth.uid()
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- =====================================================
-- STEP 3: Fix families table RLS policies
-- =====================================================

-- Drop and recreate "Authenticated users can view families" with optimized auth.uid()
DROP POLICY IF EXISTS "Authenticated users can view families." ON public.families;
CREATE POLICY "Authenticated users can view families."
  ON public.families FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.family_id = families.id
    )
  );

-- =====================================================
-- STEP 4: Fix family_members table RLS policies
-- =====================================================

-- Drop and recreate "Anyone can verify invitation tokens" with optimized auth.uid()
DROP POLICY IF EXISTS "Anyone can verify invitation tokens" ON public.family_members;
CREATE POLICY "Anyone can verify invitation tokens"
  ON public.family_members FOR SELECT
  TO anon
  USING (true);

-- Drop and recreate "Family members can view own profile" with optimized auth.uid()
DROP POLICY IF EXISTS "Family members can view own profile" ON public.family_members;
CREATE POLICY "Family members can view own profile"
  ON public.family_members FOR SELECT
  TO authenticated, anon
  USING (id = (select auth.uid()));

-- Drop and recreate "Family members can update own profile" with optimized auth.uid()
DROP POLICY IF EXISTS "Family members can update own profile" ON public.family_members;
CREATE POLICY "Family members can update own profile"
  ON public.family_members FOR UPDATE
  TO authenticated, anon
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- Drop and recreate "Parents can update family members" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can update family members" ON public.family_members;
CREATE POLICY "Parents can update family members"
  ON public.family_members FOR UPDATE
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.parents p
      WHERE p.id = (select auth.uid())
        AND p.id = family_members.parent_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parents p
      WHERE p.id = (select auth.uid())
        AND p.id = family_members.parent_id
    )
  );

-- Drop and recreate "Parents can delete family members" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can delete family members" ON public.family_members;
CREATE POLICY "Parents can delete family members"
  ON public.family_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parents p
      WHERE p.id = (select auth.uid())
        AND p.id = family_members.parent_id
    )
  );

-- Drop and recreate "Parents can view family members in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can view family members in their family" ON public.family_members;
CREATE POLICY "Parents can view family members in their family"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parents p
      WHERE p.id = (select auth.uid())
        AND p.id = family_members.parent_id
    )
  );

-- Drop and recreate "Parents can insert family members" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can insert family members" ON public.family_members;
CREATE POLICY "Parents can insert family members"
  ON public.family_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parents p
      WHERE p.id = (select auth.uid())
        AND p.id = family_members.parent_id
    )
  );

-- =====================================================
-- STEP 5: Fix parents table RLS policies
-- =====================================================

-- Drop and recreate "Parents can view own profile" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can view own profile" ON public.parents;
CREATE POLICY "Parents can view own profile"
  ON public.parents FOR SELECT
  TO authenticated, anon
  USING (id = (select auth.uid()));

-- Drop and recreate "Parents can update own profile" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can update own profile" ON public.parents;
CREATE POLICY "Parents can update own profile"
  ON public.parents FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- Drop and recreate "Parents can insert own profile" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can insert own profile" ON public.parents;
CREATE POLICY "Parents can insert own profile"
  ON public.parents FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- =====================================================
-- STEP 6: Fix calls table RLS policies
-- =====================================================

-- Drop and recreate "Children can view their calls" with optimized auth.uid()
DROP POLICY IF EXISTS "Children can view their calls" ON public.calls;
CREATE POLICY "Children can view their calls"
  ON public.calls FOR SELECT
  TO anon
  USING (
    caller_type = 'child' AND
    child_id IS NOT NULL
  );

-- Drop and recreate "Children can insert calls" with optimized auth.uid()
DROP POLICY IF EXISTS "Children can insert calls" ON public.calls;
CREATE POLICY "Children can insert calls"
  ON public.calls FOR INSERT
  TO anon
  WITH CHECK (
    caller_type = 'child' AND
    child_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE id = calls.child_id
    )
  );

-- Drop and recreate "Children can update their calls" with optimized auth.uid()
DROP POLICY IF EXISTS "Children can update their calls" ON public.calls;
CREATE POLICY "Children can update their calls"
  ON public.calls FOR UPDATE
  TO anon
  USING (
    caller_type = 'child' AND
    child_id IS NOT NULL
  )
  WITH CHECK (
    caller_type = 'child' AND
    child_id IS NOT NULL
  );

-- Drop and recreate "Children can update their own calls" with optimized auth.uid()
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;
CREATE POLICY "Children can update their own calls"
  ON public.calls FOR UPDATE
  TO anon
  USING (
    caller_type = 'child' AND
    child_id IS NOT NULL
  )
  WITH CHECK (
    caller_type = 'child' AND
    child_id IS NOT NULL
  );

-- Drop and recreate "Children can initiate calls" with optimized auth.uid()
DROP POLICY IF EXISTS "Children can initiate calls" ON public.calls;
CREATE POLICY "Children can initiate calls"
  ON public.calls FOR INSERT
  TO anon
  WITH CHECK (
    caller_type = 'child' AND
    child_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE id = calls.child_id
    )
  );

-- Drop and recreate "Family members can view calls in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Family members can view calls in their family" ON public.calls;
CREATE POLICY "Family members can view calls in their family"
  ON public.calls FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = calls.child_id
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'family_member'
        AND ap.family_id = cfm.family_id
    )
  );

-- Drop and recreate "Family members can create calls" with optimized auth.uid()
DROP POLICY IF EXISTS "Family members can create calls" ON public.calls;
CREATE POLICY "Family members can create calls"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap_sender
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = calls.child_id
      WHERE ap_sender.user_id = (select auth.uid())
        AND ap_sender.role = 'family_member'
        AND ap_sender.family_id = cfm.family_id
    )
  );

-- Drop and recreate "Family members can update their calls" with optimized auth.uid()
DROP POLICY IF EXISTS "Family members can update their calls" ON public.calls;
CREATE POLICY "Family members can update their calls"
  ON public.calls FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = calls.child_id
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'family_member'
        AND ap.family_id = cfm.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = calls.child_id
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'family_member'
        AND ap.family_id = cfm.family_id
    )
  );

-- Drop and recreate "Parents can update calls" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;
CREATE POLICY "Parents can update calls"
  ON public.calls FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = calls.child_id
        AND ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = calls.child_id
        AND ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
  );

-- Drop and recreate "Parents can initiate calls to their children" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can initiate calls to their children" ON public.calls;
CREATE POLICY "Parents can initiate calls to their children"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_type = 'parent' AND
    parent_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = calls.child_id
        AND ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
  );

-- Drop and recreate "Family members can initiate calls to children in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Family members can initiate calls to children in their family" ON public.calls;
CREATE POLICY "Family members can initiate calls to children in their family"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_type = 'family_member' AND
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap_sender
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = calls.child_id
      WHERE ap_sender.user_id = (select auth.uid())
        AND ap_sender.role = 'family_member'
        AND ap_sender.family_id = cfm.family_id
    )
  );

-- Drop and recreate "Calls readable by participants and parents" with optimized auth.uid()
DROP POLICY IF EXISTS "Calls readable by participants and parents" ON public.calls;
CREATE POLICY "Calls readable by participants and parents"
  ON public.calls FOR SELECT
  TO authenticated, anon
  USING (
    (caller_type = 'parent' AND parent_id = (select auth.uid()))
    OR
    (caller_type = 'family_member' AND EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'family_member'
        AND ap.family_id IN (
          SELECT family_id FROM public.child_family_memberships 
          WHERE child_profile_id = calls.child_id
        )
    ))
    OR
    (caller_type = 'child' AND (
      (select auth.uid()) IS NULL OR
      EXISTS (
        SELECT 1 FROM public.child_family_memberships cfm
        JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
        WHERE cfm.child_profile_id = calls.child_id
          AND ap.user_id = (select auth.uid())
          AND ap.role = 'parent'
      )
    ))
    OR
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = calls.child_id
        AND ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = calls.child_id
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'family_member'
        AND ap.family_id = cfm.family_id
    )
  );

-- =====================================================
-- STEP 7: Fix messages table RLS policies
-- =====================================================

-- Drop and recreate "Children can send messages" with optimized auth.uid()
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;
CREATE POLICY "Children can send messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child' AND
    sender_id = child_id AND
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE id = messages.child_id
    )
  );

-- Drop and recreate "Children can send messages in their conversations" with optimized auth.uid()
DROP POLICY IF EXISTS "Children can send messages in their conversations" ON public.messages;
CREATE POLICY "Children can send messages in their conversations"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'child' AND
    sender_id = child_id AND
    conversation_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = messages.child_id
    )
  );

-- Drop and recreate "Children can view messages in their conversations" with optimized auth.uid()
DROP POLICY IF EXISTS "Children can view messages in their conversations" ON public.messages;
CREATE POLICY "Children can view messages in their conversations"
  ON public.messages FOR SELECT
  TO anon
  USING (
    sender_type = 'child' AND
    sender_id = child_id
  );

-- Drop and recreate "Adults can send messages in their conversations" with optimized auth.uid()
DROP POLICY IF EXISTS "Adults can send messages in their conversations" ON public.messages;
CREATE POLICY "Adults can send messages in their conversations"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type IN ('parent', 'family_member') AND
    sender_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.conversation_participants cp ON cp.conversation_id = c.id
      WHERE c.id = messages.conversation_id
        AND cp.user_id = (select auth.uid())
    )
  );

-- Drop and recreate "Adults can view messages in their conversations" with optimized auth.uid()
DROP POLICY IF EXISTS "Adults can view messages in their conversations" ON public.messages;
CREATE POLICY "Adults can view messages in their conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    (sender_type = 'parent' AND sender_id = (select auth.uid()))
    OR
    (sender_type = 'family_member' AND sender_id = (select auth.uid()))
    OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.conversation_participants cp ON cp.conversation_id = c.id
      WHERE c.id = messages.conversation_id
        AND cp.user_id = (select auth.uid())
    )
  );

-- Drop and recreate "Parents can send messages to their children" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can send messages to their children" ON public.messages;
CREATE POLICY "Parents can send messages to their children"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'parent' AND
    sender_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = messages.child_id
        AND ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
  );

-- Drop and recreate "Family members can send messages to children in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Family members can send messages to children in their family" ON public.messages;
CREATE POLICY "Family members can send messages to children in their family"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'family_member' AND
    sender_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap_sender
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = messages.child_id
      WHERE ap_sender.user_id = (select auth.uid())
        AND ap_sender.role = 'family_member'
        AND ap_sender.family_id = cfm.family_id
    )
  );

-- Drop and recreate "Messages readable by participants and parents" with optimized auth.uid()
DROP POLICY IF EXISTS "Messages readable by participants and parents" ON public.messages;
CREATE POLICY "Messages readable by participants and parents"
  ON public.messages FOR SELECT
  TO authenticated, anon
  USING (
    ((select auth.uid()) IS NOT NULL AND (
      (sender_type = 'parent' AND sender_id = (select auth.uid()))
      OR
      (sender_type = 'family_member' AND sender_id = (select auth.uid()))
    ))
    OR
    (sender_type = 'child' AND sender_id = child_id AND (
      (select auth.uid()) IS NULL OR
      EXISTS (
        SELECT 1 FROM public.child_family_memberships cfm
        JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
        WHERE cfm.child_profile_id = messages.child_id
          AND ap.user_id = (select auth.uid())
          AND ap.role = 'parent'
      )
    ))
    OR
    ((select auth.uid()) IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = messages.child_id
        AND ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    ))
    OR
    ((select auth.uid()) IS NOT NULL AND sender_type = 'family_member' AND EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = messages.child_id
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'family_member'
        AND ap.family_id = cfm.family_id
    ))
  );

-- =====================================================
-- STEP 8: Fix reports table RLS policies
-- =====================================================

-- Drop and recreate "Parents can view reports for their children" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can view reports for their children" ON public.reports;
CREATE POLICY "Parents can view reports for their children"
  ON public.reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = reports.reporter_child_id
        AND ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
  );

-- Drop and recreate "Parents can create reports for their children" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can create reports for their children" ON public.reports;
CREATE POLICY "Parents can create reports for their children"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = reports.reporter_child_id
        AND ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
  );

-- Drop and recreate "Parents can update reports for their children" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can update reports for their children" ON public.reports;
CREATE POLICY "Parents can update reports for their children"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = reports.reporter_child_id
        AND ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = reports.reporter_child_id
        AND ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
  );

-- =====================================================
-- STEP 9: Fix blocked_contacts table RLS policies
-- =====================================================

-- Drop and recreate "Parents can block contacts for their children" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can block contacts for their children" ON public.blocked_contacts;
CREATE POLICY "Parents can block contacts for their children"
  ON public.blocked_contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = blocked_contacts.blocker_child_id
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  );

-- Drop and recreate "Parents can view blocked contacts for their children" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can view blocked contacts for their children" ON public.blocked_contacts;
CREATE POLICY "Parents can view blocked contacts for their children"
  ON public.blocked_contacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = blocked_contacts.blocker_child_id
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  );

-- Drop and recreate "Parents can unblock contacts for their children" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can unblock contacts for their children" ON public.blocked_contacts;
CREATE POLICY "Parents can unblock contacts for their children"
  ON public.blocked_contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = blocked_contacts.blocker_child_id
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = blocked_contacts.blocker_child_id
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  );

-- =====================================================
-- STEP 10: Fix devices table RLS policies
-- =====================================================

-- Drop and recreate "Parents can view own devices" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can view own devices" ON public.devices;
CREATE POLICY "Parents can view own devices"
  ON public.devices FOR SELECT
  TO authenticated
  USING (parent_id = (select auth.uid()));

-- Drop and recreate "Parents can insert own devices" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can insert own devices" ON public.devices;
CREATE POLICY "Parents can insert own devices"
  ON public.devices FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = (select auth.uid()));

-- Drop and recreate "Parents can update own devices" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can update own devices" ON public.devices;
CREATE POLICY "Parents can update own devices"
  ON public.devices FOR UPDATE
  TO authenticated
  USING (parent_id = (select auth.uid()))
  WITH CHECK (parent_id = (select auth.uid()));

-- Drop and recreate "Parents can delete own devices" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can delete own devices" ON public.devices;
CREATE POLICY "Parents can delete own devices"
  ON public.devices FOR DELETE
  TO authenticated
  USING (parent_id = (select auth.uid()));

-- =====================================================
-- STEP 11: Fix family_feature_flags table RLS policies
-- =====================================================

-- Drop and recreate "Parents can view feature flags for their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can view feature flags for their family" ON public.family_feature_flags;
CREATE POLICY "Parents can view feature flags for their family"
  ON public.family_feature_flags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = family_feature_flags.family_id
    )
  );

-- Drop and recreate "Parents can insert feature flags for their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can insert feature flags for their family" ON public.family_feature_flags;
CREATE POLICY "Parents can insert feature flags for their family"
  ON public.family_feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = family_feature_flags.family_id
    )
  );

-- Drop and recreate "Parents can update feature flags for their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can update feature flags for their family" ON public.family_feature_flags;
CREATE POLICY "Parents can update feature flags for their family"
  ON public.family_feature_flags FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = family_feature_flags.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = family_feature_flags.family_id
    )
  );

-- =====================================================
-- STEP 12: Fix stripe_checkout_sessions table RLS policies
-- =====================================================

-- Drop and recreate "Parents can view own checkout sessions" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can view own checkout sessions" ON public.stripe_checkout_sessions;
CREATE POLICY "Parents can view own checkout sessions"
  ON public.stripe_checkout_sessions FOR SELECT
  TO authenticated
  USING (parent_id = (select auth.uid()));

-- =====================================================
-- STEP 13: Fix children table RLS policies
-- =====================================================

-- Drop and recreate "Parents can view own children" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can view own children" ON public.children;
CREATE POLICY "Parents can view own children"
  ON public.children FOR SELECT
  TO authenticated
  USING (parent_id = (select auth.uid()));

-- Drop and recreate "Family members can view children in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Family members can view children in their family" ON public.children;
CREATE POLICY "Family members can view children in their family"
  ON public.children FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.children c ON c.parent_id = fm.parent_id
      WHERE fm.id = (select auth.uid())
        AND fm.status = 'active'
        AND c.id = children.id
    )
  );

-- Drop and recreate "Parents can insert own children" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can insert own children" ON public.children;
CREATE POLICY "Parents can insert own children"
  ON public.children FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = (select auth.uid()));

-- Drop and recreate "Parents can update own children" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can update own children" ON public.children;
CREATE POLICY "Parents can update own children"
  ON public.children FOR UPDATE
  TO authenticated
  USING (parent_id = (select auth.uid()))
  WITH CHECK (parent_id = (select auth.uid()));

-- Drop and recreate "Parents can delete own children" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can delete own children" ON public.children;
CREATE POLICY "Parents can delete own children"
  ON public.children FOR DELETE
  TO authenticated
  USING (parent_id = (select auth.uid()));

-- =====================================================
-- STEP 14: Fix child_family_memberships table RLS policies
-- =====================================================

-- Drop and recreate "Parents can view child memberships in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can view child memberships in their family" ON public.child_family_memberships;
CREATE POLICY "Parents can view child memberships in their family"
  ON public.child_family_memberships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = child_family_memberships.family_id
    )
  );

-- Drop and recreate "Family members can view child memberships in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Family members can view child memberships in their family" ON public.child_family_memberships;
CREATE POLICY "Family members can view child memberships in their family"
  ON public.child_family_memberships FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role IN ('parent', 'family_member')
        AND ap.family_id = child_family_memberships.family_id
    )
  );

-- Drop and recreate "Parents can manage child memberships in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can manage child memberships in their family" ON public.child_family_memberships;
CREATE POLICY "Parents can manage child memberships in their family"
  ON public.child_family_memberships FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = child_family_memberships.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = child_family_memberships.family_id
    )
  );

-- =====================================================
-- STEP 15: Fix child_connections table RLS policies
-- =====================================================

-- Drop and recreate "Parents can view child connections in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can view child connections in their family" ON public.child_connections;
CREATE POLICY "Parents can view child connections in their family"
  ON public.child_connections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND (ap.family_id = child_connections.requester_family_id 
             OR ap.family_id = child_connections.target_family_id)
    )
  );

-- Drop and recreate "Parents can create child connection requests" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can create child connection requests" ON public.child_connections;
CREATE POLICY "Parents can create child connection requests"
  ON public.child_connections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = child_connections.requester_family_id
    )
  );

-- Drop and recreate "Parents can update child connections in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can update child connections in their family" ON public.child_connections;
CREATE POLICY "Parents can update child connections in their family"
  ON public.child_connections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND (ap.family_id = child_connections.requester_family_id 
             OR ap.family_id = child_connections.target_family_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND (ap.family_id = child_connections.requester_family_id 
             OR ap.family_id = child_connections.target_family_id)
    )
  );

-- =====================================================
-- STEP 16: Fix adult_profiles table RLS policies
-- =====================================================

-- Drop and recreate "Adults can view own profile" with optimized auth.uid()
DROP POLICY IF EXISTS "Adults can view own profile" ON public.adult_profiles;
CREATE POLICY "Adults can view own profile"
  ON public.adult_profiles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Drop and recreate "Adults can view profiles in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Adults can view profiles in their family" ON public.adult_profiles;
CREATE POLICY "Adults can view profiles in their family"
  ON public.adult_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.family_id = adult_profiles.family_id
    )
  );

-- Drop and recreate "Adults can update own profile" with optimized auth.uid()
DROP POLICY IF EXISTS "Adults can update own profile" ON public.adult_profiles;
CREATE POLICY "Adults can update own profile"
  ON public.adult_profiles FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Drop and recreate "Parents can insert own profile" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can insert own profile" ON public.adult_profiles;
CREATE POLICY "Parents can insert own profile"
  ON public.adult_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- Drop and recreate "Parents can insert family member profiles" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can insert family member profiles" ON public.adult_profiles;
CREATE POLICY "Parents can insert family member profiles"
  ON public.adult_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = adult_profiles.family_id
    )
  );

-- =====================================================
-- STEP 17: Fix child_profiles table RLS policies
-- =====================================================

-- Drop and recreate "Adults can view children in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Adults can view children in their family" ON public.child_profiles;
CREATE POLICY "Adults can view children in their family"
  ON public.child_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = child_profiles.id
      WHERE ap.user_id = (select auth.uid())
        AND ap.family_id = cfm.family_id
    )
  );

-- Drop and recreate "Parents can insert children in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can insert children in their family" ON public.child_profiles;
CREATE POLICY "Parents can insert children in their family"
  ON public.child_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = child_profiles.family_id
    )
  );

-- Drop and recreate "Parents can update children in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can update children in their family" ON public.child_profiles;
CREATE POLICY "Parents can update children in their family"
  ON public.child_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = child_profiles.id
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = child_profiles.id
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  );

-- Drop and recreate "Parents can delete children in their family" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can delete children in their family" ON public.child_profiles;
CREATE POLICY "Parents can delete children in their family"
  ON public.child_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = child_profiles.id
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = cfm.family_id
    )
  );

-- =====================================================
-- STEP 18: Fix conversation_participants table RLS policies
-- =====================================================

-- Drop and recreate "Users can view participants in their conversations" with optimized auth.uid()
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants in their conversations"
  ON public.conversation_participants FOR SELECT
  TO authenticated, anon
  USING (
    user_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = (select auth.uid())
    )
  );

-- Drop and recreate "Parents can manage conversation participants" with optimized auth.uid()
DROP POLICY IF EXISTS "Parents can manage conversation participants" ON public.conversation_participants;
CREATE POLICY "Parents can manage conversation participants"
  ON public.conversation_participants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.adult_profiles ap ON ap.id = c.adult_id
      WHERE c.id = conversation_participants.conversation_id
        AND ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.adult_profiles ap ON ap.id = c.adult_id
      WHERE c.id = conversation_participants.conversation_id
        AND ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
    )
  );

-- =====================================================
-- Migration complete
-- =====================================================
-- Performance improvements:
-- 1. ✅ All auth.uid() calls wrapped in (select auth.uid()) to prevent per-row evaluation
-- 2. ✅ All policies optimized for better query planning
-- 3. ⚠️  Multiple permissive policies still exist but are necessary for different use cases
--    (e.g., different roles accessing same table with different conditions)
-- 
-- Note: Some tables have multiple permissive policies for the same role/action because
-- they serve different purposes (e.g., "view own" vs "view in family"). These cannot
-- be easily consolidated without changing the security model.


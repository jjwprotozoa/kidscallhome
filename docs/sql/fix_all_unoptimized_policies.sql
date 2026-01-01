-- Fix All Unoptimized Policies
-- This script optimizes all policies that still use auth.uid() directly
-- Run this after the consolidation migration

-- =====================================================
-- Fix adult_profiles policies
-- =====================================================

DROP POLICY IF EXISTS "Adults can view own profile and family profiles" ON public.adult_profiles;
CREATE POLICY "Adults can view own profile and family profiles"
  ON public.adult_profiles FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.family_id = adult_profiles.family_id
    )
  );

DROP POLICY IF EXISTS "Adults can update own profile" ON public.adult_profiles;
CREATE POLICY "Adults can update own profile"
  ON public.adult_profiles FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can insert own profile and family member profiles" ON public.adult_profiles;
CREATE POLICY "Parents can insert own profile and family member profiles"
  ON public.adult_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role = 'parent'
        AND ap.family_id = adult_profiles.family_id
    )
  );

-- =====================================================
-- Fix blocked_contacts policies
-- =====================================================

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
-- Fix calls policies (already created by consolidation, just re-optimize)
-- =====================================================

DROP POLICY IF EXISTS "Adults can initiate calls to children in their family" ON public.calls;
CREATE POLICY "Adults can initiate calls to children in their family"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_type IN ('parent', 'family_member') AND
    (
      (caller_type = 'parent' AND parent_id = (select auth.uid()) AND
       EXISTS (
         SELECT 1 FROM public.child_family_memberships cfm
         JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
         WHERE cfm.child_profile_id = calls.child_id
           AND ap.user_id = (select auth.uid())
           AND ap.role = 'parent'
       ))
      OR
      (caller_type = 'family_member' AND
       EXISTS (
         SELECT 1 FROM public.adult_profiles ap_sender
         JOIN public.child_family_memberships cfm ON cfm.child_profile_id = calls.child_id
         WHERE ap_sender.user_id = (select auth.uid())
           AND ap_sender.role = 'family_member'
           AND ap_sender.family_id = cfm.family_id
       ))
    )
  );

DROP POLICY IF EXISTS "Adults can update calls for children in their family" ON public.calls;
CREATE POLICY "Adults can update calls for children in their family"
  ON public.calls FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = calls.child_id
        AND ap.user_id = (select auth.uid())
        AND ap.role IN ('parent', 'family_member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = calls.child_id
        AND ap.user_id = (select auth.uid())
        AND ap.role IN ('parent', 'family_member')
    )
  );

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
-- Fix child_connections policies
-- =====================================================

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
-- Fix child_family_memberships policies
-- =====================================================

DROP POLICY IF EXISTS "Parents and family members can manage child memberships in their family" ON public.child_family_memberships;
CREATE POLICY "Parents and family members can manage child memberships in their family"
  ON public.child_family_memberships FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role IN ('parent', 'family_member')
        AND ap.family_id = child_family_memberships.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = (select auth.uid())
        AND ap.role IN ('parent', 'family_member')
        AND ap.family_id = child_family_memberships.family_id
    )
  );

-- =====================================================
-- Fix child_profiles policies
-- =====================================================

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
-- Fix children policies
-- =====================================================

DROP POLICY IF EXISTS "Parents and family members can view children in their family" ON public.children;
CREATE POLICY "Parents and family members can view children in their family"
  ON public.children FOR SELECT
  TO authenticated
  USING (
    parent_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.children c ON c.parent_id = fm.parent_id
      WHERE fm.id = (select auth.uid())
        AND fm.status = 'active'
        AND c.id = children.id
    )
  );

DROP POLICY IF EXISTS "Parents can insert own children" ON public.children;
CREATE POLICY "Parents can insert own children"
  ON public.children FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can update own children" ON public.children;
CREATE POLICY "Parents can update own children"
  ON public.children FOR UPDATE
  TO authenticated
  USING (parent_id = (select auth.uid()))
  WITH CHECK (parent_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can delete own children" ON public.children;
CREATE POLICY "Parents can delete own children"
  ON public.children FOR DELETE
  TO authenticated
  USING (parent_id = (select auth.uid()));

-- =====================================================
-- Fix conversation_participants policies
-- =====================================================

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
-- Fix conversations policies
-- =====================================================

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
-- Fix devices policies
-- =====================================================

DROP POLICY IF EXISTS "Parents can view own devices" ON public.devices;
CREATE POLICY "Parents can view own devices"
  ON public.devices FOR SELECT
  TO authenticated
  USING (parent_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can insert own devices" ON public.devices;
CREATE POLICY "Parents can insert own devices"
  ON public.devices FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can update own devices" ON public.devices;
CREATE POLICY "Parents can update own devices"
  ON public.devices FOR UPDATE
  TO authenticated
  USING (parent_id = (select auth.uid()))
  WITH CHECK (parent_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can delete own devices" ON public.devices;
CREATE POLICY "Parents can delete own devices"
  ON public.devices FOR DELETE
  TO authenticated
  USING (parent_id = (select auth.uid()));

-- =====================================================
-- Fix families policies
-- =====================================================

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
-- Fix family_feature_flags policies
-- =====================================================

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
-- Fix family_members policies
-- =====================================================

DROP POLICY IF EXISTS "Family members and parents can update family members" ON public.family_members;
CREATE POLICY "Family members and parents can update family members"
  ON public.family_members FOR UPDATE
  TO authenticated, anon
  USING (
    id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.parents p
      WHERE p.id = (select auth.uid())
        AND p.id = family_members.parent_id
    )
  )
  WITH CHECK (
    id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.parents p
      WHERE p.id = (select auth.uid())
        AND p.id = family_members.parent_id
    )
  );

DROP POLICY IF EXISTS "Family members can view own profile and anyone can verify tokens" ON public.family_members;
CREATE POLICY "Family members can view own profile and anyone can verify tokens"
  ON public.family_members FOR SELECT
  TO authenticated, anon
  USING (
    id = (select auth.uid())
    OR
    true
  );

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

-- =====================================================
-- Fix messages policies
-- =====================================================

DROP POLICY IF EXISTS "Adults can send messages to children in their family" ON public.messages;
CREATE POLICY "Adults can send messages to children in their family"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type IN ('parent', 'family_member') AND
    sender_id = (select auth.uid()) AND
    (
      (messages.conversation_id IS NOT NULL AND
       EXISTS (
         SELECT 1 FROM public.conversations c
         JOIN public.conversation_participants cp ON cp.conversation_id = c.id
         WHERE c.id = messages.conversation_id
           AND cp.user_id = (select auth.uid())
       ))
      OR
      (sender_type = 'parent' AND
       EXISTS (
         SELECT 1 FROM public.child_family_memberships cfm
         JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
         WHERE cfm.child_profile_id = messages.child_id
           AND ap.user_id = (select auth.uid())
           AND ap.role = 'parent'
       ))
      OR
      (sender_type = 'family_member' AND
       EXISTS (
         SELECT 1 FROM public.adult_profiles ap_sender
         JOIN public.child_family_memberships cfm ON cfm.child_profile_id = messages.child_id
         WHERE ap_sender.user_id = (select auth.uid())
           AND ap_sender.role = 'family_member'
           AND ap_sender.family_id = cfm.family_id
       ))
    )
  );

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
-- Fix parents policies
-- =====================================================

DROP POLICY IF EXISTS "Parents can view own profile and children can view parent names" ON public.parents;
CREATE POLICY "Parents can view own profile and children can view parent names"
  ON public.parents FOR SELECT
  TO authenticated, anon
  USING (
    id = (select auth.uid())
    OR
    true
  );

DROP POLICY IF EXISTS "Parents can update own profile" ON public.parents;
CREATE POLICY "Parents can update own profile"
  ON public.parents FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can insert own profile" ON public.parents;
CREATE POLICY "Parents can insert own profile"
  ON public.parents FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- =====================================================
-- Fix profiles policies
-- =====================================================

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- =====================================================
-- Fix reports policies
-- =====================================================

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
-- Fix stripe_checkout_sessions policies
-- =====================================================

DROP POLICY IF EXISTS "Parents can view own checkout sessions" ON public.stripe_checkout_sessions;
CREATE POLICY "Parents can view own checkout sessions"
  ON public.stripe_checkout_sessions FOR SELECT
  TO authenticated
  USING (parent_id = (select auth.uid()));


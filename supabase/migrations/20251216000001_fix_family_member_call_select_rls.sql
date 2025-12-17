-- Migration: Fix Family Member Call SELECT RLS Policy
-- Purpose: Allow family members to SELECT calls where they are the recipient (family_member_id matches)
-- Date: 2025-12-16
-- 
-- Issue: Family members cannot receive child-initiated calls via Realtime subscriptions
-- Root Cause: RLS policy only checks caller_type = 'family_member', but child-initiated calls have caller_type = 'child'
--             Need to also allow SELECT when family_member_id = auth.uid() regardless of caller_type

-- =====================================================
-- STEP 1: Update "Calls readable by participants and parents" policy
-- =====================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Calls readable by participants and parents" ON public.calls;

-- Create updated policy that allows family members to SELECT calls where they are recipients
CREATE POLICY "Calls readable by participants and parents"
  ON public.calls FOR SELECT
  TO authenticated, anon
  USING (
    -- Parent caller can see their own calls
    (caller_type = 'parent' AND parent_id = auth.uid())
    OR
    -- Family member caller can see their own calls (when they initiated)
    (caller_type = 'family_member' AND EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'family_member'
        AND ap.family_id IN (
          SELECT family_id FROM public.child_family_memberships 
          WHERE child_profile_id = calls.child_id
        )
    ))
    OR
    -- CRITICAL FIX: Family member can see calls where they are the recipient
    -- This handles child-initiated calls where family_member_id is set
    (family_member_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'family_member'
    ))
    OR
    -- Also support legacy family_members table for old system
    (family_member_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.id = auth.uid()
        AND fm.status = 'active'
    ))
    OR
    -- Child caller can see their own calls (child_id matches)
    -- For anon users, this is handled at app level via child session
    -- For authenticated users, verify they are the child's parent
    (caller_type = 'child' AND (
      auth.uid() IS NULL OR
      EXISTS (
        SELECT 1 FROM public.child_family_memberships cfm
        JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
        WHERE cfm.child_profile_id = calls.child_id
          AND ap.user_id = auth.uid()
          AND ap.role = 'parent'
      )
    ))
    OR
    -- Parents can see calls for their own children (oversight)
    EXISTS (
      SELECT 1 FROM public.child_family_memberships cfm
      JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
      WHERE cfm.child_profile_id = calls.child_id
        AND ap.user_id = auth.uid()
        AND ap.role = 'parent'
    )
    OR
    -- Legacy: Parents can see calls via children.parent_id (old system)
    EXISTS (
      SELECT 1 FROM public.children c
      JOIN public.adult_profiles ap ON ap.user_id = c.parent_id
      WHERE c.id = calls.child_id
        AND ap.user_id = auth.uid()
        AND ap.role = 'parent'
    )
    OR
    -- Legacy: Family members can see calls via family_members and children (old system)
    EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.children c ON c.parent_id = fm.parent_id
      WHERE fm.id = auth.uid()
        AND fm.status = 'active'
        AND c.id = calls.child_id
    )
  );

-- =====================================================
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ Family members can now SELECT calls where family_member_id = auth.uid()
-- 2. ✅ This allows Realtime subscriptions to receive INSERT events for child-initiated calls
-- 3. ✅ Supports both new (adult_profiles) and old (family_members) systems
-- 
-- To verify:
-- 1. Log in as a family member
-- 2. Have a child initiate a call to that family member
-- 3. Family member should receive the INSERT event via Realtime subscription
-- 4. Family member should be able to SELECT the call record


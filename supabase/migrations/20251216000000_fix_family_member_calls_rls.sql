-- Migration: Fix Family Member Calls RLS Policy
-- Purpose: Allow family members to create calls using both old (children) and new (child_profiles) systems
-- Date: 2025-12-16
-- 
-- Issue: Family members get 403 errors when trying to create calls
-- Root Cause: RLS policy checks child_family_memberships.child_profile_id but code uses children.id
--             Need to support both old children table and new child_profiles/child_family_memberships system

-- =====================================================
-- STEP 1: Update family member calls INSERT policy to support both systems
-- =====================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Family members can initiate calls to children in their family" ON public.calls;

-- Create updated policy that supports both old and new systems
-- This policy mirrors the parent call policy but for family members
-- Simplified to match parent call pattern - permission checks happen in can_users_communicate function
CREATE POLICY "Family members can initiate calls to children in their family"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_type = 'family_member' AND
    family_member_id = auth.uid() AND
    (
      -- OLD SYSTEM: Check via family_members and children tables (legacy)
      -- This matches how parent calls work - simple ownership check
      EXISTS (
        SELECT 1 FROM public.family_members fm
        JOIN public.children c ON c.parent_id = fm.parent_id
        WHERE fm.id = auth.uid()
          AND fm.status = 'active'
          AND c.id = calls.child_id
      )
      OR
      -- NEW SYSTEM: Check via adult_profiles
      -- Family member must be in same family as the child's parent
      EXISTS (
        SELECT 1 FROM public.adult_profiles ap_family_member
        WHERE ap_family_member.user_id = auth.uid()
          AND ap_family_member.role = 'family_member'
          AND (
            -- Case 1: calls.child_id is child_profiles.id - check via child_family_memberships
            EXISTS (
              SELECT 1 FROM public.child_family_memberships cfm
              WHERE cfm.child_profile_id = calls.child_id
                AND cfm.family_id = ap_family_member.family_id
            )
            OR
            -- Case 2: calls.child_id is children.id (legacy) - check via children.parent_id -> adult_profiles
            EXISTS (
              SELECT 1 FROM public.children c
              JOIN public.adult_profiles ap_parent ON ap_parent.user_id = c.parent_id
              WHERE c.id = calls.child_id
                AND ap_parent.role = 'parent'
                AND ap_parent.family_id = ap_family_member.family_id
            )
          )
      )
    )
  );

-- =====================================================
-- STEP 2: Update family member children SELECT policy to also check adult_profiles
-- =====================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Family members can view children in their family" ON public.children;

-- Create updated policy that supports both systems
CREATE POLICY "Family members can view children in their family"
  ON public.children FOR SELECT
  TO authenticated
  USING (
    -- OLD SYSTEM: Check via family_members table
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_members.parent_id = children.parent_id
      AND family_members.id = auth.uid()
      AND family_members.status = 'active'
    )
    OR
    -- NEW SYSTEM: Check via adult_profiles and child_family_memberships
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      JOIN public.child_family_memberships cfm ON cfm.child_profile_id = children.id
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'family_member'
        AND ap.family_id = cfm.family_id
    )
  );

-- =====================================================
-- STEP 3: Update family member calls SELECT policy to support both systems
-- =====================================================

-- Update the "Calls readable by participants and parents" policy to support both old and new systems
-- This allows family members to SELECT calls using either system

-- Note: We're not dropping the existing policy here because it might have other important checks
-- Instead, we'll ensure the family member part supports both systems
-- If the policy already exists with only new system support, this will add old system support

-- Check if we need to update the existing policy
-- The policy "Calls readable by participants and parents" should already handle family members
-- but it might only check the new system. We'll add a comment here noting that if family members
-- still can't SELECT calls, we may need to update that policy separately in a future migration.

-- =====================================================
-- STEP 4: Verify policies were created correctly
-- =====================================================

SELECT 
    'Children Table RLS Policies (After Family Member Fix)' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
  AND cmd = 'SELECT'
  AND policyname LIKE '%family%'
ORDER BY policyname;

SELECT 
    'Calls Table RLS Policies (After Family Member Fix)' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls'
  AND cmd = 'INSERT'
  AND policyname LIKE '%family%'
ORDER BY policyname;

-- =====================================================
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ Family members can now INSERT calls using both old (children) and new (child_profiles) systems
-- 2. ✅ Family members can now SELECT children using both systems
-- 3. ✅ Policy checks both family_members.parent_id = children.parent_id (old) 
--        and adult_profiles.family_id = child_family_memberships.family_id (new)
-- 
-- To verify:
-- 1. Log in as a family member (user with both family_members and adult_profiles records)
-- 2. Try to SELECT from children table - should work
-- 3. Try to INSERT into calls table - should work
-- 
-- Note: This policy works alongside existing policies and uses OR logic


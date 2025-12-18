-- Migration: Fix parent view of family members
-- Purpose: Allow parents to see family members they have invited
-- Date: 2025-12-19
-- 
-- Issue: Parents get "Error loading family members" because there's no RLS policy
--        allowing parents to SELECT from family_members where parent_id = their user id
--
-- Current policies on family_members:
--   1. "Anonymous can verify invitation tokens" - USING (true) for anon
--   2. "Family members can view own profile" - USING (id = auth.uid()) for authenticated
--
-- Missing: Policy for parents to view family members they invited

-- =====================================================
-- STEP 1: Add policy for parents to view their family members
-- =====================================================

-- Drop if exists to avoid conflicts
DROP POLICY IF EXISTS "Parents can view their family members" ON public.family_members;

-- Parents can view family members where parent_id matches their user id
CREATE POLICY "Parents can view their family members"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (parent_id = (SELECT auth.uid()));

-- =====================================================
-- STEP 2: Ensure parents can also update/delete family members
-- =====================================================

DROP POLICY IF EXISTS "Parents can update family members" ON public.family_members;
DROP POLICY IF EXISTS "Parents can delete family members" ON public.family_members;
DROP POLICY IF EXISTS "Parents can insert family members" ON public.family_members;

-- Parents can update family members they invited
CREATE POLICY "Parents can update family members"
  ON public.family_members FOR UPDATE
  TO authenticated
  USING (parent_id = (SELECT auth.uid()))
  WITH CHECK (parent_id = (SELECT auth.uid()));

-- Parents can delete family members they invited
CREATE POLICY "Parents can delete family members"
  ON public.family_members FOR DELETE
  TO authenticated
  USING (parent_id = (SELECT auth.uid()));

-- Parents can insert new family members (invitations)
CREATE POLICY "Parents can insert family members"
  ON public.family_members FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = (SELECT auth.uid()));

-- =====================================================
-- Migration complete
-- =====================================================
-- Parents can now:
-- 1. ✅ View family members they have invited (parent_id = auth.uid())
-- 2. ✅ Update family members they have invited
-- 3. ✅ Delete family members they have invited
-- 4. ✅ Insert new family member invitations



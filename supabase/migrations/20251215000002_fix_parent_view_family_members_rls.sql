-- Migration: Fix Parent View Family Members RLS Policy
-- Purpose: Allow parents to view and manage family members under connections
-- Date: 2025-12-15
-- Issue: Parent cannot see family member under connections
-- Root Cause: The consolidated policy removed the "Parents can view family members in their family" policy
--             Only allowing family members to view their own profile and anyone to verify tokens

-- =====================================================
-- STEP 1: Add policy for parents to view their family members
-- =====================================================
-- CRITICAL: This policy was removed during consolidation and needs to be restored
-- Parents need to see all family members where parent_id matches their user ID
-- Since parents.id = auth.users(id), we can directly check parent_id = auth.uid()

CREATE POLICY "Parents can view family members in their family"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (
    -- Direct check: parent_id should equal the authenticated user's ID
    -- Since parents.id references auth.users(id), this is the correct check
    parent_id = (select auth.uid())
  );

-- =====================================================
-- STEP 2: Ensure parents can also manage (insert/update/delete) their family members
-- =====================================================
-- These policies may have been affected by consolidation, so we'll ensure they exist

-- Parents can insert family members (create invitations)
DROP POLICY IF EXISTS "Parents can insert family members" ON public.family_members;
CREATE POLICY "Parents can insert family members"
  ON public.family_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Verify parent_id matches authenticated user
    parent_id = (select auth.uid())
    -- Verify created_by matches authenticated user (if set)
    AND (created_by IS NULL OR created_by = (select auth.uid()))
  );

-- Parents can update family members (approve, suspend, etc.)
-- Note: The consolidated policy "Family members and parents can update family members" exists
-- but we'll ensure it works correctly by simplifying the check
DROP POLICY IF EXISTS "Family members and parents can update family members" ON public.family_members;
CREATE POLICY "Family members and parents can update family members"
  ON public.family_members FOR UPDATE
  TO authenticated
  USING (
    -- Family members can update their own profile
    id = (select auth.uid())
    OR
    -- Parents can update family members in their family
    parent_id = (select auth.uid())
  )
  WITH CHECK (
    -- Family members can update their own profile
    id = (select auth.uid())
    OR
    -- Parents can update family members in their family
    parent_id = (select auth.uid())
  );

-- Parents can delete family members (remove invitations/members)
DROP POLICY IF EXISTS "Parents can delete family members" ON public.family_members;
CREATE POLICY "Parents can delete family members"
  ON public.family_members FOR DELETE
  TO authenticated
  USING (
    -- Verify parent_id matches authenticated user
    parent_id = (select auth.uid())
  );

-- =====================================================
-- STEP 3: Verify policies were created
-- =====================================================
SELECT 
    'Policy Verification' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'family_members'
  AND policyname IN (
    'Parents can view family members in their family',
    'Parents can insert family members',
    'Family members and parents can update family members',
    'Parents can delete family members'
  )
ORDER BY policyname;

-- =====================================================
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ Parents can now view all family members where parent_id = auth.uid()
-- 2. ✅ Parents can insert new family member invitations
-- 3. ✅ Parents can delete family members they've invited
-- 4. ✅ The consolidated policy still allows family members to view their own profile
-- 5. ✅ The consolidated policy still allows anyone to verify invitation tokens


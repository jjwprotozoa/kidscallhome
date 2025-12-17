-- Migration: Fix Family Member View Children RLS Policy
-- Purpose: Restore RLS policy allowing family members to view children in their family
-- Date: 2025-12-15
-- 
-- Issue: Family members cannot see children from their family
-- Root Cause: Migration 20251210000000_fix_parent_view_children_rls.sql removed the
--             "Family members can view children in their family" policy when fixing parent access
--             This migration restores that policy so family members can view children

-- =====================================================
-- STEP 1: Add policy for family members to view children in their family
-- =====================================================
-- CRITICAL: This policy was removed during the parent RLS fix and needs to be restored
-- Family members need to see children where the child's parent_id matches their parent_id
-- This allows family members (grandparents, aunts, uncles, etc.) to see and interact with children

CREATE POLICY "Family members can view children in their family"
  ON public.children FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members
      WHERE family_members.parent_id = children.parent_id
      AND family_members.id = auth.uid()
      AND family_members.status = 'active'
    )
  );

-- =====================================================
-- STEP 2: Verify policy was created correctly
-- =====================================================
SELECT 
    'Children Table RLS Policies (After Family Member Fix)' as info,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN qual IS NULL THEN 'NULL (permissive)'
        ELSE 'HAS USING CLAUSE'
    END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- =====================================================
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ Family members can now SELECT children where parent_id matches their parent_id
-- 2. ✅ Policy checks that family member status is 'active'
-- 3. ✅ Policy uses auth.uid() to ensure only the authenticated family member can view
-- 
-- To verify:
-- 1. Log in as a family member (user with family_members record)
-- 2. Run: SELECT * FROM children WHERE parent_id = (SELECT parent_id FROM family_members WHERE id = auth.uid());
-- 3. Should return all children belonging to the same parent
-- 
-- Note: This policy works alongside "Parents can view own children" policy
-- Both policies use OR logic, so either condition being true allows access





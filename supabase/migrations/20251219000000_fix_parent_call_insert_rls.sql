-- supabase/migrations/20251219000000_fix_parent_call_insert_rls.sql
-- Fix RLS policy to allow parents and family members to create calls
-- CRITICAL: Without this policy, parents get 400 errors when initiating calls

-- ============================================
-- STEP 1: Drop any existing conflicting policies
-- ============================================
DROP POLICY IF EXISTS "Parents can initiate calls to their children" ON public.calls;
DROP POLICY IF EXISTS "Family members can initiate calls to children in their family" ON public.calls;
DROP POLICY IF EXISTS "Adults can initiate calls to children in their family" ON public.calls;

-- ============================================
-- STEP 2: Create INSERT policy for parents (authenticated users)
-- ============================================
-- Allow authenticated parents to create calls to their own children
CREATE POLICY "Parents can initiate calls to their children"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_type = 'parent' AND
    parent_id = auth.uid() AND
    child_id IS NOT NULL AND
    -- Verify parent owns this child via children table
    EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = calls.child_id
        AND c.parent_id = auth.uid()
    )
  );

-- ============================================
-- STEP 3: Create INSERT policy for family members (authenticated users)
-- ============================================
-- Allow authenticated family members to create calls to children in their family
CREATE POLICY "Family members can initiate calls to children in their family"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_type = 'family_member' AND
    family_member_id = auth.uid() AND
    child_id IS NOT NULL AND
    -- Verify family member has access to this child via family_members table
    EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.children c ON c.parent_id = fm.parent_id
      WHERE fm.id = auth.uid()
        AND c.id = calls.child_id
    )
  );

-- ============================================
-- STEP 4: Ensure SELECT policy exists for parents
-- ============================================
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;

CREATE POLICY "Parents can view calls for their children"
  ON public.calls FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid()
  );

-- ============================================
-- STEP 5: Ensure SELECT policy exists for family members
-- ============================================
DROP POLICY IF EXISTS "Family members can view calls to children in their family" ON public.calls;

CREATE POLICY "Family members can view calls to children in their family"
  ON public.calls FOR SELECT
  TO authenticated
  USING (
    family_member_id = auth.uid()
  );

-- ============================================
-- STEP 6: Ensure UPDATE policy exists for parents
-- ============================================
DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;

CREATE POLICY "Parents can update calls"
  ON public.calls FOR UPDATE
  TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- ============================================
-- STEP 7: Ensure UPDATE policy exists for family members
-- ============================================
DROP POLICY IF EXISTS "Family members can update calls" ON public.calls;

CREATE POLICY "Family members can update calls"
  ON public.calls FOR UPDATE
  TO authenticated
  USING (family_member_id = auth.uid())
  WITH CHECK (family_member_id = auth.uid());

-- ============================================
-- Verification
-- ============================================
COMMENT ON POLICY "Parents can initiate calls to their children" ON public.calls IS 
'Allows authenticated parents to create calls to their children. Required for parent-to-child video calls.';

COMMENT ON POLICY "Family members can initiate calls to children in their family" ON public.calls IS 
'Allows authenticated family members to create calls to children they have access to.';


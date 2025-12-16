-- supabase/migrations/20251212000000_fix_parent_call_rls.sql
-- Fix RLS policies for parent-initiated calls
-- Ensures parents can create calls to their children

-- ============================================
-- STEP 1: Drop existing parent call policies to recreate them
-- ============================================
DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can initiate calls to their children" ON public.calls;

-- ============================================
-- STEP 2: Create parent INSERT policy
-- ============================================
-- Parent can INSERT calls to their own children (with permission check)
-- This policy allows authenticated parents to create calls where:
-- 1. caller_type = 'parent'
-- 2. parent_id matches auth.uid()
-- 3. The child belongs to the parent (supports both old and new schema)
-- 4. Communication is allowed (not blocked, etc.)
CREATE POLICY "Parents can initiate calls to their children"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_type = 'parent' AND
    parent_id = auth.uid() AND
    -- Verify parent owns this child
    -- Support both new schema (child_family_memberships + adult_profiles) and old schema (children table)
    (
      -- New schema: Check via child_family_memberships and adult_profiles
      EXISTS (
        SELECT 1 FROM public.child_family_memberships cfm
        JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
        WHERE cfm.child_profile_id = calls.child_id
          AND ap.user_id = auth.uid()
          AND ap.role = 'parent'
      )
      OR
      -- Fallback: Old schema - check via children table (for backward compatibility)
      EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = calls.child_id
          AND c.parent_id = auth.uid()
      )
    ) AND
    -- CRITICAL: Check communication permission (blocks, etc.)
    -- Note: If can_users_communicate function doesn't exist or fails, 
    -- the policy will fail. Ensure the function is properly created.
    can_users_communicate(
      p_sender_id := auth.uid(),
      p_sender_type := 'parent',
      p_receiver_id := calls.child_id,
      p_receiver_type := 'child'
    )
  );

-- ============================================
-- STEP 3: Ensure parent SELECT policy exists for viewing calls
-- ============================================
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;
DROP POLICY IF EXISTS "Calls readable by participants and parents" ON public.calls;

-- Parents can view calls where they are the parent_id
CREATE POLICY "Parents can view calls for their children"
  ON public.calls FOR SELECT
  TO authenticated
  USING (
    -- Parent can see calls where they are the parent_id
    parent_id = auth.uid()
    -- Also verify the child belongs to this parent (security check)
    -- Support both new and old schema
    AND (
      EXISTS (
        SELECT 1 FROM public.child_family_memberships cfm
        JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
        WHERE cfm.child_profile_id = calls.child_id
          AND ap.user_id = auth.uid()
          AND ap.role = 'parent'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = calls.child_id
          AND c.parent_id = auth.uid()
      )
    )
  );

-- ============================================
-- STEP 4: Ensure parent UPDATE policy exists
-- ============================================
DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;

-- Parents can update calls where they are the parent_id
CREATE POLICY "Parents can update calls"
  ON public.calls FOR UPDATE
  TO authenticated
  USING (
    -- Parent can update calls where they are the parent_id
    parent_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.child_family_memberships cfm
        JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
        WHERE cfm.child_profile_id = calls.child_id
          AND ap.user_id = auth.uid()
          AND ap.role = 'parent'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = calls.child_id
          AND c.parent_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    -- Ensure parent_id can't be changed
    parent_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.child_family_memberships cfm
        JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
        WHERE cfm.child_profile_id = calls.child_id
          AND ap.user_id = auth.uid()
          AND ap.role = 'parent'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = calls.child_id
          AND c.parent_id = auth.uid()
      )
    )
  );

-- ============================================
-- STEP 5: Verify can_users_communicate function exists and works
-- ============================================
-- The function should already exist from previous migrations
-- This is just a comment to ensure it's available

COMMENT ON POLICY "Parents can initiate calls to their children" ON public.calls IS 
'Allows authenticated parents to create calls to their own children. 
Requires: caller_type=parent, parent_id=auth.uid(), child belongs to parent via child_family_memberships, and can_users_communicate returns true.';


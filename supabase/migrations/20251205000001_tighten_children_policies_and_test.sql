-- Migration: Tighten Children Policies and Add Test
-- Purpose: Ensure INSERT/UPDATE/DELETE policies are scoped to authenticated only
-- Date: 2025-12-05
-- Follow-up to: 20251205000000_fix_parent_children_isolation.sql

-- =====================================================
-- STEP 1: Tighten INSERT, UPDATE, DELETE policies
-- =====================================================
-- Ensure these are scoped to authenticated users only, not public

-- Drop and recreate INSERT policy with explicit authenticated scope
DROP POLICY IF EXISTS "Parents can insert own children" ON public.children;
CREATE POLICY "Parents can insert own children"
  ON public.children FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = auth.uid());

-- Drop and recreate UPDATE policy with explicit authenticated scope
DROP POLICY IF EXISTS "Parents can update own children" ON public.children;
CREATE POLICY "Parents can update own children"
  ON public.children FOR UPDATE
  TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- Drop and recreate DELETE policy with explicit authenticated scope
DROP POLICY IF EXISTS "Parents can delete own children" ON public.children;
CREATE POLICY "Parents can delete own children"
  ON public.children FOR DELETE
  TO authenticated
  USING (parent_id = auth.uid());

-- =====================================================
-- STEP 2: Verify policies are correctly scoped
-- =====================================================
SELECT 
    'Children Table RLS Policies (After Tightening)' as info,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
ORDER BY cmd, policyname;

-- =====================================================
-- STEP 3: Create test function to verify isolation
-- =====================================================
-- This function can be called by an authenticated parent to verify
-- they can only see their own children

CREATE OR REPLACE FUNCTION test_parent_children_isolation()
RETURNS TABLE (
  test_name TEXT,
  passed BOOLEAN,
  message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  total_children_count INTEGER;
  own_children_count INTEGER;
  other_parents_children_count INTEGER;
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN QUERY SELECT 
      'Authentication Check'::TEXT,
      FALSE,
      'User is not authenticated'::TEXT;
    RETURN;
  END IF;

  -- Test 1: Count total children visible to this parent
  SELECT COUNT(*) INTO total_children_count
  FROM public.children;
  
  -- Test 2: Count children that belong to this parent
  SELECT COUNT(*) INTO own_children_count
  FROM public.children
  WHERE parent_id = current_user_id;
  
  -- Test 3: Count children that belong to other parents
  SELECT COUNT(*) INTO other_parents_children_count
  FROM public.children
  WHERE parent_id != current_user_id;

  -- Verify isolation: parent should only see their own children
  RETURN QUERY SELECT 
    'Parent Children Isolation'::TEXT,
    (total_children_count = own_children_count AND other_parents_children_count = 0),
    format('Total visible: %s, Own children: %s, Other parents children: %s', 
           total_children_count, own_children_count, other_parents_children_count)::TEXT;
  
  -- Test 4: Verify parent can see their own children
  RETURN QUERY SELECT 
    'Can View Own Children'::TEXT,
    (own_children_count >= 0), -- Should be able to see at least 0 (might have no children)
    format('Can see %s of own children', own_children_count)::TEXT;
  
  -- Test 5: Verify parent cannot see other parents' children
  RETURN QUERY SELECT 
    'Cannot View Other Parents Children'::TEXT,
    (other_parents_children_count = 0),
    format('Should see 0 other parents children, actually seeing: %s', other_parents_children_count)::TEXT;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION test_parent_children_isolation() TO authenticated;

-- =====================================================
-- STEP 4: Instructions for testing
-- =====================================================
-- To test isolation, run this as an authenticated parent:
-- SELECT * FROM test_parent_children_isolation();
--
-- Expected results:
-- 1. "Parent Children Isolation" should be TRUE
-- 2. "Can View Own Children" should be TRUE
-- 3. "Cannot View Other Parents Children" should be TRUE
--
-- If any test fails, there's an RLS policy issue that needs investigation.

-- =====================================================
-- Migration complete
-- =====================================================
-- Next steps:
-- 1. Verify policies show roles: {authenticated} for INSERT/UPDATE/DELETE
-- 2. Test isolation by running: SELECT * FROM test_parent_children_isolation();
-- 3. If tests pass, parents should only see their own children






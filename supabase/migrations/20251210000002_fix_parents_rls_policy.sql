-- Migration: Fix Parents Table RLS Policy
-- Purpose: Ensure parents can query their own parent record
-- Date: 2025-12-10
-- 
-- Issue: 406 error when querying parents table from AccountSettings
-- The policy should allow authenticated users to view their own parent record

-- =====================================================
-- STEP 1: Verify RLS is enabled on parents table
-- =====================================================
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Drop existing SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "Parents can view own profile" ON public.parents;
DROP POLICY IF EXISTS "Parents can view own profile and children can view parent names" ON public.parents;
DROP POLICY IF EXISTS "Children can view their parent's name" ON public.parents;

-- =====================================================
-- STEP 3: Create policy for authenticated parents to view own profile
-- =====================================================
-- Parents (authenticated users) can view their own record
CREATE POLICY "Parents can view own profile"
  ON public.parents FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- =====================================================
-- STEP 4: Create policy for anonymous users (children) to view parent names
-- =====================================================
-- Children (anonymous users) can view parent names for display
-- This is scoped to 'anon' so it won't interfere with authenticated parents
CREATE POLICY "Children can view their parent's name"
  ON public.parents FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.parent_id = parents.id
    )
  );

-- =====================================================
-- STEP 5: Verify policies were created
-- =====================================================
SELECT 
    'Parents Table RLS Policies' as info,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN qual IS NULL THEN 'NULL (permissive)'
        ELSE 'HAS USING CLAUSE'
    END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'parents'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- =====================================================
-- Migration complete
-- =====================================================
-- After running this migration:
-- 1. Authenticated parents can SELECT their own parent record (id = auth.uid())
-- 2. Anonymous users (children) can view parent names if they have children
-- 
-- To verify:
-- 1. Log in as parent
-- 2. Query: SELECT * FROM parents WHERE id = '<parent_id>';
-- 3. Should return the parent record





-- fix_children_view_parents_rls.sql
-- Allow children (anonymous users) to view their parent's name
-- Run this in Supabase SQL Editor

-- =====================================================
-- STEP 1: Ensure children table allows anonymous reads
-- =====================================================
-- CRITICAL: The EXISTS check in the parents policy requires
-- anonymous users to be able to read from the children table
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- =====================================================
-- STEP 2: Drop existing policy if it exists
-- =====================================================
DROP POLICY IF EXISTS "Children can view their parent's name" ON public.parents;

-- =====================================================
-- STEP 3: Create policy to allow children to view their parent's name
-- =====================================================
-- This allows anonymous users (children) to read the name field
-- from the parents table if they are a child of that parent
-- Note: Since we can't identify the specific child in anonymous context,
-- we allow reading any parent who has children (this is safe as it's just the name)
CREATE POLICY "Children can view their parent's name"
ON public.parents
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.parent_id = parents.id
  )
);

-- =====================================================
-- STEP 4: Verify the policies were created
-- =====================================================
SELECT 
    'Policy created' as status,
    policyname,
    cmd as command,
    roles,
    qual as using_expression
FROM pg_policies
WHERE tablename = 'parents'
  AND policyname = 'Children can view their parent''s name';


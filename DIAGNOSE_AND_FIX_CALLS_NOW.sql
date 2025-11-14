-- DIAGNOSE_AND_FIX_CALLS_NOW.sql
-- Run this directly in Supabase SQL Editor to diagnose and fix the issue immediately
-- This will check current state and apply the fix

-- ============================================
-- STEP 1: Check current policies
-- ============================================
SELECT 
    'Current Call Policies' as info,
    policyname,
    cmd as command,
    roles::text as roles,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY policyname, cmd;

SELECT 
    'Current Children Table Policies' as info,
    policyname,
    cmd as command,
    roles::text as roles,
    qual as using_clause
FROM pg_policies
WHERE tablename = 'children'
ORDER BY policyname, cmd;

-- ============================================
-- STEP 2: Check if RLS is enabled
-- ============================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('calls', 'children')
AND schemaname = 'public';

-- ============================================
-- STEP 3: Ensure children table allows anonymous reads
-- ============================================
-- CRITICAL: This MUST exist for the calls insert policy to work
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 4: Drop ALL existing call policies
-- ============================================
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;
DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;

-- ============================================
-- STEP 5: Create Child Policies (for anonymous users)
-- ============================================

-- Allow children to view their own calls
CREATE POLICY "Children can view their own calls"
ON public.calls
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);

-- Allow children to insert calls they initiate
-- CRITICAL: Uses IN subquery instead of EXISTS (EXISTS doesn't work reliably in WITH CHECK)
CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
  caller_type = 'child'::text AND
  calls.child_id IN (
    SELECT id 
    FROM public.children 
    WHERE parent_id = calls.parent_id
  )
);

-- Allow children to update their own calls
CREATE POLICY "Children can update their own calls"
ON public.calls
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);

-- ============================================
-- STEP 6: Create Parent Policies (for authenticated users)
-- ============================================

-- Allow parents to view calls for their children
CREATE POLICY "Parents can view calls for their children"
ON public.calls
FOR SELECT
USING (
  calls.parent_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

-- Allow parents to insert calls they initiate
CREATE POLICY "Parents can insert calls"
ON public.calls
FOR INSERT
WITH CHECK (
  caller_type = 'parent'::text AND
  parent_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

-- Allow parents to update calls
CREATE POLICY "Parents can update calls"
ON public.calls
FOR UPDATE
USING (
  calls.parent_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
)
WITH CHECK (
  calls.parent_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
);

-- ============================================
-- STEP 7: Verify policies were created
-- ============================================
SELECT 
    '✅ Final Call Policies' as info,
    policyname,
    cmd as command,
    roles::text as roles
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY 
  CASE 
    WHEN policyname LIKE 'Children%' THEN 1
    WHEN policyname LIKE 'Parents%' THEN 2
    ELSE 3
  END,
  policyname;

SELECT 
    '✅ Final Children Policies' as info,
    policyname,
    cmd as command,
    roles::text as roles
FROM pg_policies
WHERE tablename = 'children'
ORDER BY policyname;


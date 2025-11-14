-- COMPREHENSIVE_DIAGNOSTIC.sql
-- Complete diagnostic to find the exact issue
-- Run this to see what's blocking the insert

-- ============================================
-- STEP 1: Show the EXACT policy definitions
-- ============================================
SELECT 
    'Child INSERT Policy' as policy_type,
    policyname,
    with_check as full_with_check_clause
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname = 'Children can insert calls they initiate'
  AND cmd = 'INSERT';

-- ============================================
-- STEP 2: Verify children table policy exists and works
-- ============================================
SELECT 
    'Children Table Anon Policy' as check_type,
    policyname,
    cmd,
    roles::text,
    qual as using_clause,
    CASE 
        WHEN policyname = 'Anyone can verify login codes' 
        AND cmd = 'SELECT' 
        AND 'anon' = ANY(roles::text[])
        THEN '✅ Policy exists and should allow anon reads'
        ELSE '❌ Policy missing or incorrect'
    END as status
FROM pg_policies
WHERE tablename = 'children'
  AND 'anon' = ANY(roles::text[])
  AND cmd = 'SELECT';

-- ============================================
-- STEP 3: Test if anon can actually read children table
-- ============================================
-- Get a sample child to test with
SELECT 
    'Sample Child for Testing' as info,
    id as child_id,
    parent_id,
    name
FROM public.children
LIMIT 1;

-- ============================================
-- STEP 4: Recreate the child policy with explicit schema
-- ============================================
-- Sometimes policies need explicit schema qualification

DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
  caller_type = 'child'::text AND
  calls.child_id IN (
    SELECT public.children.id 
    FROM public.children 
    WHERE public.children.parent_id = calls.parent_id
  )
);

-- ============================================
-- STEP 5: Verify the policy was recreated correctly
-- ============================================
SELECT 
    '✅ Recreated Policy' as status,
    policyname,
    cmd,
    roles::text,
    CASE 
        WHEN with_check IS NOT NULL 
        AND with_check::text LIKE '%child_id IN%'
        AND with_check::text LIKE '%public.children%'
        THEN '✅ Policy looks correct'
        ELSE '❌ Policy might have issues'
    END as policy_check,
    with_check as full_clause
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname = 'Children can insert calls they initiate'
  AND cmd = 'INSERT';

-- ============================================
-- STEP 6: Final verification - all policies
-- ============================================
SELECT 
    'All Call Policies Status' as info,
    policyname,
    cmd,
    roles::text,
    CASE 
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '❌ MISSING WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check IS NOT NULL THEN '✅ Has WITH CHECK'
        ELSE 'N/A'
    END as insert_status
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY 
  CASE 
    WHEN policyname LIKE 'Children%' THEN 1
    WHEN policyname LIKE 'Parents%' THEN 2
    ELSE 3
  END,
  policyname,
  cmd;


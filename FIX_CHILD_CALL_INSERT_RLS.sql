-- FIX_CHILD_CALL_INSERT_RLS.sql
-- Fix RLS policy to allow children (anonymous users) to insert calls
-- The issue is that the policy checks the children table, but anonymous users need to be able to read it

-- ============================================
-- STEP 1: Ensure children table allows anonymous reads
-- ============================================
-- Children need to be able to verify their own record exists for RLS policies to work

-- Check if policy exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'children'
    AND policyname = 'Anyone can verify login codes'
  ) THEN
    CREATE POLICY "Anyone can verify login codes"
    ON public.children
    FOR SELECT
    TO anon
    USING (true);
    
    RAISE NOTICE 'Created policy: Anyone can verify login codes';
  ELSE
    RAISE NOTICE 'Policy "Anyone can verify login codes" already exists';
  END IF;
END $$;

-- ============================================
-- STEP 2: Fix child call insert policy
-- ============================================
-- Drop and recreate the policy to ensure it works correctly

DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;

-- Create policy that allows children to insert calls
-- The policy verifies:
-- 1. caller_type is 'child'
-- 2. The child exists in the children table
-- 3. The parent_id matches the child's parent_id
CREATE POLICY "Children can insert calls they initiate"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (
  caller_type = 'child' AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = calls.parent_id
  )
);

-- ============================================
-- STEP 3: Verify policies exist
-- ============================================

SELECT 
    'Child Call Policies' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE tablename = 'calls'
  AND policyname LIKE 'Children%'
ORDER BY policyname;

SELECT 
    'Children Table Policies' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE tablename = 'children'
  AND roles::text LIKE '%anon%'
ORDER BY policyname;

-- ============================================
-- STEP 4: Test the policy (optional)
-- ============================================
-- You can test this by running as an anonymous user:
-- INSERT INTO calls (child_id, parent_id, caller_type, status)
-- SELECT id, parent_id, 'child', 'ringing'
-- FROM children
-- WHERE id = '<child_id>'
-- LIMIT 1;


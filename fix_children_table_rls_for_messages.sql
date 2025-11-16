-- =====================================================
-- FIX CHILDREN TABLE RLS FOR MESSAGE INSERTS
-- =====================================================
-- Issue: Child message inserts fail because anonymous users
-- can't read the children table to verify the child exists
-- =====================================================

-- =====================================================
-- STEP 1: Drop existing policy if it exists (to recreate it)
-- =====================================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

-- =====================================================
-- STEP 2: Create policy that allows anonymous users to read children table
-- =====================================================
-- This is REQUIRED for the EXISTS check in message INSERT policies to work
CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- =====================================================
-- STEP 3: Verify policy was created
-- =====================================================
SELECT 
    'Children Table RLS Policy' as check_type,
    policyname,
    cmd as command,
    roles,
    '✅ Policy created' as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
  AND policyname = 'Anyone can verify login codes';

-- =====================================================
-- STEP 4: Test anonymous access to children table
-- =====================================================
-- This should return rows if the policy is working
SELECT 
    id,
    name,
    '✅ Anonymous users can read this child' as status
FROM public.children
WHERE id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid
LIMIT 1;

-- =====================================================
-- STEP 5: Verify message INSERT policy is correct
-- =====================================================
SELECT 
    'Message INSERT Policy Check' as check_type,
    policyname,
    cmd as command,
    roles,
    with_check as policy_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
  AND 'anon' = ANY(roles);

-- Expected output:
-- Policy: "Children can send messages"
-- Expression should include EXISTS check on children table


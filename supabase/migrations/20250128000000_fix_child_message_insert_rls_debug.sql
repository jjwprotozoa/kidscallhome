-- Fix child message INSERT RLS policy - DEBUG VERSION
-- Created: 2025-01-28
-- Issue: Policy still failing even with correct syntax
-- Debug: Test if children table RLS is blocking the subquery

-- ============================================
-- STEP 1: Verify children table policy exists and works
-- ============================================
SELECT 
    'Children Table Policies' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
ORDER BY cmd, policyname;

-- ============================================
-- STEP 2: Test if anonymous can SELECT from children
-- (Run this as anon user to verify)
-- ============================================
-- This should return rows if the policy works
-- SELECT id FROM public.children LIMIT 1;

-- ============================================
-- STEP 3: Drop and recreate children SELECT policy
-- Make absolutely sure it allows anonymous reads
-- ============================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- Grant explicit SELECT permission (belt and suspenders)
GRANT SELECT ON public.children TO anon;

-- ============================================
-- STEP 4: Drop existing message policy
-- ============================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- ============================================
-- STEP 5: Create policy with explicit table references
-- Match the exact pattern from working calls policy
-- ============================================
CREATE POLICY "Children can send messages"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  sender_type = 'child' AND
  sender_id = child_id AND
  messages.child_id IN (
    SELECT children.id 
    FROM public.children 
    WHERE children.id = messages.sender_id
  )
);

-- ============================================
-- STEP 6: Verify policy was created
-- ============================================
SELECT 
    'Policy Verification' as info,
    policyname,
    cmd as command,
    roles,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND policyname = 'Children can send messages';


-- Fix child message INSERT RLS policy - WORKING VERSION
-- Created: 2025-01-31
-- Issue: Policy exists but still failing
-- Solution: Use explicit WHERE clause to verify specific child exists

-- ============================================
-- STEP 1: Verify children table allows anonymous reads
-- ============================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- Grant explicit permissions
GRANT SELECT ON public.children TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- ============================================
-- STEP 2: Drop existing policy
-- ============================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- ============================================
-- STEP 3: Create policy with explicit WHERE clause
-- Verify the specific child exists (not just any child)
-- ============================================
CREATE POLICY "Children can send messages"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  sender_type = 'child' AND
  sender_id = child_id AND
  EXISTS (
    SELECT 1 
    FROM public.children 
    WHERE children.id = messages.child_id
      AND children.id = messages.sender_id
  )
);

-- ============================================
-- STEP 4: Verify policy was created
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


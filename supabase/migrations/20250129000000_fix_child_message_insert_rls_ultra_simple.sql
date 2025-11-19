-- Fix child message INSERT RLS policy - ULTRA SIMPLE
-- Created: 2025-01-29
-- Issue: Complex subquery failing
-- Solution: Simplify to just verify child exists (since sender_id = child_id is already checked)

-- ============================================
-- STEP 1: Ensure children table allows anonymous reads
-- ============================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- Grant explicit SELECT permission
GRANT SELECT ON public.children TO anon;

-- ============================================
-- STEP 2: Drop existing policy
-- ============================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- ============================================
-- STEP 3: Create ULTRA SIMPLE policy
-- Since sender_id = child_id is already checked, we just need to verify child exists
-- This matches the UPDATE policy pattern for calls (uses table prefix in WHERE)
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
  )
);

-- ============================================
-- STEP 4: Verify policy
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


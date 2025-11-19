-- Fix child message INSERT RLS policy - SIMPLE APPROACH
-- Created: 2025-01-27
-- Issue: EXISTS check failing even with correct syntax
-- Solution: Use simpler approach matching working calls table pattern
-- Children are anonymous (localStorage session, not Supabase Auth)

-- ============================================
-- STEP 1: Ensure children table allows anonymous reads
-- ============================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 2: Drop existing policy
-- ============================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- ============================================
-- STEP 3: Create SIMPLE policy matching calls table pattern
-- Uses IN clause with table prefix for outer columns (matches working calls policy)
-- CRITICAL: In subqueries, reference outer table columns with table prefix
-- ============================================
CREATE POLICY "Children can send messages"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  sender_type = 'child' AND
  sender_id = child_id AND
  messages.child_id IN (
    SELECT id 
    FROM public.children 
    WHERE children.id = messages.sender_id
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


-- Fix child message INSERT RLS policy - correct column references in WITH CHECK
-- Created: 2025-01-25
-- Issue: Policy exists but WITH CHECK is failing because columns are referenced incorrectly
-- Solution: In WITH CHECK clauses, reference columns directly (not table.column)

-- ============================================
-- STEP 1: Drop existing policy
-- ============================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- ============================================
-- STEP 2: Create policy with correct column references
-- CRITICAL: In WITH CHECK, use column names directly (child_id, not messages.child_id)
-- ============================================
CREATE POLICY "Children can send messages"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  sender_type = 'child' AND
  sender_id = child_id AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = child_id
    AND children.id = sender_id
  )
);

-- ============================================
-- STEP 3: Verify policy was created correctly
-- ============================================
SELECT 
    'Child Message INSERT Policy' as info,
    policyname,
    cmd as command,
    roles,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND policyname = 'Children can send messages';


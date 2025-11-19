-- Fix child message INSERT RLS policy - FINAL FIX
-- Created: 2025-01-26
-- Issue: Policy WITH CHECK clause uses messages.child_id instead of child_id
-- Root Cause: In WITH CHECK for INSERT, columns must be referenced directly (not table.column)
-- Solution: Drop and recreate with correct column references

-- ============================================
-- STEP 1: Ensure children table allows anonymous reads
-- (Required for EXISTS check to work)
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
-- STEP 3: Create policy with CORRECT column references
-- CRITICAL: In WITH CHECK for INSERT, use column names directly
-- DO NOT use messages.child_id - use child_id
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
    WHERE children.id = child_id
      AND children.id = sender_id
  )
);

-- ============================================
-- STEP 4: Verify the policy was created correctly
-- The with_check should show child_id and sender_id (NOT messages.child_id)
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

-- ============================================
-- EXPECTED OUTPUT:
-- with_check should contain: children.id = child_id (NOT messages.child_id)
-- ============================================


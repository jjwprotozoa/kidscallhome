-- supabase/migrations/20251213000002_update_message_policy_with_rate_limit.sql
-- Purpose: Update child message INSERT policy to include rate limiting
-- Created: 2025-12-13

-- ============================================
-- STEP 1: Drop existing child message INSERT policies
-- ============================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;
DROP POLICY IF EXISTS "Children can send messages in their conversations" ON public.messages;

-- ============================================
-- STEP 2: Create new policy with rate limit check
-- ============================================
-- This policy checks rate limits before allowing message insertion
-- Note: Rate limit check is done via function call in WITH CHECK clause
CREATE POLICY "Children can send messages with rate limiting"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  sender_type = 'child' AND
  sender_id = child_id AND
  -- Verify child exists
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = child_id
    AND children.id = sender_id
  ) AND
  -- Check rate limit (100 messages per hour)
  check_child_message_rate_limit(child_id, 100, 60)
);

-- ============================================
-- STEP 3: Verify policy was created
-- ============================================
SELECT 
    'Child Message INSERT Policy with Rate Limiting' as info,
    policyname,
    cmd as command,
    roles,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND policyname = 'Children can send messages with rate limiting';

-- ============================================
-- Migration complete
-- ============================================
-- This migration updates the child message INSERT policy to:
-- 1. Verify sender_type is 'child'
-- 2. Verify sender_id matches child_id
-- 3. Verify child exists
-- 4. Check rate limit (100 messages per hour) - NEW


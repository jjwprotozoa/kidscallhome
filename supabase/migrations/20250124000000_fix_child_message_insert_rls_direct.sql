-- Fix child message INSERT RLS policy using direct EXISTS check (more reliable)
-- Created: 2025-01-24
-- Issue: Child message inserts failing with RLS violation (code 42501)
-- Root Cause: Previous migration uses SECURITY DEFINER function which may not be accessible
-- Solution: Use direct EXISTS check instead of function dependency

-- ============================================
-- STEP 1: Ensure children table allows anonymous reads
-- (Required for child INSERT policy EXISTS checks)
-- ============================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;

CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 2: Drop existing child message policies
-- ============================================
DROP POLICY IF EXISTS "Children can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- ============================================
-- STEP 3: Create policy for children to VIEW messages
-- ============================================
CREATE POLICY "Children can view their messages"
ON public.messages
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = messages.child_id
  )
);

-- ============================================
-- STEP 4: Create policy for children to SEND messages
-- Uses direct EXISTS check (no function dependency)
-- This is more reliable than using SECURITY DEFINER functions
-- CRITICAL: In WITH CHECK, reference columns directly (not messages.column)
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
-- STEP 5: Verify policies were created
-- ============================================
SELECT 
    'Messages Policies' as table_name,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
ORDER BY 
    CASE cmd 
        WHEN 'SELECT' THEN 1
        WHEN 'INSERT' THEN 2
        WHEN 'UPDATE' THEN 3
        WHEN 'DELETE' THEN 4
    END,
    policyname;


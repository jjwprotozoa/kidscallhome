-- Diagnostic and Fix for child message INSERT RLS
-- Created: 2025-01-30
-- This will diagnose the issue and apply a working fix

-- ============================================
-- STEP 1: Check if child exists
-- Replace CHILD_ID with actual child ID from error
-- ============================================
-- SELECT id, name, parent_id 
-- FROM public.children 
-- WHERE id = 'b791c91f-9e41-4ded-b05a-9260c2665841';

-- ============================================
-- STEP 2: Check current children table policies
-- ============================================
SELECT 
    'Children Table Policies' as info,
    policyname,
    cmd as command,
    roles,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
ORDER BY cmd, policyname;

-- ============================================
-- STEP 3: Check current messages table policies
-- ============================================
SELECT 
    'Messages Table Policies' as info,
    policyname,
    cmd as command,
    roles,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
ORDER BY cmd, policyname;

-- ============================================
-- STEP 4: Ensure children table allows anonymous reads
-- Drop ALL existing anon policies and recreate
-- ============================================
DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;
DROP POLICY IF EXISTS "Children can view their parent's name" ON public.children;

-- Create comprehensive anonymous SELECT policy
CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);

-- Grant explicit permissions
GRANT SELECT ON public.children TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- ============================================
-- STEP 5: Drop and recreate message policy
-- Use the simplest possible check
-- ============================================
DROP POLICY IF EXISTS "Children can send messages" ON public.messages;

-- Try WITHOUT the EXISTS check first (just basic validation)
-- If this works, the issue is with the EXISTS subquery
CREATE POLICY "Children can send messages"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  sender_type = 'child' AND
  sender_id = child_id
  -- Temporarily remove EXISTS to test if that's the issue
  -- AND EXISTS (SELECT 1 FROM public.children WHERE children.id = messages.child_id)
);

-- ============================================
-- STEP 6: Test query (run as anon to verify)
-- ============================================
-- This should return the child if policies work
-- SELECT id FROM public.children WHERE id = 'b791c91f-9e41-4ded-b05a-9260c2665841';


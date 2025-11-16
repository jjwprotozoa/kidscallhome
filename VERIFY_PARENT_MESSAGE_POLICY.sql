-- VERIFY_PARENT_MESSAGE_POLICY.sql
-- Check parent SELECT policy for messages table
-- Run this in Supabase SQL Editor

-- =====================================================
-- Check parent SELECT policy details
-- =====================================================
SELECT 
    'Parent SELECT Policy Details' as info,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND policyname = 'Parents can view messages for their children'
  AND cmd = 'SELECT';

-- =====================================================
-- Expected: Should see a policy with USING clause that checks:
-- EXISTS (
--   SELECT 1 FROM public.children
--   WHERE children.id = messages.child_id
--   AND children.parent_id = auth.uid()
-- )
-- =====================================================

-- =====================================================
-- If policy is missing or incorrect, run FIX_MESSAGING_RLS_PRODUCTION.sql
-- =====================================================


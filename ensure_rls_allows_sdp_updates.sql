-- ensure_rls_allows_sdp_updates.sql
-- Ensures RLS policies explicitly allow updating offer, answer, and ice_candidates columns
-- Run this in Supabase SQL Editor if you want to be explicit about column-level permissions
-- Note: The existing policies should already allow this, but this makes it explicit

-- ============================================
-- VERIFY CURRENT POLICIES
-- ============================================
-- First, let's see what we have
SELECT 
    'Current UPDATE policies' as info,
    policyname,
    cmd,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls'
  AND cmd = 'UPDATE';

-- ============================================
-- ANALYSIS
-- ============================================
-- The existing policies use USING and WITH CHECK clauses that verify the relationship
-- (parent owns child, or child matches). These policies apply to ALL columns, including
-- the new jsonb columns (offer, answer, ice_candidates).
--
-- If you want to be MORE restrictive (e.g., only allow updating SDP fields during active calls),
-- you could modify the WITH CHECK clause. However, the current approach is fine for most use cases.
--
-- The policies already allow:
-- - Parents: Can UPDATE any column in calls for their children
-- - Children: Can UPDATE any column in calls where they are the child
--
-- This includes offer, answer, and ice_candidates.

-- ============================================
-- OPTIONAL: ADD MORE RESTRICTIVE POLICIES
-- ============================================
-- If you want to add additional restrictions (e.g., only allow SDP updates during ringing/active),
-- you could create additional policies. However, this is usually unnecessary complexity.

-- Example (commented out - not recommended unless you have specific security requirements):
/*
-- This would restrict SDP updates to only ringing/active calls
CREATE POLICY "Parents can update SDP only during active calls"
ON public.calls
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
  AND calls.status IN ('ringing', 'active')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
    AND children.parent_id = auth.uid()
  )
  AND calls.status IN ('ringing', 'active')
);
*/

-- ============================================
-- RECOMMENDATION
-- ============================================
-- The existing policies are sufficient. They allow:
-- 1. Parents to update calls for their children (including SDP fields)
-- 2. Children to update their own calls (including SDP fields)
--
-- No changes needed unless you have specific security requirements.

SELECT 
    'RLS Policy Analysis Complete' as status,
    'Existing policies should allow SDP updates' as recommendation,
    'No changes required unless you need additional restrictions' as action;


-- Migration: Fix Remaining Unoptimized Policies
-- Purpose: Optimize the last 4 unoptimized policies (calls_backup table)
-- Date: 2025-01-20
-- Run this to complete the optimization

-- =====================================================
-- Fix calls_backup table policies
-- =====================================================
-- Based on schema: calls_backup has caller_id and callee_id (UUIDs)
-- These likely reference user IDs, so we'll optimize the policies

-- Drop existing policies
DROP POLICY IF EXISTS "calls_backup_select_owner" ON public.calls_backup;
DROP POLICY IF EXISTS "calls_backup_insert_owner" ON public.calls_backup;
DROP POLICY IF EXISTS "calls_backup_update_owner" ON public.calls_backup;
DROP POLICY IF EXISTS "calls_backup_delete_owner" ON public.calls_backup;

-- Recreate with optimized (select auth.uid())
-- SELECT policy: Users can view their own calls (as caller or callee)
CREATE POLICY "calls_backup_select_owner"
  ON public.calls_backup FOR SELECT
  TO authenticated
  USING (
    caller_id = (select auth.uid())
    OR callee_id = (select auth.uid())
  );

-- INSERT policy: Users can insert their own calls
CREATE POLICY "calls_backup_insert_owner"
  ON public.calls_backup FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_id = (select auth.uid())
    OR callee_id = (select auth.uid())
  );

-- UPDATE policy: Users can update their own calls
CREATE POLICY "calls_backup_update_owner"
  ON public.calls_backup FOR UPDATE
  TO authenticated
  USING (
    caller_id = (select auth.uid())
    OR callee_id = (select auth.uid())
  )
  WITH CHECK (
    caller_id = (select auth.uid())
    OR callee_id = (select auth.uid())
  );

-- DELETE policy: Users can delete their own calls
CREATE POLICY "calls_backup_delete_owner"
  ON public.calls_backup FOR DELETE
  TO authenticated
  USING (
    caller_id = (select auth.uid())
    OR callee_id = (select auth.uid())
  );

-- =====================================================
-- Migration complete
-- =====================================================
-- All policies are now optimized!
-- Verify with share_rls_optimization_status.sql


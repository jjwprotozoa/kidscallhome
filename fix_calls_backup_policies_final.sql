-- Final Fix: Optimize calls_backup Policies
-- Run this in Supabase SQL Editor

-- =====================================================
-- Step 1: Check current policy definitions
-- =====================================================
-- First, let's see what the current policies look like
SELECT 
    policyname,
    cmd,
    LEFT(COALESCE(qual::text, ''), 200) as using_clause,
    LEFT(COALESCE(with_check::text, ''), 200) as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls_backup'
ORDER BY cmd;

-- =====================================================
-- Step 2: Drop all existing calls_backup policies
-- =====================================================
DROP POLICY IF EXISTS "calls_backup_select_owner" ON public.calls_backup;
DROP POLICY IF EXISTS "calls_backup_insert_owner" ON public.calls_backup;
DROP POLICY IF EXISTS "calls_backup_update_owner" ON public.calls_backup;
DROP POLICY IF EXISTS "calls_backup_delete_owner" ON public.calls_backup;

-- =====================================================
-- Step 3: Recreate with optimized (select auth.uid())
-- =====================================================
-- Based on calls_backup schema: caller_id and callee_id are UUIDs

-- SELECT: Users can view calls where they are caller or callee
CREATE POLICY "calls_backup_select_owner"
  ON public.calls_backup FOR SELECT
  TO authenticated
  USING (
    caller_id = (select auth.uid())
    OR callee_id = (select auth.uid())
  );

-- INSERT: Users can insert calls where they are caller or callee
CREATE POLICY "calls_backup_insert_owner"
  ON public.calls_backup FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_id = (select auth.uid())
    OR callee_id = (select auth.uid())
  );

-- UPDATE: Users can update calls where they are caller or callee
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

-- DELETE: Users can delete calls where they are caller or callee
CREATE POLICY "calls_backup_delete_owner"
  ON public.calls_backup FOR DELETE
  TO authenticated
  USING (
    caller_id = (select auth.uid())
    OR callee_id = (select auth.uid())
  );

-- =====================================================
-- Step 4: Verify the policies are optimized
-- =====================================================
SELECT 
    'Verification' as check_type,
    policyname,
    cmd,
    CASE 
        WHEN COALESCE(qual::text, '') LIKE '%SELECT auth.uid()%' 
             OR COALESCE(qual::text, '') LIKE '%select auth.uid()%'
             OR COALESCE(with_check::text, '') LIKE '%SELECT auth.uid()%'
             OR COALESCE(with_check::text, '') LIKE '%select auth.uid()%' THEN '✅ Optimized'
        ELSE '❌ Still Unoptimized'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls_backup'
ORDER BY cmd;


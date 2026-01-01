-- Check and Fix calls_backup Policies
-- This will show current state and fix if needed

-- =====================================================
-- STEP 1: Check current policy definitions
-- =====================================================
SELECT 
    'Current Policy State' as info,
    policyname,
    cmd,
    CASE 
        WHEN COALESCE(qual::text, '') LIKE '%SELECT auth.uid()%' 
             OR COALESCE(qual::text, '') LIKE '%select auth.uid()%'
             OR COALESCE(with_check::text, '') LIKE '%SELECT auth.uid()%'
             OR COALESCE(with_check::text, '') LIKE '%select auth.uid()%' THEN '✅ Optimized'
        WHEN COALESCE(qual::text, '') LIKE '%auth.uid()%' 
             OR COALESCE(with_check::text, '') LIKE '%auth.uid()%' THEN '❌ Unoptimized'
        ELSE 'ℹ️ No auth.uid()'
    END as status,
    LEFT(COALESCE(qual::text, with_check::text, ''), 150) as policy_text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls_backup'
ORDER BY cmd;

-- =====================================================
-- STEP 2: Force recreate all policies with optimization
-- =====================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "calls_backup_select_owner" ON public.calls_backup;
DROP POLICY IF EXISTS "calls_backup_insert_owner" ON public.calls_backup;
DROP POLICY IF EXISTS "calls_backup_update_owner" ON public.calls_backup;
DROP POLICY IF EXISTS "calls_backup_delete_owner" ON public.calls_backup;

-- Recreate SELECT policy with optimization
CREATE POLICY "calls_backup_select_owner"
  ON public.calls_backup FOR SELECT
  TO authenticated
  USING (
    caller_id = (select auth.uid())
    OR callee_id = (select auth.uid())
  );

-- Recreate INSERT policy with optimization
CREATE POLICY "calls_backup_insert_owner"
  ON public.calls_backup FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_id = (select auth.uid())
    OR callee_id = (select auth.uid())
  );

-- Recreate UPDATE policy with optimization
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

-- Recreate DELETE policy with optimization
CREATE POLICY "calls_backup_delete_owner"
  ON public.calls_backup FOR DELETE
  TO authenticated
  USING (
    caller_id = (select auth.uid())
    OR callee_id = (select auth.uid())
  );

-- =====================================================
-- STEP 3: Verify they're now optimized
-- =====================================================
SELECT 
    'After Fix - Verification' as info,
    policyname,
    cmd,
    CASE 
        WHEN COALESCE(qual::text, '') LIKE '%SELECT auth.uid()%' 
             OR COALESCE(qual::text, '') LIKE '%select auth.uid()%'
             OR COALESCE(with_check::text, '') LIKE '%SELECT auth.uid()%'
             OR COALESCE(with_check::text, '') LIKE '%select auth.uid()%' THEN '✅ Optimized'
        ELSE '❌ Still Unoptimized - Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls_backup'
ORDER BY cmd;


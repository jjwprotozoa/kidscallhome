-- verify_rls_for_new_columns.sql
-- Verifies that RLS policies allow updating offer, answer, and ice_candidates columns
-- Run this in Supabase SQL Editor to ensure everything is configured correctly

-- ============================================
-- VERIFY COLUMNS EXIST
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'calls'
  AND column_name IN ('offer', 'answer', 'ice_candidates')
ORDER BY column_name;

-- ============================================
-- VERIFY RLS POLICIES FOR CALLS TABLE
-- ============================================
SELECT 
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls'
ORDER BY policyname, cmd;

-- ============================================
-- TEST UPDATE PERMISSIONS (Simulation)
-- ============================================
-- Note: This doesn't actually update, just shows what would be allowed
-- Parents can update calls for their children
SELECT 
    'Parent UPDATE policy' as policy_type,
    'Should allow updating offer, answer, ice_candidates' as expected_behavior,
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'calls'
          AND cmd = 'UPDATE'
          AND policyname LIKE '%Parent%'
    ) as policy_exists;

-- Children can update their own calls
SELECT 
    'Child UPDATE policy' as policy_type,
    'Should allow updating offer, answer, ice_candidates' as expected_behavior,
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'calls'
          AND cmd = 'UPDATE'
          AND policyname LIKE '%Child%'
    ) as policy_exists;

-- ============================================
-- VERIFY REALTIME IS ENABLED
-- ============================================
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename = 'calls';

-- ============================================
-- SUMMARY
-- ============================================
SELECT 
    'Verification Complete' as status,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' 
       AND table_name = 'calls' 
       AND column_name IN ('offer', 'answer', 'ice_candidates')) as columns_found,
    (SELECT COUNT(*) FROM pg_policies 
     WHERE schemaname = 'public' 
       AND tablename = 'calls' 
       AND cmd = 'UPDATE') as update_policies_count,
    (SELECT COUNT(*) FROM pg_publication_tables 
     WHERE pubname = 'supabase_realtime' 
       AND schemaname = 'public' 
       AND tablename = 'calls') as realtime_enabled;


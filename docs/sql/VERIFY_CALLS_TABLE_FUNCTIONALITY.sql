-- =====================================================
-- VERIFY CALLS TABLE FUNCTIONALITY
-- Run this in: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/sql/new
-- =====================================================
-- This script verifies that the calls table is working correctly
-- despite NULL values in columns 3, 4, 5, 7, 8

-- =====================================================
-- STEP 1: Check column structure and NULL counts
-- =====================================================

SELECT 
    'Column Analysis' as section,
    column_name,
    data_type,
    is_nullable,
    (SELECT COUNT(*) FROM public.calls WHERE (column_name::text)::uuid IS NULL) as null_count,
    (SELECT COUNT(*) FROM public.calls) as total_rows
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
  AND ordinal_position IN (3, 4, 5, 7, 8)
ORDER BY ordinal_position;

-- =====================================================
-- STEP 2: Verify active columns are populated
-- =====================================================

SELECT 
    'Active Columns Check' as section,
    COUNT(*) as total_calls,
    COUNT(child_id) as calls_with_child_id,
    COUNT(parent_id) as calls_with_parent_id,
    COUNT(family_member_id) as calls_with_family_member_id,
    COUNT(caller_type) as calls_with_caller_type,
    COUNT(recipient_type) as calls_with_recipient_type,
    COUNT(status) as calls_with_status
FROM public.calls;

-- =====================================================
-- STEP 3: Check RLS policies use active columns
-- =====================================================

SELECT 
    'RLS Policy Check' as section,
    policyname,
    cmd as command,
    CASE 
        WHEN qual::text LIKE '%child_id%' THEN '✅ Uses child_id'
        WHEN qual::text LIKE '%parent_id%' THEN '✅ Uses parent_id'
        WHEN qual::text LIKE '%family_member_id%' THEN '✅ Uses family_member_id'
        WHEN qual::text LIKE '%caller_type%' THEN '✅ Uses caller_type'
        WHEN qual::text LIKE '%caller_id%' THEN '⚠️ Uses caller_id (legacy)'
        WHEN qual::text LIKE '%callee_id%' THEN '⚠️ Uses callee_id (reserved)'
        ELSE '❓ Unknown'
    END as column_usage
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls'
ORDER BY cmd, policyname;

-- =====================================================
-- STEP 4: Sample recent calls to verify structure
-- =====================================================

SELECT 
    'Recent Calls Sample' as section,
    id,
    created_at,
    caller_type,
    status,
    child_id,
    parent_id,
    family_member_id,
    recipient_type,
    -- NULL columns (expected to be NULL)
    caller_id,
    callee_id,
    call_type,
    caller_profile,
    callee_profile
FROM public.calls
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- STEP 5: Verify call state transitions
-- =====================================================

SELECT 
    'Call State Analysis' as section,
    status,
    COUNT(*) as count,
    COUNT(ended_at) as with_ended_at,
    COUNT(ended_by) as with_ended_by,
    COUNT(end_reason) as with_end_reason
FROM public.calls
GROUP BY status
ORDER BY count DESC;

-- =====================================================
-- STEP 6: Check for any foreign key constraint issues
-- =====================================================

SELECT 
    'Foreign Key Check' as section,
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    CASE 
        WHEN conname LIKE '%caller_id%' THEN '⚠️ Legacy caller_id FK'
        WHEN conname LIKE '%callee_id%' THEN 'ℹ️ Reserved callee_id FK'
        ELSE '✅ Active FK'
    END as status
FROM pg_constraint
WHERE conrelid = 'public.calls'::regclass
  AND contype = 'f'
ORDER BY conname;

-- =====================================================
-- EXPECTED RESULTS:
-- =====================================================
-- 1. Columns 3,4,5,7,8 should show 100% NULL (or close to it)
-- 2. Active columns (child_id, parent_id, caller_type, etc.) should be populated
-- 3. RLS policies should use active columns, not NULL columns
-- 4. Recent calls should show proper structure with active columns populated
-- 5. Call states should show proper transitions
-- 6. Foreign keys on caller_id/callee_id are expected (legacy/reserved)
-- =====================================================




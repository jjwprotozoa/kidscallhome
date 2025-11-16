-- =====================================================
-- FINAL VERIFICATION - CHECK POLICY EXPRESSION
-- =====================================================

-- =====================================================
-- STEP 1: Show the exact policy expression
-- =====================================================
SELECT 
    'Child Message INSERT Policy Expression' as check_type,
    policyname,
    cmd as command,
    roles,
    with_check as policy_expression,
    -- Check if it uses IN pattern
    CASE 
        WHEN with_check::text LIKE '%IN (%' THEN '✅ Uses IN pattern (correct)'
        WHEN with_check::text LIKE '%EXISTS%' THEN '⚠️ Uses EXISTS (may not work)'
        ELSE '❓ Unknown pattern'
    END as pattern_type,
    -- Check if it references children table
    CASE 
        WHEN with_check::text LIKE '%children%' THEN '✅ References children table'
        ELSE '❌ Missing children table reference'
    END as has_children_reference
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND cmd = 'INSERT'
  AND 'anon' = ANY(roles);

-- =====================================================
-- STEP 2: Verify RLS is enabled
-- =====================================================
SELECT 
    'RLS Status' as check_type,
    CASE 
        WHEN rowsecurity THEN '✅ RLS is enabled'
        ELSE '❌ RLS is NOT enabled - This is a problem!'
    END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'messages';

-- =====================================================
-- STEP 3: Summary of all checks
-- =====================================================
SELECT 
    'Summary' as check_type,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND cmd = 'INSERT' AND 'anon' = ANY(roles)) as child_insert_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND cmd = 'SELECT' AND 'anon' = ANY(roles)) as child_select_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND cmd = 'INSERT' AND 'authenticated' = ANY(roles)) as parent_insert_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND cmd = 'SELECT' AND 'authenticated' = ANY(roles)) as parent_select_policies,
    CASE 
        WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages') = 4 
        THEN '✅ All 4 policies exist'
        ELSE '❌ Missing some policies'
    END as all_policies_exist;


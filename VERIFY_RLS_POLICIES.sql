-- VERIFY_RLS_POLICIES.sql
-- Quick verification script - run this anytime to check if policies are correct
-- This uses the verification function created in the guard migration

-- ============================================
-- Run verification
-- ============================================
SELECT * FROM public.verify_call_rls_policies()
ORDER BY 
    CASE status
        WHEN 'OK' THEN 3
        WHEN 'INVALID' THEN 1
        WHEN 'MISSING' THEN 1
        ELSE 2
    END,
    policy_name;

-- ============================================
-- If issues found, auto-fix them
-- ============================================
-- Uncomment the line below to automatically fix any issues:
-- SELECT * FROM public.auto_fix_call_rls_policies();

-- ============================================
-- Show current policy details
-- ============================================
SELECT 
    'Current Policies' as info,
    policyname,
    cmd,
    roles::text,
    CASE 
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '❌ MISSING WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check IS NOT NULL THEN '✅ Has WITH CHECK'
        ELSE 'N/A'
    END as insert_status
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY 
  CASE 
    WHEN policyname LIKE 'Children%' THEN 1
    WHEN policyname LIKE 'Parents%' THEN 2
    ELSE 3
  END,
  policyname,
  cmd;


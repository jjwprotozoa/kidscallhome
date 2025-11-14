-- CHECK_RLS_POLICIES_NOW.sql
-- Quick check of RLS policies for calls table
-- Run this in Supabase SQL Editor

-- ============================================
-- Check if required policies exist
-- ============================================

SELECT 
    'Policy Check' as check_type,
    policyname,
    cmd as command,
    roles::text as roles,
    CASE 
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '❌ MISSING WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check IS NOT NULL THEN '✅ Has WITH CHECK'
        ELSE '✅ OK'
    END as status
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

-- ============================================
-- Check children table policy
-- ============================================

SELECT 
    'Children Table Policy' as check_type,
    policyname,
    cmd as command,
    roles::text as roles,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'children'
            AND policyname = 'Anyone can verify login codes'
            AND cmd = 'SELECT'
            AND 'anon' = ANY(roles::text[])
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM pg_policies
WHERE tablename = 'children'
AND policyname = 'Anyone can verify login codes'
LIMIT 1;

-- If no rows returned, the policy is missing
-- ============================================
-- Summary of Required Policies
-- ============================================

SELECT 
    'Required Policy' as info,
    'Children: Anyone can verify login codes (SELECT, anon)' as policy_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'children'
            AND policyname = 'Anyone can verify login codes'
            AND cmd = 'SELECT'
            AND 'anon' = ANY(roles::text[])
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
UNION ALL
SELECT 
    'Required Policy',
    'Calls: Children can insert calls they initiate (INSERT, anon)',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'calls'
            AND policyname = 'Children can insert calls they initiate'
            AND cmd = 'INSERT'
            AND 'anon' = ANY(roles::text[])
            AND with_check IS NOT NULL
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING or INVALID'
    END
UNION ALL
SELECT 
    'Required Policy',
    'Calls: Children can view their own calls (SELECT, anon)',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'calls'
            AND policyname = 'Children can view their own calls'
            AND cmd = 'SELECT'
            AND 'anon' = ANY(roles::text[])
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END
UNION ALL
SELECT 
    'Required Policy',
    'Calls: Children can update their own calls (UPDATE, anon)',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'calls'
            AND policyname = 'Children can update their own calls'
            AND cmd = 'UPDATE'
            AND 'anon' = ANY(roles::text[])
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END
UNION ALL
SELECT 
    'Required Policy',
    'Calls: Parents can insert calls (INSERT, authenticated)',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'calls'
            AND policyname = 'Parents can insert calls'
            AND cmd = 'INSERT'
            AND 'authenticated' = ANY(roles::text[])
            AND with_check IS NOT NULL
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING or INVALID'
    END
UNION ALL
SELECT 
    'Required Policy',
    'Calls: Parents can view calls for their children (SELECT, authenticated)',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'calls'
            AND policyname = 'Parents can view calls for their children'
            AND cmd = 'SELECT'
            AND 'authenticated' = ANY(roles::text[])
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END
UNION ALL
SELECT 
    'Required Policy',
    'Calls: Parents can update calls (UPDATE, authenticated)',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'calls'
            AND policyname = 'Parents can update calls'
            AND cmd = 'UPDATE'
            AND 'authenticated' = ANY(roles::text[])
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END;


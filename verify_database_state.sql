-- Comprehensive database state verification
-- Run this to check if everything is set up correctly

-- 1. Check calls table schema
SELECT 
    'Calls Table Schema' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
ORDER BY ordinal_position;

-- 2. Check all RLS policies on calls table
SELECT 
    'RLS Policies' as check_type,
    policyname,
    cmd as command,
    CASE 
        WHEN policyname LIKE 'Children%' THEN 'Child Policy'
        WHEN policyname LIKE 'Parents%' THEN 'Parent Policy'
        WHEN policyname LIKE 'Users%' THEN 'OLD - Should be removed'
        ELSE 'Other'
    END as policy_type
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY 
    CASE 
        WHEN policyname LIKE 'Users%' THEN 3
        WHEN policyname LIKE 'Children%' THEN 1
        WHEN policyname LIKE 'Parents%' THEN 2
        ELSE 4
    END,
    policyname;

-- 3. Check if children table exists and its schema
SELECT 
    'Children Table Schema' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'children'
ORDER BY ordinal_position;

-- 4. Check calls table data transformation
SELECT 
    'Data Transformation Status' as check_type,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN child_id IS NOT NULL THEN 1 END) as calls_with_child_id,
    COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as calls_with_parent_id,
    COUNT(CASE WHEN caller_type IS NOT NULL THEN 1 END) as calls_with_caller_type,
    COUNT(CASE WHEN caller_type = 'child' THEN 1 END) as child_initiated,
    COUNT(CASE WHEN caller_type = 'parent' THEN 1 END) as parent_initiated,
    COUNT(CASE WHEN caller_id IS NOT NULL THEN 1 END) as still_has_old_caller_id,
    COUNT(CASE WHEN callee_id IS NOT NULL THEN 1 END) as still_has_old_callee_id
FROM calls;

-- 5. Check constraints
SELECT 
    'Constraints' as check_type,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
  AND table_name = 'calls'
  AND constraint_type IN ('FOREIGN KEY', 'CHECK', 'PRIMARY KEY')
ORDER BY constraint_type, constraint_name;

-- 6. Sample of transformed data
SELECT 
    'Sample Transformed Data' as check_type,
    id,
    caller_id as old_caller_id,
    callee_id as old_callee_id,
    child_id,
    parent_id,
    caller_type,
    status,
    created_at
FROM calls
ORDER BY created_at DESC
LIMIT 5;

-- 7. Check for any issues
SELECT 
    'Issues Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'calls' 
            AND policyname LIKE 'Users%'
        ) THEN '⚠️ Old "Users" policies still exist - run cleanup_old_policies.sql'
        ELSE '✅ No old policies found'
    END as old_policies_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'calls' 
            AND column_name IN ('child_id', 'parent_id', 'caller_type')
        ) THEN '✅ New columns exist'
        ELSE '❌ New columns missing'
    END as new_columns_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'children'
        ) THEN '✅ Children table exists'
        ELSE '❌ Children table missing'
    END as children_table_status;


-- Verify the transformation was successful
-- Run this after transform_calls_safe.sql

-- 1. Check that all required columns exist
SELECT 
    'Column Check' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
  AND column_name IN ('id', 'child_id', 'parent_id', 'caller_type', 'status', 'offer', 'answer', 'ice_candidates', 'created_at', 'ended_at')
ORDER BY 
    CASE column_name
        WHEN 'id' THEN 1
        WHEN 'child_id' THEN 2
        WHEN 'parent_id' THEN 3
        WHEN 'caller_type' THEN 4
        WHEN 'status' THEN 5
        ELSE 6
    END;

-- 2. Check for NULL values (should be none after transformation)
SELECT 
    'NULL Check' as check_type,
    COUNT(*) as total_rows,
    COUNT(CASE WHEN child_id IS NULL THEN 1 END) as null_child_id,
    COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as null_parent_id,
    COUNT(CASE WHEN caller_type IS NULL THEN 1 END) as null_caller_type
FROM calls;

-- 3. Verify foreign key relationships
SELECT 
    'Foreign Key Check' as check_type,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN EXISTS (SELECT 1 FROM children WHERE id = calls.child_id) THEN 1 END) as valid_child_relationships
FROM calls;

-- 4. Check caller_type values (should only be 'parent' or 'child')
SELECT 
    'Caller Type Distribution' as check_type,
    caller_type,
    COUNT(*) as count
FROM calls
GROUP BY caller_type;

-- 5. Verify parent_id matches child's parent
SELECT 
    'Parent-Child Relationship Check' as check_type,
    COUNT(*) as total_calls,
    COUNT(CASE 
        WHEN EXISTS (
            SELECT 1 FROM children 
            WHERE children.id = calls.child_id 
            AND children.parent_id = calls.parent_id
        ) THEN 1 
    END) as valid_parent_child_relationships
FROM calls;

-- 6. Check constraints
SELECT 
    'Constraints' as check_type,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
  AND table_name = 'calls'
  AND constraint_type IN ('FOREIGN KEY', 'CHECK')
ORDER BY constraint_name;

-- 7. Sample data verification
SELECT 
    'Sample Data' as check_type,
    c.id,
    c.child_id,
    ch.name as child_name,
    c.parent_id,
    c.caller_type,
    c.status,
    c.created_at
FROM calls c
LEFT JOIN children ch ON ch.id = c.child_id
ORDER BY c.created_at DESC
LIMIT 10;


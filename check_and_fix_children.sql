-- Check what children exist in the database
-- This helps identify if children need to be created

-- 1. List all children
SELECT 
    'All Children' as check_type,
    id,
    name,
    parent_id,
    login_code,
    avatar_color,
    created_at
FROM children
ORDER BY created_at DESC;

-- 2. Check if specific child exists (replace UUID)
SELECT 
    'Child Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM children 
            WHERE id = '1f435b79-08d0-4260-a48c-e844ab49c393'
        ) THEN '✅ Child exists'
        ELSE '❌ Child does not exist'
    END as status,
    (
        SELECT json_build_object(
            'id', id,
            'name', name,
            'parent_id', parent_id,
            'login_code', login_code
        )
        FROM children 
        WHERE id = '1f435b79-08d0-4260-a48c-e844ab49c393'
    ) as child_data;

-- 3. Count children per parent
SELECT 
    'Children per Parent' as check_type,
    parent_id,
    COUNT(*) as child_count,
    STRING_AGG(name, ', ') as child_names
FROM children
GROUP BY parent_id;

-- 4. If you need to create a test child (replace values)
/*
INSERT INTO children (parent_id, name, login_code, avatar_color)
VALUES (
    'YOUR_PARENT_ID_HERE'::uuid,  -- Replace with actual parent_id
    'Test Child',
    'TEST01',  -- Replace with a unique 6-character code
    '#3B82F6'
)
RETURNING id, name, login_code;
*/


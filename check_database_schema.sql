-- Check what tables exist in your database
-- Run this first to understand your actual schema

-- 1. List all tables in the public schema
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Check if there's a users table or similar
SELECT 
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%child%' OR table_name LIKE '%parent%' OR table_name LIKE '%user%')
ORDER BY table_name;

-- 3. Check the actual structure of the calls table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
ORDER BY ordinal_position;

-- 4. Check what foreign keys exist on calls table
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'calls';

-- 5. Sample data from calls table (to understand the structure)
SELECT * FROM calls LIMIT 5;


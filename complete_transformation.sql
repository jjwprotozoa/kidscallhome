-- Complete transformation script
-- Run these in order:

-- STEP 1: Check your current schema
-- Run: check_database_schema.sql first to see what you have

-- STEP 2: Create backup
CREATE TABLE IF NOT EXISTS calls_backup AS 
SELECT *, NOW() as backup_created_at FROM calls;

-- STEP 3: Create children table if needed
-- Run: create_children_table_if_needed.sql

-- STEP 4: Add new columns to calls table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'child_id'
    ) THEN
        ALTER TABLE calls ADD COLUMN child_id uuid;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'parent_id'
    ) THEN
        ALTER TABLE calls ADD COLUMN parent_id uuid;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'caller_type'
    ) THEN
        ALTER TABLE calls ADD COLUMN caller_type text;
    END IF;
END $$;

-- STEP 5: Transform existing data
-- This assumes caller_id = child and callee_id = parent
-- Adjust if your data is different
UPDATE calls
SET 
    child_id = COALESCE(child_id, caller_id),
    parent_id = COALESCE(parent_id, callee_id),
    caller_type = COALESCE(caller_type, 'child')
WHERE child_id IS NULL OR parent_id IS NULL OR caller_type IS NULL;

-- STEP 6: If children table exists, verify relationships
-- If you have existing children data, you can update parent_id from children table:
/*
UPDATE calls c
SET parent_id = (
    SELECT parent_id 
    FROM children ch 
    WHERE ch.id = c.child_id 
    LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM children WHERE id = c.child_id)
AND (parent_id IS NULL OR parent_id != (SELECT parent_id FROM children WHERE id = c.child_id LIMIT 1));
*/

-- STEP 7: Add constraints
DO $$
BEGIN
    -- Add check constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'calls_caller_type_check' 
        AND table_name = 'calls'
    ) THEN
        ALTER TABLE calls 
        ADD CONSTRAINT calls_caller_type_check 
        CHECK (caller_type IN ('parent', 'child'));
    END IF;

    -- Add foreign key if children table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'children'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'calls_child_id_fkey'
        ) THEN
            -- Check if all child_ids are valid
            IF NOT EXISTS (
                SELECT 1 FROM calls c
                WHERE c.child_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM children ch WHERE ch.id = c.child_id)
            ) THEN
                ALTER TABLE calls 
                ADD CONSTRAINT calls_child_id_fkey 
                FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE;
            END IF;
        END IF;
    END IF;
END $$;

-- STEP 8: Make columns NOT NULL (if all data is valid)
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM calls
    WHERE child_id IS NULL OR parent_id IS NULL OR caller_type IS NULL;
    
    IF null_count = 0 THEN
        ALTER TABLE calls ALTER COLUMN child_id SET NOT NULL;
        ALTER TABLE calls ALTER COLUMN parent_id SET NOT NULL;
        ALTER TABLE calls ALTER COLUMN caller_type SET NOT NULL;
    END IF;
END $$;

-- STEP 9: Show results
SELECT 
    'Transformation Summary' as info,
    COUNT(*) as total_calls,
    COUNT(DISTINCT child_id) as unique_children,
    COUNT(DISTINCT parent_id) as unique_parents,
    COUNT(CASE WHEN caller_type = 'child' THEN 1 END) as child_initiated,
    COUNT(CASE WHEN caller_type = 'parent' THEN 1 END) as parent_initiated
FROM calls;


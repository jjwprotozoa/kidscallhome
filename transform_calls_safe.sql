-- SAFE TRANSFORMATION: Transform calls table preserving all data
-- This version is more careful and handles edge cases

-- STEP 1: First, let's see what we're working with
-- Run this to check current structure:
/*
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
ORDER BY ordinal_position;
*/

-- STEP 2: Create backup (IMPORTANT!)
CREATE TABLE IF NOT EXISTS calls_backup_$(date +%s) AS 
SELECT *, NOW() as backup_created_at FROM calls;

-- STEP 3: Add new columns (safe - won't fail if they exist)
DO $$
BEGIN
    -- Add child_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'child_id'
    ) THEN
        ALTER TABLE calls ADD COLUMN child_id uuid;
        RAISE NOTICE 'Added child_id column';
    END IF;

    -- Add parent_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'parent_id'
    ) THEN
        ALTER TABLE calls ADD COLUMN parent_id uuid;
        RAISE NOTICE 'Added parent_id column';
    END IF;

    -- Add caller_type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'caller_type'
    ) THEN
        ALTER TABLE calls ADD COLUMN caller_type text;
        RAISE NOTICE 'Added caller_type column';
    END IF;
END $$;

-- STEP 4: Transform data - handle both scenarios
-- Scenario A: caller_id is child, callee_id is parent
UPDATE calls c
SET 
    child_id = COALESCE(
        c.child_id,  -- Keep if already set
        CASE 
            WHEN EXISTS (SELECT 1 FROM children ch WHERE ch.id = c.caller_id) 
                THEN c.caller_id
            WHEN EXISTS (SELECT 1 FROM children ch WHERE ch.id = c.callee_id) 
                THEN c.callee_id
            ELSE NULL
        END
    ),
    parent_id = COALESCE(
        c.parent_id,  -- Keep if already set
        CASE 
            WHEN EXISTS (SELECT 1 FROM children ch WHERE ch.id = c.caller_id) 
                THEN (SELECT parent_id FROM children WHERE id = c.caller_id LIMIT 1)
            WHEN EXISTS (SELECT 1 FROM children ch WHERE ch.id = c.callee_id) 
                THEN (SELECT parent_id FROM children WHERE id = c.callee_id LIMIT 1)
            ELSE NULL
        END
    ),
    caller_type = COALESCE(
        c.caller_type,  -- Keep if already set
        CASE 
            WHEN EXISTS (SELECT 1 FROM children ch WHERE ch.id = c.caller_id) 
                THEN 'child'
            WHEN EXISTS (SELECT 1 FROM children ch WHERE ch.id = c.callee_id) 
                THEN 'parent'
            ELSE 'parent'  -- Default fallback
        END
    )
WHERE c.child_id IS NULL OR c.parent_id IS NULL OR c.caller_type IS NULL;

-- STEP 5: Verify transformation before adding constraints
-- Check for any NULL values that shouldn't be NULL
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM calls
    WHERE child_id IS NULL OR parent_id IS NULL OR caller_type IS NULL;
    
    IF null_count > 0 THEN
        RAISE WARNING 'Found % rows with NULL values. Please review before adding constraints.', null_count;
    ELSE
        RAISE NOTICE 'All rows have valid child_id, parent_id, and caller_type';
    END IF;
END $$;

-- STEP 6: Add constraints (only if data is valid)
DO $$
BEGIN
    -- Add foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'calls_child_id_fkey' 
        AND table_name = 'calls'
    ) THEN
        -- First check if all child_ids are valid
        IF NOT EXISTS (
            SELECT 1 FROM calls c
            WHERE c.child_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM children ch WHERE ch.id = c.child_id)
        ) THEN
            ALTER TABLE calls 
            ADD CONSTRAINT calls_child_id_fkey 
            FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint';
        ELSE
            RAISE WARNING 'Cannot add foreign key - some child_ids are invalid';
        END IF;
    END IF;

    -- Add check constraint for caller_type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'calls_caller_type_check' 
        AND table_name = 'calls'
    ) THEN
        ALTER TABLE calls 
        ADD CONSTRAINT calls_caller_type_check 
        CHECK (caller_type IN ('parent', 'child'));
        RAISE NOTICE 'Added caller_type check constraint';
    END IF;
END $$;

-- STEP 7: Make columns NOT NULL (only if all rows have values)
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
        RAISE NOTICE 'Set columns to NOT NULL';
    ELSE
        RAISE WARNING 'Cannot set NOT NULL - % rows have NULL values', null_count;
    END IF;
END $$;

-- STEP 8: Show transformation results
SELECT 
    'Transformation Summary' as info,
    COUNT(*) as total_calls,
    COUNT(DISTINCT child_id) as unique_children,
    COUNT(DISTINCT parent_id) as unique_parents,
    COUNT(CASE WHEN caller_type = 'child' THEN 1 END) as child_initiated,
    COUNT(CASE WHEN caller_type = 'parent' THEN 1 END) as parent_initiated
FROM calls;

-- Show sample of transformed data
SELECT 
    id,
    child_id,
    parent_id,
    caller_type,
    status,
    created_at
FROM calls
ORDER BY created_at DESC
LIMIT 5;


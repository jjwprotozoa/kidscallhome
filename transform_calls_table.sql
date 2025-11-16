-- Transform existing calls table from caller_id/callee_id to child_id/parent_id/caller_type
-- This preserves existing data while updating the schema

-- Step 1: Check current schema (run this first to verify)
/*
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
ORDER BY ordinal_position;
*/

-- Step 2: Create backup of existing data (optional but recommended)
CREATE TABLE IF NOT EXISTS calls_backup AS SELECT * FROM calls;

-- Step 3: Add new columns if they don't exist
DO $$
BEGIN
    -- Add child_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'child_id'
    ) THEN
        ALTER TABLE calls ADD COLUMN child_id uuid;
    END IF;

    -- Add parent_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'parent_id'
    ) THEN
        ALTER TABLE calls ADD COLUMN parent_id uuid;
    END IF;

    -- Add caller_type if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'caller_type'
    ) THEN
        ALTER TABLE calls ADD COLUMN caller_type text;
    END IF;
END $$;

-- Step 4: Transform existing data
-- This assumes caller_id and callee_id exist and we need to map them to child_id/parent_id
-- We'll determine which is the child and which is the parent based on the children table

UPDATE calls
SET 
    -- Determine child_id: whichever ID exists in children table
    child_id = CASE 
        WHEN EXISTS (SELECT 1 FROM children WHERE id = calls.caller_id) THEN calls.caller_id
        WHEN EXISTS (SELECT 1 FROM children WHERE id = calls.callee_id) THEN calls.callee_id
        ELSE NULL
    END,
    -- Determine parent_id: get parent_id from children table for the child
    parent_id = CASE 
        WHEN EXISTS (SELECT 1 FROM children WHERE id = calls.caller_id) 
            THEN (SELECT parent_id FROM children WHERE id = calls.caller_id LIMIT 1)
        WHEN EXISTS (SELECT 1 FROM children WHERE id = calls.callee_id)
            THEN (SELECT parent_id FROM children WHERE id = calls.callee_id LIMIT 1)
        ELSE NULL
    END,
    -- Determine caller_type: if caller_id is a child, then 'child', otherwise 'parent'
    caller_type = CASE 
        WHEN EXISTS (SELECT 1 FROM children WHERE id = calls.caller_id) THEN 'child'
        ELSE 'parent'
    END
WHERE child_id IS NULL OR parent_id IS NULL OR caller_type IS NULL;

-- Step 5: Add constraints and foreign key
DO $$
BEGIN
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'calls_child_id_fkey' 
        AND table_name = 'calls'
    ) THEN
        ALTER TABLE calls 
        ADD CONSTRAINT calls_child_id_fkey 
        FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE;
    END IF;

    -- Add check constraint for caller_type if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'calls_caller_type_check' 
        AND table_name = 'calls'
    ) THEN
        ALTER TABLE calls 
        ADD CONSTRAINT calls_caller_type_check 
        CHECK (caller_type IN ('parent', 'child'));
    END IF;

    -- Make columns NOT NULL after data is populated
    ALTER TABLE calls ALTER COLUMN child_id SET NOT NULL;
    ALTER TABLE calls ALTER COLUMN parent_id SET NOT NULL;
    ALTER TABLE calls ALTER COLUMN caller_type SET NOT NULL;
END $$;

-- Step 6: Drop old columns (optional - comment out if you want to keep them for reference)
-- ALTER TABLE calls DROP COLUMN IF EXISTS caller_id;
-- ALTER TABLE calls DROP COLUMN IF EXISTS callee_id;

-- Step 7: Verify the transformation
SELECT 
    id,
    child_id,
    parent_id,
    caller_type,
    status,
    created_at
FROM calls
LIMIT 10;


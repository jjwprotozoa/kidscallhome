-- Transform calls table WITHOUT assuming children table exists
-- This version works with whatever schema you have

-- STEP 1: First, let's understand your schema
-- Run check_database_schema.sql first to see what tables exist

-- STEP 2: Add new columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'child_id'
    ) THEN
        ALTER TABLE calls ADD COLUMN child_id uuid;
        RAISE NOTICE 'Added child_id column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'parent_id'
    ) THEN
        ALTER TABLE calls ADD COLUMN parent_id uuid;
        RAISE NOTICE 'Added parent_id column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'caller_type'
    ) THEN
        ALTER TABLE calls ADD COLUMN caller_type text;
        RAISE NOTICE 'Added caller_type column';
    END IF;
END $$;

-- STEP 3: Transform data based on what we have
-- Option A: If you have caller_id and callee_id, we'll need to determine which is child/parent
-- For now, let's set defaults and you can manually adjust

-- First, let's see what data we have
SELECT 
    'Current calls data' as info,
    COUNT(*) as total_calls,
    COUNT(DISTINCT caller_id) as unique_callers,
    COUNT(DISTINCT callee_id) as unique_callees
FROM calls;

-- Transform: We'll set caller_id as child_id and callee_id as parent_id for now
-- You may need to adjust this based on your actual data
UPDATE calls
SET 
    child_id = COALESCE(child_id, caller_id),  -- Use caller_id as child_id
    parent_id = COALESCE(parent_id, callee_id),  -- Use callee_id as parent_id
    caller_type = COALESCE(caller_type, 'child')  -- Default to 'child' (caller initiates)
WHERE child_id IS NULL OR parent_id IS NULL OR caller_type IS NULL;

-- STEP 4: Add constraints (without foreign key to children table for now)
DO $$
BEGIN
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

-- STEP 5: Show results
SELECT 
    'Transformation Complete' as status,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN child_id IS NOT NULL THEN 1 END) as calls_with_child_id,
    COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as calls_with_parent_id,
    COUNT(CASE WHEN caller_type IS NOT NULL THEN 1 END) as calls_with_caller_type
FROM calls;

-- Show sample
SELECT 
    id,
    caller_id,
    callee_id,
    child_id,
    parent_id,
    caller_type,
    status,
    created_at
FROM calls
ORDER BY created_at DESC
LIMIT 10;


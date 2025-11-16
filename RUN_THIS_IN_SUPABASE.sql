-- =====================================================
-- COMPLETE TRANSFORMATION SCRIPT
-- Copy and paste this entire file into Supabase SQL Editor
-- Run it in one go - it handles everything
-- =====================================================

-- STEP 1: Create backup (IMPORTANT!)
CREATE TABLE IF NOT EXISTS calls_backup AS 
SELECT *, NOW() as backup_created_at FROM calls;

-- STEP 1.5: Create children table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'children'
    ) THEN
        -- Create children table
        CREATE TABLE public.children (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            parent_id uuid NOT NULL,
            name text NOT NULL,
            login_code text NOT NULL UNIQUE,
            avatar_color text DEFAULT '#3B82F6',
            created_at timestamptz DEFAULT now() NOT NULL
        );

        -- Enable RLS
        ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

        -- Create basic policies for children table
        CREATE POLICY "Anyone can verify login codes"
        ON public.children
        FOR SELECT
        TO anon
        USING (true);

        CREATE POLICY "Parents can view own children"
        ON public.children
        FOR SELECT
        USING (parent_id = auth.uid());

        CREATE POLICY "Parents can insert own children"
        ON public.children
        FOR INSERT
        WITH CHECK (parent_id = auth.uid());

        CREATE POLICY "Parents can update own children"
        ON public.children
        FOR UPDATE
        USING (parent_id = auth.uid());

        CREATE POLICY "Parents can delete own children"
        ON public.children
        FOR DELETE
        USING (parent_id = auth.uid());

        RAISE NOTICE 'Created children table with policies';
    ELSE
        RAISE NOTICE 'Children table already exists';
    END IF;
END $$;

-- STEP 2: Add new columns to calls table
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

-- STEP 3: Transform existing data
-- Maps caller_id -> child_id, callee_id -> parent_id
UPDATE calls
SET 
    child_id = COALESCE(child_id, caller_id),
    parent_id = COALESCE(parent_id, callee_id),
    caller_type = COALESCE(caller_type, 'child')
WHERE child_id IS NULL OR parent_id IS NULL OR caller_type IS NULL;

-- STEP 4: Add constraints
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

-- STEP 5: Drop old policies (try with and without periods)
DROP POLICY IF EXISTS "Users can create calls" ON public.calls;
DROP POLICY IF EXISTS "Users can create calls." ON public.calls;
DROP POLICY IF EXISTS "Users can update their own calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update their own calls." ON public.calls;
DROP POLICY IF EXISTS "Users can view calls they are involved in" ON public.calls;
DROP POLICY IF EXISTS "Users can view calls they are involved in." ON public.calls;

-- STEP 6: Create new policies for authenticated users (parents)
-- Only create if children table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'children'
    ) THEN
        -- Drop existing parent policies if they exist
        DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;
        DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;
        DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;

        CREATE POLICY "Parents can view calls for their children"
        ON public.calls
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.children
            WHERE children.id = calls.child_id
            AND children.parent_id = auth.uid()
          )
        );

        CREATE POLICY "Parents can insert calls"
        ON public.calls
        FOR INSERT
        WITH CHECK (
          caller_type = 'parent' AND
          EXISTS (
            SELECT 1 FROM public.children
            WHERE children.id = calls.child_id
            AND children.parent_id = auth.uid()
          )
        );

        CREATE POLICY "Parents can update calls"
        ON public.calls
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.children
            WHERE children.id = calls.child_id
            AND children.parent_id = auth.uid()
          )
        );
        
        RAISE NOTICE 'Created parent policies';
    ELSE
        RAISE NOTICE 'Children table does not exist - cannot create parent policies that require it';
    END IF;
END $$;

-- STEP 7: Create policies for anonymous users (children)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'children'
    ) THEN
        -- Drop existing child policies if they exist
        DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
        DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
        DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;

        CREATE POLICY "Children can view their own calls"
        ON public.calls
        FOR SELECT
        TO anon
        USING (
          EXISTS (
            SELECT 1 FROM public.children
            WHERE children.id = calls.child_id
          )
        );

        CREATE POLICY "Children can insert calls they initiate"
        ON public.calls
        FOR INSERT
        TO anon
        WITH CHECK (
          caller_type = 'child' AND
          EXISTS (
            SELECT 1 FROM public.children
            WHERE children.id = calls.child_id
            AND children.parent_id = calls.parent_id
          )
        );

        CREATE POLICY "Children can update their own calls"
        ON public.calls
        FOR UPDATE
        TO anon
        USING (
          EXISTS (
            SELECT 1 FROM public.children
            WHERE children.id = calls.child_id
          )
        );
        
        RAISE NOTICE 'Created child policies';
    ELSE
        RAISE NOTICE 'Children table does not exist - skipping child policies';
    END IF;
END $$;

-- STEP 8: Show transformation results
SELECT 
    '✅ Transformation Complete!' as status,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN child_id IS NOT NULL THEN 1 END) as calls_with_child_id,
    COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as calls_with_parent_id,
    COUNT(CASE WHEN caller_type IS NOT NULL THEN 1 END) as calls_with_caller_type,
    COUNT(CASE WHEN caller_type = 'child' THEN 1 END) as child_initiated,
    COUNT(CASE WHEN caller_type = 'parent' THEN 1 END) as parent_initiated
FROM calls;

-- STEP 9: Show sample transformed data
SELECT 
    'Sample Data' as info,
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

-- STEP 10: Verify policies
SELECT 
    'Policies Created' as info,
    policyname,
    cmd as command
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY policyname;


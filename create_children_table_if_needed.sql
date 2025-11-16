-- Create children table if it doesn't exist
-- This matches the schema expected by your code

-- Check if children table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'children'
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

        -- Create policies
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

-- Now update calls table to add foreign key constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'children'
    ) THEN
        -- Add foreign key if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'calls_child_id_fkey' 
            AND table_name = 'calls'
        ) THEN
            -- First, ensure all child_ids are valid
            IF NOT EXISTS (
                SELECT 1 FROM calls c
                WHERE c.child_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM children ch WHERE ch.id = c.child_id)
            ) THEN
                ALTER TABLE calls 
                ADD CONSTRAINT calls_child_id_fkey 
                FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE;
                RAISE NOTICE 'Added foreign key constraint to children table';
            ELSE
                RAISE WARNING 'Cannot add foreign key - some child_ids are invalid';
            END IF;
        END IF;
    END IF;
END $$;

-- Verify
SELECT 
    'Schema Check' as info,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'children') 
        THEN 'Children table exists'
        ELSE 'Children table missing'
    END as children_table_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'calls_child_id_fkey'
        )
        THEN 'Foreign key exists'
        ELSE 'Foreign key missing'
    END as foreign_key_status;


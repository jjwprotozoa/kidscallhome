-- supabase/migrations/20250120000002_ensure_call_rls_policies_guard.sql
-- Guard/Verification system to ensure call RLS policies never break
-- This migration can be run anytime to verify and fix policies

-- ============================================
-- STEP 1: Create verification function
-- ============================================
-- This function checks if all required policies exist and are correct

CREATE OR REPLACE FUNCTION public.verify_call_rls_policies()
RETURNS TABLE (
    policy_name text,
    status text,
    issue_description text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_children_anon_policy_exists boolean;
    v_child_insert_policy_exists boolean;
    v_child_select_policy_exists boolean;
    v_child_update_policy_exists boolean;
    v_parent_insert_policy_exists boolean;
    v_parent_select_policy_exists boolean;
    v_parent_update_policy_exists boolean;
    v_child_insert_has_with_check boolean;
    v_parent_insert_has_with_check boolean;
BEGIN
    -- Check if children table has anon read policy
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'children'
        AND policyname = 'Anyone can verify login codes'
        AND cmd = 'SELECT'
        AND 'anon' = ANY(roles::text[])
    ) INTO v_children_anon_policy_exists;
    
    IF NOT v_children_anon_policy_exists THEN
        RETURN QUERY SELECT 
            'Children table anon read policy'::text,
            'MISSING'::text,
            'Policy "Anyone can verify login codes" is missing or incorrect'::text;
    END IF;
    
    -- Check child policies
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Children can insert calls they initiate'
        AND cmd = 'INSERT'
        AND 'anon' = ANY(roles::text[])
    ) INTO v_child_insert_policy_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Children can view their own calls'
        AND cmd = 'SELECT'
        AND 'anon' = ANY(roles::text[])
    ) INTO v_child_select_policy_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Children can update their own calls'
        AND cmd = 'UPDATE'
        AND 'anon' = ANY(roles::text[])
    ) INTO v_child_update_policy_exists;
    
    -- Check if child insert policy has WITH CHECK
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Children can insert calls they initiate'
        AND cmd = 'INSERT'
        AND with_check IS NOT NULL
    ) INTO v_child_insert_has_with_check;
    
    -- Check parent policies
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Parents can insert calls'
        AND cmd = 'INSERT'
    ) INTO v_parent_insert_policy_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Parents can view calls for their children'
        AND cmd = 'SELECT'
    ) INTO v_parent_select_policy_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Parents can update calls'
        AND cmd = 'UPDATE'
    ) INTO v_parent_update_policy_exists;
    
    -- Check if parent insert policy has WITH CHECK
    SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Parents can insert calls'
        AND cmd = 'INSERT'
        AND with_check IS NOT NULL
    ) INTO v_parent_insert_has_with_check;
    
    -- Report issues
    IF NOT v_child_insert_policy_exists THEN
        RETURN QUERY SELECT 
            'Children can insert calls they initiate'::text,
            'MISSING'::text,
            'Child INSERT policy is missing'::text;
    ELSIF NOT v_child_insert_has_with_check THEN
        RETURN QUERY SELECT 
            'Children can insert calls they initiate'::text,
            'INVALID'::text,
            'Child INSERT policy missing WITH CHECK clause'::text;
    ELSE
        RETURN QUERY SELECT 
            'Children can insert calls they initiate'::text,
            'OK'::text,
            'Policy exists and has WITH CHECK'::text;
    END IF;
    
    IF NOT v_child_select_policy_exists THEN
        RETURN QUERY SELECT 
            'Children can view their own calls'::text,
            'MISSING'::text,
            'Child SELECT policy is missing'::text;
    ELSE
        RETURN QUERY SELECT 
            'Children can view their own calls'::text,
            'OK'::text,
            'Policy exists'::text;
    END IF;
    
    IF NOT v_child_update_policy_exists THEN
        RETURN QUERY SELECT 
            'Children can update their own calls'::text,
            'MISSING'::text,
            'Child UPDATE policy is missing'::text;
    ELSE
        RETURN QUERY SELECT 
            'Children can update their own calls'::text,
            'OK'::text,
            'Policy exists'::text;
    END IF;
    
    IF NOT v_parent_insert_policy_exists THEN
        RETURN QUERY SELECT 
            'Parents can insert calls'::text,
            'MISSING'::text,
            'Parent INSERT policy is missing'::text;
    ELSIF NOT v_parent_insert_has_with_check THEN
        RETURN QUERY SELECT 
            'Parents can insert calls'::text,
            'INVALID'::text,
            'Parent INSERT policy missing WITH CHECK clause'::text;
    ELSE
        RETURN QUERY SELECT 
            'Parents can insert calls'::text,
            'OK'::text,
            'Policy exists and has WITH CHECK'::text;
    END IF;
    
    IF NOT v_parent_select_policy_exists THEN
        RETURN QUERY SELECT 
            'Parents can view calls for their children'::text,
            'MISSING'::text,
            'Parent SELECT policy is missing'::text;
    ELSE
        RETURN QUERY SELECT 
            'Parents can view calls for their children'::text,
            'OK'::text,
            'Policy exists'::text;
    END IF;
    
    IF NOT v_parent_update_policy_exists THEN
        RETURN QUERY SELECT 
            'Parents can update calls'::text,
            'MISSING'::text,
            'Parent UPDATE policy is missing'::text;
    ELSE
        RETURN QUERY SELECT 
            'Parents can update calls'::text,
            'OK'::text,
            'Policy exists'::text;
    END IF;
    
    RETURN;
END;
$$;

-- Grant execute to authenticated and anon
GRANT EXECUTE ON FUNCTION public.verify_call_rls_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_call_rls_policies() TO anon;

-- ============================================
-- STEP 2: Create auto-fix function
-- ============================================
-- This function automatically fixes any missing or broken policies

CREATE OR REPLACE FUNCTION public.auto_fix_call_rls_policies()
RETURNS TABLE (
    action text,
    result text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Ensure children table has anon read policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'children'
        AND policyname = 'Anyone can verify login codes'
        AND cmd = 'SELECT'
        AND 'anon' = ANY(roles::text[])
    ) THEN
        DROP POLICY IF EXISTS "Anyone can verify login codes" ON public.children;
        CREATE POLICY "Anyone can verify login codes"
        ON public.children
        FOR SELECT
        TO anon
        USING (true);
        
        RETURN QUERY SELECT 
            'Created children anon read policy'::text,
            'SUCCESS'::text;
    END IF;
    
    -- Ensure child insert policy exists and is correct
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Children can insert calls they initiate'
        AND cmd = 'INSERT'
        AND 'anon' = ANY(roles::text[])
        AND with_check IS NOT NULL
    ) THEN
        DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
        
        -- Use SECURITY DEFINER function if it exists, otherwise use IN subquery
        IF EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'verify_child_parent_relationship'
            AND pronamespace = 'public'::regnamespace
        ) THEN
            CREATE POLICY "Children can insert calls they initiate"
            ON public.calls
            FOR INSERT
            TO anon
            WITH CHECK (
                caller_type = 'child'::text AND
                public.verify_child_parent_relationship(calls.child_id, calls.parent_id) = true
            );
        ELSE
            CREATE POLICY "Children can insert calls they initiate"
            ON public.calls
            FOR INSERT
            TO anon
            WITH CHECK (
                caller_type = 'child'::text AND
                calls.child_id IN (
                    SELECT id 
                    FROM public.children 
                    WHERE parent_id = calls.parent_id
                )
            );
        END IF;
        
        RETURN QUERY SELECT 
            'Fixed child INSERT policy'::text,
            'SUCCESS'::text;
    END IF;
    
    -- Ensure parent insert policy exists and is correct
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Parents can insert calls'
        AND cmd = 'INSERT'
        AND with_check IS NOT NULL
    ) THEN
        DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;
        
        CREATE POLICY "Parents can insert calls"
        ON public.calls
        FOR INSERT
        WITH CHECK (
            caller_type = 'parent'::text AND
            parent_id = auth.uid() AND
            EXISTS (
                SELECT 1 FROM public.children
                WHERE children.id = calls.child_id
                AND children.parent_id = auth.uid()
            )
        );
        
        RETURN QUERY SELECT 
            'Fixed parent INSERT policy'::text,
            'SUCCESS'::text;
    END IF;
    
    -- Ensure other policies exist (simplified - just check existence)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Children can view their own calls'
    ) THEN
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
        
        RETURN QUERY SELECT 
            'Created child SELECT policy'::text,
            'SUCCESS'::text;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Children can update their own calls'
    ) THEN
        CREATE POLICY "Children can update their own calls"
        ON public.calls
        FOR UPDATE
        TO anon
        USING (
            EXISTS (
                SELECT 1 FROM public.children
                WHERE children.id = calls.child_id
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.children
                WHERE children.id = calls.child_id
            )
        );
        
        RETURN QUERY SELECT 
            'Created child UPDATE policy'::text,
            'SUCCESS'::text;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Parents can view calls for their children'
    ) THEN
        CREATE POLICY "Parents can view calls for their children"
        ON public.calls
        FOR SELECT
        USING (
            calls.parent_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.children
                WHERE children.id = calls.child_id
                AND children.parent_id = auth.uid()
            )
        );
        
        RETURN QUERY SELECT 
            'Created parent SELECT policy'::text,
            'SUCCESS'::text;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'calls'
        AND policyname = 'Parents can update calls'
    ) THEN
        CREATE POLICY "Parents can update calls"
        ON public.calls
        FOR UPDATE
        USING (
            calls.parent_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.children
                WHERE children.id = calls.child_id
                AND children.parent_id = auth.uid()
            )
        )
        WITH CHECK (
            calls.parent_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.children
                WHERE children.id = calls.child_id
                AND children.parent_id = auth.uid()
            )
        );
        
        RETURN QUERY SELECT 
            'Created parent UPDATE policy'::text,
            'SUCCESS'::text;
    END IF;
    
    RETURN QUERY SELECT 
        'All policies verified'::text,
        'OK'::text;
    
    RETURN;
END;
$$;

-- Grant execute to authenticated (only admins should run this)
GRANT EXECUTE ON FUNCTION public.auto_fix_call_rls_policies() TO authenticated;

-- ============================================
-- STEP 3: Run verification and auto-fix
-- ============================================
-- This ensures policies are correct when migration runs

DO $$
DECLARE
    v_issues_count integer;
BEGIN
    -- Run auto-fix first
    PERFORM public.auto_fix_call_rls_policies();
    
    -- Check for remaining issues
    SELECT COUNT(*) INTO v_issues_count
    FROM public.verify_call_rls_policies()
    WHERE status != 'OK';
    
    IF v_issues_count > 0 THEN
        RAISE WARNING 'Found % RLS policy issues. Run SELECT * FROM public.verify_call_rls_policies() to see details.', v_issues_count;
    ELSE
        RAISE NOTICE 'All RLS policies are correctly configured.';
    END IF;
END $$;

-- ============================================
-- STEP 4: Show verification results
-- ============================================
SELECT * FROM public.verify_call_rls_policies();


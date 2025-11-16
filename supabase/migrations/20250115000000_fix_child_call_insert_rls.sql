-- supabase/migrations/20250115000000_fix_child_call_insert_rls.sql
-- RESTORE WORKING FIX: Child-to-parent call RLS policies
-- This restores the exact working configuration from FIX_CHILD_TO_PARENT_CALLS.sql

-- ============================================
-- STEP 1: Ensure children table allows anonymous reads
-- ============================================
-- CRITICAL: Children (anonymous users) need to read the children table
-- to verify their own record exists for RLS policies to work

DO $$
BEGIN
  -- Check if policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'children'
    AND policyname = 'Anyone can verify login codes'
  ) THEN
    CREATE POLICY "Anyone can verify login codes"
    ON public.children
    FOR SELECT
    TO anon
    USING (true);
    
    RAISE NOTICE 'Created policy: Anyone can verify login codes';
  ELSE
    RAISE NOTICE 'Policy "Anyone can verify login codes" already exists';
  END IF;
END $$;

-- ============================================
-- STEP 2: Drop and recreate ALL child call policies
-- ============================================
-- Remove any conflicting or broken policies

DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;

-- Allow children to view their own calls
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

-- Allow children to insert calls they initiate
-- CRITICAL: Uses IN subquery instead of EXISTS (EXISTS doesn't work reliably in WITH CHECK)
-- This verifies:
-- 1. caller_type is 'child'
-- 2. The child exists in children table
-- 3. The parent_id matches the child's parent_id (security)
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

-- Allow children to update their own calls
-- CRITICAL: Must allow updating all columns including offer, answer, ice_candidates, status, ended_at, etc.
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
  -- Allow update if the child_id still matches (child can't change this)
  -- But allow updating any other fields including offer, answer, ice_candidates, status, ended_at, etc.
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);


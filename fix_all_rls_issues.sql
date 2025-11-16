-- Comprehensive fix for all RLS issues
-- This ensures children (anonymous users) can properly interact with calls

-- Step 1: Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;
DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;

-- Step 2: Recreate child policies (for anonymous users)
-- These must allow children to work with calls where they are the child_id

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
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = calls.child_id
  )
);

-- Step 3: Recreate parent policies (for authenticated users)
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

-- Step 4: Verify all policies
SELECT 
    'All Policies' as info,
    policyname,
    cmd as command,
    CASE 
        WHEN policyname LIKE 'Children%' THEN 'Child (anon)'
        WHEN policyname LIKE 'Parents%' THEN 'Parent (auth)'
        ELSE 'Other'
    END as user_type
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY 
    CASE 
        WHEN policyname LIKE 'Children%' THEN 1
        WHEN policyname LIKE 'Parents%' THEN 2
        ELSE 3
    END,
    cmd;


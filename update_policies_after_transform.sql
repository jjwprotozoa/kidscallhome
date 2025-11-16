-- Update RLS policies after schema transformation
-- Run this AFTER running transform_calls_table.sql

-- Step 1: Drop old policies
DROP POLICY IF EXISTS "Users can create calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update their own calls" ON public.calls;
DROP POLICY IF EXISTS "Users can view calls they are involved in" ON public.calls;
DROP POLICY IF EXISTS "Children can insert calls they initiate" ON public.calls;
DROP POLICY IF EXISTS "Children can view their own calls" ON public.calls;
DROP POLICY IF EXISTS "Children can update their own calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can view calls for their children" ON public.calls;
DROP POLICY IF EXISTS "Parents can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Parents can update calls" ON public.calls;

-- Step 2: Create correct policies for parents (authenticated users)
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

-- Step 3: Create policies for children (anonymous users)
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

-- Step 4: Verify policies were created
SELECT 
    policyname,
    cmd as command,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY policyname;


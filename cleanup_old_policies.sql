-- Clean up old "Users can..." policies
-- These should have been dropped but might have slightly different names

-- Drop old policies (try with and without periods)
DROP POLICY IF EXISTS "Users can create calls" ON public.calls;
DROP POLICY IF EXISTS "Users can create calls." ON public.calls;
DROP POLICY IF EXISTS "Users can update their own calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update their own calls." ON public.calls;
DROP POLICY IF EXISTS "Users can view calls they are involved in" ON public.calls;
DROP POLICY IF EXISTS "Users can view calls they are involved in." ON public.calls;

-- Verify what policies remain
SELECT 
    'Remaining Policies' as info,
    policyname,
    cmd as command
FROM pg_policies
WHERE tablename = 'calls'
ORDER BY policyname;

-- Expected policies after cleanup:
-- 1. Children can insert calls they initiate (INSERT)
-- 2. Children can update their own calls (UPDATE)
-- 3. Children can view their own calls (SELECT)
-- 4. Parents can insert calls (INSERT)
-- 5. Parents can update calls (UPDATE)
-- 6. Parents can view calls for their children (SELECT)


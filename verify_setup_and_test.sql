-- =====================================================
-- STEP 1: Verify children table RLS policy exists
-- =====================================================
-- This policy MUST exist for child message inserts to work

SELECT 
    'Children Table RLS Check' as check_type,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN policyname = 'Anyone can verify login codes' 
        THEN '✅ Policy exists - Anonymous users can read children table'
        ELSE '❌ Policy missing or wrong name'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
  AND roles::text LIKE '%anon%'
ORDER BY policyname;

-- =====================================================
-- STEP 2: List all children (to get real UUIDs for testing)
-- =====================================================
-- Use these REAL UUIDs in your test queries below

SELECT 
    id as child_id,
    name as child_name,
    parent_id,
    'Use this UUID in your test' as note
FROM public.children
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- STEP 3: Test with a REAL child UUID
-- =====================================================
-- Replace 'YOUR_REAL_CHILD_ID_HERE' with an actual UUID from Step 2 above
-- Or get it from your browser console log

WITH test_payload AS (
    SELECT 
        'YOUR_REAL_CHILD_ID_HERE'::uuid as sender_id,      -- REPLACE: Use real child_id from console
        'child'::text as sender_type,
        'YOUR_REAL_CHILD_ID_HERE'::uuid as child_id        -- REPLACE: Use same child_id
)
SELECT 
    'Child Message Insert Test (with REAL UUID)' as test_name,
    sender_id,
    sender_type,
    child_id,
    -- Check 1: sender_type
    CASE 
        WHEN sender_type = 'child' THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as check1_sender_type,
    -- Check 2: sender_id matches child_id
    CASE 
        WHEN sender_id = child_id THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as check2_sender_id_matches_child_id,
    -- Check 3: child exists (THIS IS THE KEY CHECK)
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = child_id
            AND id = sender_id
        ) THEN '✅ PASS - Child exists in database'
        ELSE '❌ FAIL - Child does NOT exist OR children table RLS is blocking the check'
    END as check3_child_exists,
    -- Final result
    CASE 
        WHEN sender_type = 'child' 
         AND sender_id = child_id
         AND EXISTS (
            SELECT 1 FROM public.children
            WHERE id = child_id
            AND id = sender_id
        ) THEN '✅✅✅ ALL CHECKS PASS - RLS should allow insert ✅✅✅'
        ELSE '❌❌❌ CHECKS FAILED ❌❌❌'
    END as final_result
FROM test_payload;

-- =====================================================
-- STEP 4: If check3 fails, verify children table access
-- =====================================================
-- Run this as an anonymous user to test if they can read children table
-- This should return rows if the RLS policy is working

/*
SELECT 
    id,
    name,
    '✅ Anonymous user can read this child' as status
FROM public.children
WHERE id = 'YOUR_REAL_CHILD_ID_HERE'::uuid;
-- If this returns no rows, the RLS policy is blocking anonymous reads
*/


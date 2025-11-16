-- =====================================================
-- TEST WITH YOUR ACTUAL UUID FROM CONSOLE LOG
-- =====================================================
-- Your console shows:
-- child_id: f91c9458-6ffc-44e6-81a7-a74b851f1d99
-- sender_id: f91c9458-6ffc-44e6-81a7-a74b851f1d99
-- sender_type: 'child'

WITH test_payload AS (
    SELECT 
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid as sender_id,
        'child'::text as sender_type,
        'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid as child_id
)
SELECT 
    'Child Message Insert Test (YOUR ACTUAL UUID)' as test_name,
    sender_id,
    sender_type,
    child_id,
    -- Check 1: sender_type
    CASE 
        WHEN sender_type = 'child' THEN '✅ PASS - sender_type is correct'
        ELSE '❌ FAIL - Expected "child", got "' || sender_type || '"'
    END as check1_sender_type,
    -- Check 2: sender_id matches child_id
    CASE 
        WHEN sender_id = child_id THEN '✅ PASS - sender_id matches child_id'
        ELSE '❌ FAIL - sender_id does NOT match child_id'
    END as check2_sender_id_matches_child_id,
    -- Check 3: child exists (THIS IS THE KEY CHECK)
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.children
            WHERE id = child_id
            AND id = sender_id
        ) THEN '✅ PASS - Child exists in database'
        ELSE '❌ FAIL - Child does NOT exist OR children table RLS is blocking'
    END as check3_child_exists,
    -- Show the actual child record if it exists
    (SELECT name FROM public.children WHERE id = child_id LIMIT 1) as child_name_if_exists,
    -- Final result
    CASE 
        WHEN sender_type = 'child' 
         AND sender_id = child_id
         AND EXISTS (
            SELECT 1 FROM public.children
            WHERE id = child_id
            AND id = sender_id
        ) THEN '✅✅✅ ALL CHECKS PASS - RLS should allow insert ✅✅✅'
        ELSE '❌❌❌ CHECKS FAILED - RLS will block insert (403) ❌❌❌'
    END as final_result
FROM test_payload;

-- =====================================================
-- VERIFY CHILD EXISTS IN DATABASE
-- =====================================================
SELECT 
    id,
    name,
    parent_id,
    created_at,
    '✅ Child exists' as status
FROM public.children
WHERE id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid;

-- =====================================================
-- VERIFY CHILDREN TABLE RLS POLICY EXISTS
-- =====================================================
SELECT 
    'Children Table RLS Policy Check' as check_type,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN policyname = 'Anyone can verify login codes' 
         AND cmd = 'SELECT'
         AND 'anon' = ANY(roles)
        THEN '✅ Policy exists and allows anonymous SELECT'
        ELSE '❌ Policy missing or incorrect'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'children'
  AND 'anon' = ANY(roles);

-- =====================================================
-- TEST ANONYMOUS ACCESS TO CHILDREN TABLE
-- =====================================================
-- This simulates what the RLS policy does
-- If this returns no rows, anonymous users can't read children table
SELECT 
    'Anonymous Access Test' as test_type,
    COUNT(*) as child_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Anonymous users CAN read children table'
        ELSE '❌ Anonymous users CANNOT read children table - RLS is blocking!'
    END as result
FROM public.children
WHERE id = 'f91c9458-6ffc-44e6-81a7-a74b851f1d99'::uuid;


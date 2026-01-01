-- =====================================================
-- Diagnostic Query: Check Child and Parent/Family Member Configuration
-- =====================================================
-- This query helps diagnose RLS issues by showing:
-- 1. Child information from both tables
-- 2. Parent/family member information
-- 3. Recent call records and their relationships
-- 4. Whether IDs match correctly
-- =====================================================

-- Get all children (old system)
SELECT 
    'Children (old system)' as source,
    id as child_id,
    name as child_name,
    parent_id,
    NULL as child_profile_id
FROM public.children
ORDER BY created_at DESC
LIMIT 10;

-- Get all child_profiles (new system)
SELECT 
    'Child Profiles (new system)' as source,
    id as child_id,
    name as child_name,
    NULL as parent_id,
    id as child_profile_id
FROM public.child_profiles
ORDER BY created_at DESC
LIMIT 10;

-- Get recent calls with full details
SELECT 
    c.id as call_id,
    c.caller_type,
    c.child_id,
    c.parent_id,
    c.family_member_id,
    c.recipient_type,
    c.status,
    c.answer IS NOT NULL as has_answer,
    c.created_at,
    -- Check if child_id exists in children table
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.children WHERE children.id = c.child_id) 
        THEN '✅ Found in children'
        ELSE '❌ NOT in children'
    END as child_in_children_table,
    -- Check if child_id exists in child_profiles table
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.child_profiles WHERE child_profiles.id = c.child_id) 
        THEN '✅ Found in child_profiles'
        ELSE '❌ NOT in child_profiles'
    END as child_in_child_profiles_table,
    -- Get child name if available
    COALESCE(
        (SELECT name FROM public.children WHERE children.id = c.child_id),
        (SELECT name FROM public.child_profiles WHERE child_profiles.id = c.child_id),
        'Unknown'
    ) as child_name,
    -- Get parent/family member name if available
    COALESCE(
        (SELECT name FROM public.parents WHERE parents.id = c.parent_id),
        (SELECT name FROM public.adult_profiles WHERE adult_profiles.user_id = c.parent_id AND adult_profiles.role = 'parent'),
        (SELECT name FROM public.adult_profiles WHERE adult_profiles.user_id = c.family_member_id AND adult_profiles.role = 'family_member'),
        (SELECT name FROM public.family_members WHERE family_members.id = c.family_member_id),
        'Unknown'
    ) as recipient_name
FROM public.calls c
ORDER BY c.created_at DESC
LIMIT 20;

-- Check RLS policies for calls table
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- Test: Can anon user read a specific call? (Replace 'YOUR_CALL_ID' with actual call ID)
-- Uncomment and run this with a specific call ID to test RLS
/*
SET ROLE anon;
SELECT 
    id,
    child_id,
    parent_id,
    family_member_id,
    caller_type,
    status,
    answer IS NOT NULL as has_answer
FROM public.calls
WHERE id = 'YOUR_CALL_ID_HERE';
RESET ROLE;
*/

-- =====================================================
-- Summary Query: Show most recent call with all relationships
-- =====================================================
SELECT 
    '=== MOST RECENT CALL ===' as info,
    c.id as call_id,
    c.caller_type,
    c.status,
    c.answer IS NOT NULL as has_answer,
    c.child_id,
    ch.name as child_name_from_children,
    cp.name as child_name_from_child_profiles,
    c.parent_id,
    c.family_member_id,
    c.recipient_type,
    CASE 
        WHEN c.child_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.children WHERE children.id = c.child_id) 
        THEN '✅ Child ID valid in children table'
        WHEN c.child_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.child_profiles WHERE child_profiles.id = c.child_id)
        THEN '✅ Child ID valid in child_profiles table'
        ELSE '❌ Child ID NOT FOUND in either table!'
    END as child_id_validation
FROM public.calls c
LEFT JOIN public.children ch ON ch.id = c.child_id
LEFT JOIN public.child_profiles cp ON cp.id = c.child_id
ORDER BY c.created_at DESC
LIMIT 1;


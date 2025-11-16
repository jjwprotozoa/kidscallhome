-- CREATE_MISSING_PARENT.sql
-- Create the missing parent record that children are referencing

-- =====================================================
-- STEP 1: Check if parent exists (should return empty)
-- =====================================================
SELECT 
    '📋 Parent Check' as info,
    id,
    name
FROM public.parents
WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid;

-- =====================================================
-- STEP 2: Check children that reference this parent
-- =====================================================
SELECT 
    '📋 Children Waiting for Parent' as info,
    COUNT(*) as children_count,
    parent_id
FROM public.children
WHERE parent_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
GROUP BY parent_id;

-- =====================================================
-- STEP 3: Create the missing parent record
-- =====================================================
-- Creating parent with name "Justin" and email "justwessels@gmail.com"
INSERT INTO public.parents (id, email, name)
VALUES ('70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid, 'justwessels@gmail.com', 'Justin')
ON CONFLICT (id) DO UPDATE SET name = 'Justin', email = 'justwessels@gmail.com';

-- =====================================================
-- STEP 4: Verify parent was created
-- =====================================================
SELECT 
    '✅ Parent Created' as info,
    id,
    email,
    name,
    created_at
FROM public.parents
WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid;

-- =====================================================
-- STEP 5: Test the function (should work now)
-- =====================================================
SELECT 
    '🧪 Function Test' as test_type,
    *
FROM public.get_parent_name_for_child('70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid);

-- =====================================================
-- STEP 6: Test direct query (should work now)
-- =====================================================
SELECT 
    '🧪 Direct Query Test' as test_type,
    id,
    name
FROM public.parents
WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid;

-- =====================================================
-- STEP 7: Verify data integrity (should show ✅ Match now)
-- =====================================================
SELECT 
    '🔍 Data Integrity Check' as info,
    c.id as child_id,
    c.name as child_name,
    c.parent_id as child_parent_id,
    p.id as parent_id,
    p.name as parent_name,
    CASE 
      WHEN c.parent_id = p.id THEN '✅ Match'
      ELSE '❌ Mismatch'
    END as match_status
FROM public.children c
LEFT JOIN public.parents p ON p.id = c.parent_id
WHERE c.parent_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid;


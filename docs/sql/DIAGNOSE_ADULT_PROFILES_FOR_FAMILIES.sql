-- Diagnostic SQL: Check adult_profiles for families query
-- Purpose: Verify why families query fails despite correct RLS policy
-- Run this in Supabase SQL Editor

-- =====================================================
-- STEP 1: Check if adult_profiles entry exists for parent
-- =====================================================
-- Replace with actual parent_id: '70888a10-ad5e-4764-8dff-537ad2da34d1'
SELECT 
    'Adult Profile Check' as check_type,
    id,
    user_id,
    family_id,
    role,
    name,
    CASE 
        WHEN family_id = user_id THEN 'family_id matches user_id ✓'
        WHEN family_id IS NULL THEN 'family_id is NULL ✗'
        ELSE 'family_id differs from user_id'
    END as family_id_status
FROM public.adult_profiles
WHERE user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
  AND role = 'parent';

-- =====================================================
-- STEP 2: Check if family_id matches families.id
-- =====================================================
SELECT 
    'Family ID Match Check' as check_type,
    ap.user_id,
    ap.family_id as adult_profile_family_id,
    f.id as families_id,
    CASE 
        WHEN ap.family_id = f.id THEN 'MATCH ✓'
        WHEN f.id IS NULL THEN 'Family record missing ✗'
        ELSE 'MISMATCH ✗'
    END as match_status
FROM public.adult_profiles ap
LEFT JOIN public.families f ON f.id = ap.family_id
WHERE ap.user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
  AND ap.role = 'parent';

-- =====================================================
-- STEP 3: Test policy evaluation manually
-- =====================================================
-- Simulate what the policy would check
SELECT 
    'Policy Evaluation Test' as check_type,
    f.id as family_id,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.adult_profiles ap
            WHERE ap.user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
              AND ap.family_id = f.id
        ) THEN 'ALLOWED (via adult_profiles) ✓'
        WHEN f.id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid THEN 'ALLOWED (direct match) ✓'
        ELSE 'BLOCKED ✗'
    END as policy_result,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.adult_profiles ap
            WHERE ap.user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
              AND ap.family_id = f.id
        ) THEN 'adult_profiles match'
        WHEN f.id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid THEN 'direct id match'
        ELSE 'no match found'
    END as match_method
FROM public.families f
WHERE f.id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid;

-- =====================================================
-- STEP 4: Check adult_profiles RLS policies
-- =====================================================
-- The families policy subquery needs to read from adult_profiles
-- If adult_profiles RLS blocks this, the families query will fail
SELECT 
    'Adult Profiles RLS Policies' as check_type,
    policyname,
    cmd as command,
    roles,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'adult_profiles'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- =====================================================
-- STEP 5: Fix adult_profiles if needed
-- =====================================================
-- If adult_profiles entry is missing or has wrong family_id, fix it
-- This is safe to run - it only updates if needed
UPDATE public.adult_profiles
SET family_id = user_id
WHERE user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
  AND role = 'parent'
  AND (family_id IS NULL OR family_id != user_id);

-- Verify the update
SELECT 
    'After Fix' as check_type,
    id,
    user_id,
    family_id,
    CASE 
        WHEN family_id = user_id THEN 'CORRECT ✓'
        ELSE 'STILL WRONG ✗'
    END as status
FROM public.adult_profiles
WHERE user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
  AND role = 'parent';






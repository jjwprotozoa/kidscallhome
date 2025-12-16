-- Diagnostic SQL: Inspect RLS Policy on families table
-- Purpose: Verify why parents can't query their family record
-- Run this in Supabase SQL Editor

-- =====================================================
-- STEP 1: Check if RLS is enabled on families table
-- =====================================================
SELECT 
    'RLS Status' as check_type,
    relname as table_name,
    relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'families' 
  AND relnamespace = 'public'::regnamespace;

-- =====================================================
-- STEP 2: List all RLS policies on families table
-- =====================================================
SELECT 
    'Policy List' as check_type,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'families'
ORDER BY cmd, policyname;

-- =====================================================
-- STEP 3: Check if family record exists for parent
-- =====================================================
-- Replace with actual parent_id from your investigation
-- parent_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'
SELECT 
    'Family Record Check' as check_type,
    id as family_id,
    name,
    safety_mode_enabled,
    created_at
FROM public.families
WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid;

-- =====================================================
-- STEP 4: Check if adult_profiles entry exists
-- =====================================================
SELECT 
    'Adult Profile Check' as check_type,
    id,
    user_id,
    family_id,
    role,
    name
FROM public.adult_profiles
WHERE user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
  AND role = 'parent';

-- =====================================================
-- STEP 5: Test policy evaluation (simulate auth.uid())
-- =====================================================
-- This shows what the policy would evaluate to
-- Note: This is a simulation - actual RLS uses auth.uid() from JWT
SELECT 
    'Policy Simulation' as check_type,
    f.id as family_id,
    f.name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.adult_profiles ap
            WHERE ap.user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
              AND ap.family_id = f.id
        ) THEN 'ALLOWED (via adult_profiles)'
        WHEN f.id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid THEN 'ALLOWED (direct match)'
        ELSE 'BLOCKED'
    END as policy_result
FROM public.families f
WHERE f.id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid;

-- =====================================================
-- STEP 6: Check if family record needs to be created
-- =====================================================
-- If no family record exists, we may need to create one
SELECT 
    'Family Record Exists' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'MISSING - Need to create family record'
        ELSE 'EXISTS'
    END as status
FROM public.families
WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid;


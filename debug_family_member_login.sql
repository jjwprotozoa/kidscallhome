-- Diagnostic SQL: Check family member login issue for jjwprotozoa@gmail.com
-- Purpose: Verify if family_members record exists and what its id field is
-- Run this in Supabase SQL Editor with service_role or as the parent

-- =====================================================
-- STEP 1: Check auth.users for the email
-- =====================================================
SELECT 
    'Auth User Check' as check_type,
    id as auth_user_id,
    email,
    email_confirmed_at,
    created_at,
    raw_user_meta_data
FROM auth.users
WHERE email = 'jjwprotozoa@gmail.com';

-- =====================================================
-- STEP 2: Check family_members table for the email
-- =====================================================
SELECT 
    'Family Member Record Check' as check_type,
    id as family_member_id,
    parent_id,
    email,
    name,
    relationship,
    status,
    invitation_token,
    invitation_sent_at,
    invitation_accepted_at,
    created_at,
    updated_at,
    CASE 
        WHEN id IS NULL THEN '❌ NULL - Needs linking'
        WHEN id = '6c5af736-7a4f-4923-b7b8-7fece5143c4d'::uuid THEN '✅ Linked correctly'
        ELSE '⚠️ Linked to different user: ' || id::text
    END as id_status
FROM public.family_members
WHERE LOWER(email) = LOWER('jjwprotozoa@gmail.com');

-- =====================================================
-- STEP 3: Check if parent exists and can view this family member
-- =====================================================
SELECT 
    'Parent Check' as check_type,
    p.id as parent_id,
    p.email as parent_email,
    p.name as parent_name,
    fm.id as family_member_id,
    fm.email as family_member_email,
    fm.name as family_member_name,
    fm.status,
    CASE 
        WHEN fm.id IS NULL THEN '❌ Family member id is NULL'
        WHEN fm.id = '6c5af736-7a4f-4923-b7b8-7fece5143c4d'::uuid THEN '✅ Family member id matches auth user'
        ELSE '⚠️ Family member id does not match auth user'
    END as link_status
FROM public.family_members fm
LEFT JOIN public.parents p ON p.id = fm.parent_id
WHERE LOWER(fm.email) = LOWER('jjwprotozoa@gmail.com');

-- =====================================================
-- STEP 4: Test the RPC function (if migration has been run)
-- =====================================================
-- This will show what the function would return
-- Note: This requires the function to exist (from migration 20251215000004)
SELECT 
    'RPC Function Test' as check_type,
    public.link_family_member_by_email(
        'jjwprotozoa@gmail.com',
        '6c5af736-7a4f-4923-b7b8-7fece5143c4d'::uuid
    ) as function_result;

-- =====================================================
-- STEP 5: Check adult_profiles (if family member should have one)
-- =====================================================
SELECT 
    'Adult Profile Check' as check_type,
    ap.id,
    ap.user_id,
    ap.family_id,
    ap.role,
    ap.name,
    ap.email,
    CASE 
        WHEN ap.user_id = '6c5af736-7a4f-4923-b7b8-7fece5143c4d'::uuid THEN '✅ User ID matches'
        WHEN ap.user_id IS NULL THEN '❌ User ID is NULL'
        ELSE '⚠️ User ID does not match'
    END as user_id_status
FROM public.adult_profiles ap
WHERE ap.email = 'jjwprotozoa@gmail.com'
   OR ap.user_id = '6c5af736-7a4f-4923-b7b8-7fece5143c4d'::uuid;

-- =====================================================
-- Summary and Recommendations
-- =====================================================
-- After running these queries, you should see:
-- 1. If auth.users has the email → ✅ User can authenticate
-- 2. If family_members has the email:
--    - id = NULL → Run the RPC function to link it
--    - id = 6c5af736... → ✅ Already linked correctly
--    - id = different UUID → ⚠️ Linked to wrong account, needs manual fix
--    - No record → ❌ Family member not invited/created yet
-- 3. If adult_profiles exists → ✅ Profile created
-- 4. If RPC function works → ✅ Can auto-link during login


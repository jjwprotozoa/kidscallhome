-- Diagnostic: Check if family member has proper auth.users setup
-- Purpose: Verify that the family member can actually authenticate (like parents do)
-- Run this in Supabase SQL Editor

-- =====================================================
-- STEP 1: Check if auth.users record exists
-- =====================================================
SELECT 
    'Auth Users Check' as check_type,
    u.id as auth_user_id,
    u.email,
    u.email_confirmed_at,
    u.created_at,
    u.last_sign_in_at,
    u.raw_user_meta_data->>'role' as metadata_role,
    u.raw_user_meta_data->>'name' as metadata_name,
    CASE 
        WHEN u.id IS NOT NULL THEN '✅ Auth user exists'
        ELSE '❌ No auth user found'
    END as auth_status,
    CASE 
        WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Email confirmed'
        ELSE '⚠️ Email not confirmed'
    END as email_status
FROM auth.users u
WHERE u.email = 'jjwprotozoa@gmail.com';

-- =====================================================
-- STEP 2: Compare with parent auth setup (for reference)
-- =====================================================
-- This shows how a parent's auth is set up (for comparison)
SELECT 
    'Parent Auth Example' as check_type,
    u.id as auth_user_id,
    u.email,
    u.email_confirmed_at,
    u.raw_user_meta_data->>'role' as metadata_role,
    p.id as parent_id,
    CASE 
        WHEN p.id IS NOT NULL THEN '✅ Parent record exists'
        ELSE '❌ No parent record'
    END as parent_status
FROM auth.users u
LEFT JOIN public.parents p ON p.id = u.id
WHERE u.email = 'justwessels@gmail.com'  -- Replace with actual parent email
LIMIT 1;

-- =====================================================
-- STEP 3: Verify family member auth matches database records
-- =====================================================
SELECT 
    'Complete Setup Check' as check_type,
    u.id as auth_user_id,
    u.email as auth_email,
    u.email_confirmed_at,
    fm.id as family_member_id,
    fm.email as family_member_email,
    fm.status as family_member_status,
    ap.id as adult_profile_id,
    ap.role as adult_profile_role,
    CASE 
        WHEN u.id IS NULL THEN '❌ Missing: auth.users record'
        WHEN fm.id IS NULL THEN '❌ Missing: family_members record'
        WHEN ap.id IS NULL THEN '❌ Missing: adult_profiles record'
        WHEN u.id != fm.id THEN '❌ Mismatch: auth.id != family_members.id'
        WHEN u.id != ap.user_id THEN '❌ Mismatch: auth.id != adult_profiles.user_id'
        WHEN u.email_confirmed_at IS NULL THEN '⚠️ Warning: Email not confirmed'
        WHEN fm.status != 'active' THEN '⚠️ Warning: Status is ' || fm.status
        ELSE '✅ Complete setup - Ready for login'
    END as setup_status
FROM auth.users u
LEFT JOIN public.family_members fm ON fm.id = u.id
LEFT JOIN public.adult_profiles ap ON ap.user_id = u.id AND ap.role = 'family_member'
WHERE u.email = 'jjwprotozoa@gmail.com';

-- =====================================================
-- STEP 4: Check authentication providers
-- =====================================================
-- This shows what authentication methods are available
SELECT 
    'Auth Providers' as check_type,
    u.id,
    u.email,
    u.raw_app_meta_data->>'provider' as provider,
    u.raw_app_meta_data->>'providers' as providers,
    CASE 
        WHEN u.raw_app_meta_data->>'provider' = 'email' THEN '✅ Email auth enabled'
        ELSE '⚠️ Provider: ' || (u.raw_app_meta_data->>'provider')
    END as provider_status
FROM auth.users u
WHERE u.email = 'jjwprotozoa@gmail.com';

-- =====================================================
-- Summary and Recommendations
-- =====================================================
-- If auth.users record is missing:
--   1. The user needs to sign up through the invitation flow
--   2. Or you can create it manually (not recommended, but possible)
--   3. The invitation flow should create the auth.users record when they accept
--
-- If auth.users exists but email_confirmed_at is NULL:
--   1. User needs to confirm their email
--   2. Or disable email confirmation in Supabase settings (dev only)
--   3. Or manually confirm: UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = '...'
--
-- If everything exists and matches:
--   ✅ User should be able to log in at /family-member/auth


-- Fix: Link family_members record to auth user for jjwprotozoa@gmail.com
-- Purpose: Manually link the family_members.id to match the auth user ID
-- Use this if the RPC function doesn't work or if you need to fix it immediately
-- 
-- IMPORTANT: Run this with service_role or as the parent who created the invitation
-- Replace the email and UUIDs with the actual values if different

-- =====================================================
-- STEP 1: Check current state
-- =====================================================
SELECT 
    'Current State' as check_type,
    fm.id as current_family_member_id,
    fm.email,
    fm.status,
    '6c5af736-7a4f-4923-b7b8-7fece5143c4d'::uuid as target_auth_user_id,
    CASE 
        WHEN fm.id IS NULL THEN '❌ NULL - Will link'
        WHEN fm.id = '6c5af736-7a4f-4923-b7b8-7fece5143c4d'::uuid THEN '✅ Already linked'
        ELSE '⚠️ Linked to different user - Will update'
    END as action
FROM public.family_members fm
WHERE LOWER(fm.email) = LOWER('jjwprotozoa@gmail.com');

-- =====================================================
-- STEP 2: Update family_members to link to auth user
-- =====================================================
-- This updates the id field to match the auth user ID
UPDATE public.family_members
SET 
    id = '6c5af736-7a4f-4923-b7b8-7fece5143c4d'::uuid,
    status = CASE 
        WHEN status = 'pending' THEN 'active'
        ELSE status
    END,
    invitation_accepted_at = COALESCE(invitation_accepted_at, NOW()),
    updated_at = NOW()
WHERE LOWER(email) = LOWER('jjwprotozoa@gmail.com')
  AND (id IS NULL OR id != '6c5af736-7a4f-4923-b7b8-7fece5143c4d'::uuid);

-- =====================================================
-- STEP 3: Verify the update
-- =====================================================
SELECT 
    'Verification' as check_type,
    fm.id as family_member_id,
    fm.email,
    fm.status,
    fm.invitation_accepted_at,
    CASE 
        WHEN fm.id = '6c5af736-7a4f-4923-b7b8-7fece5143c4d'::uuid THEN '✅ Successfully linked'
        ELSE '❌ Still not linked'
    END as link_status
FROM public.family_members fm
WHERE LOWER(fm.email) = LOWER('jjwprotozoa@gmail.com');

-- =====================================================
-- STEP 4: Verify adult_profiles matches
-- =====================================================
SELECT 
    'Adult Profile Verification' as check_type,
    ap.user_id,
    ap.email,
    ap.role,
    fm.id as family_member_id,
    CASE 
        WHEN ap.user_id = fm.id THEN '✅ IDs match'
        ELSE '❌ IDs do not match'
    END as match_status
FROM public.adult_profiles ap
LEFT JOIN public.family_members fm ON fm.email = ap.email
WHERE ap.email = 'jjwprotozoa@gmail.com';


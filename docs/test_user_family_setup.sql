-- Diagnostic queries for user: 70888a10-ad5e-4764-8dff-537ad2da34d1
-- Run these to diagnose the family setup error

-- 1. Check if all records exist
SELECT 
  'parents' as table_name,
  COUNT(*) as record_count,
  (SELECT email FROM public.parents WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1') as email
FROM public.parents 
WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1'
UNION ALL
SELECT 
  'families' as table_name,
  COUNT(*) as record_count,
  (SELECT household_type::text FROM public.families WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1') as email
FROM public.families 
WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1'
UNION ALL
SELECT 
  'adult_profiles' as table_name,
  COUNT(*) as record_count,
  (SELECT family_id::text FROM public.adult_profiles 
   WHERE user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1' 
   AND role = 'parent' LIMIT 1) as email
FROM public.adult_profiles 
WHERE user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1' 
  AND role = 'parent' 
  AND family_id = '70888a10-ad5e-4764-8dff-537ad2da34d1';

-- 2. Test RLS policy conditions
SELECT 
  -- Condition 1: adult_profiles check (preferred method)
  EXISTS (
    SELECT 1 FROM public.adult_profiles ap
    WHERE ap.user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'
      AND ap.family_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'
      AND ap.role = 'parent'
  ) as condition1_adult_profile_match,
  
  -- Condition 2: direct family id match (fallback)
  EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = '70888a10-ad5e-4764-8dff-537ad2da34d1'
  ) as condition2_family_exists,
  
  -- Current household_type
  (SELECT household_type FROM public.families WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1') as current_household_type,
  
  -- Verify adult_profiles family_id matches user_id
  (SELECT family_id::text FROM public.adult_profiles 
   WHERE user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1' AND role = 'parent' LIMIT 1) as adult_profile_family_id,
  
  -- Verify family id matches user id
  (SELECT id::text FROM public.families WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1') as family_id;

-- 3. Check adult_profiles details
SELECT 
  user_id::text,
  family_id::text,
  role,
  name,
  email,
  CASE 
    WHEN user_id = family_id THEN '✅ Matches user_id'
    ELSE '❌ Does NOT match user_id'
  END as family_id_check
FROM public.adult_profiles 
WHERE user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1' 
  AND role = 'parent';

-- 4. Check families table details
SELECT 
  id::text,
  household_type,
  invite_code,
  created_at,
  name as family_name
FROM public.families 
WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1';

-- 5. Check RLS policies
SELECT 
  policyname,
  cmd,
  roles,
  qual as using_clause,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'families'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- 6. Test UPDATE (run this as the authenticated user, not as admin)
-- This will show if the RLS policy allows the update
-- NOTE: This must be run as the authenticated user (auth.uid() must match the user_id)
-- If you're running as admin, this will always work. Run from the app instead.
UPDATE public.families
SET household_type = 'single'  -- Try the value they're selecting
WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1'
RETURNING id, household_type;

-- 7. Check if there are any constraints on household_type
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.families'::regclass
  AND conname LIKE '%household%';

-- 8. CRITICAL: Check if adult_profiles.family_id matches user_id
-- This is the most common cause of RLS policy failures
SELECT 
  'Data Consistency Check' as check_type,
  (SELECT COUNT(*) FROM public.adult_profiles 
   WHERE user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1' 
   AND role = 'parent' 
   AND family_id = '70888a10-ad5e-4764-8dff-537ad2da34d1') as matching_records,
  (SELECT COUNT(*) FROM public.adult_profiles 
   WHERE user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1' 
   AND role = 'parent') as total_parent_profiles,
  CASE 
    WHEN (SELECT family_id FROM public.adult_profiles 
          WHERE user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1' 
          AND role = 'parent' LIMIT 1) = '70888a10-ad5e-4764-8dff-537ad2da34d1'
    THEN '✅ family_id matches user_id'
    ELSE '❌ family_id does NOT match user_id - THIS IS THE PROBLEM!'
  END as status;

-- 9. Check for triggers on families table that might block updates
SELECT 
  tgname as trigger_name,
  tgtype::text as trigger_type,
  tgenabled as is_enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'public.families'::regclass
  AND tgisinternal = false
ORDER BY tgname;

-- 10. Check current authentication context (if running as the user)
-- This will show what auth.uid() returns
-- NOTE: This only works if you're authenticated as that user
SELECT 
  auth.uid() as current_user_id,
  '70888a10-ad5e-4764-8dff-537ad2da34d1' as expected_user_id,
  CASE 
    WHEN auth.uid() = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
    THEN '✅ User is authenticated correctly'
    WHEN auth.uid() IS NULL
    THEN '❌ User is NOT authenticated (auth.uid() is NULL)'
    ELSE '❌ User is authenticated as different user'
  END as auth_status;

-- 11. Test the RLS policy conditions directly
-- This simulates what the policy checks
SELECT 
  -- Condition 1: Check through adult_profiles
  EXISTS (
    SELECT 1 FROM public.adult_profiles ap
    WHERE ap.user_id = auth.uid()
      AND ap.family_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
      AND ap.role = 'parent'
  ) as condition1_adult_profile_check,
  
  -- Condition 2: Direct family id match
  ('70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid = auth.uid()) as condition2_direct_match,
  
  -- Combined (either condition should be true)
  (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
        AND ap.role = 'parent'
    )
    OR
    ('70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid = auth.uid())
  ) as rls_policy_will_allow_update;


# Diagnosing "Failed to save family setup" Error

## Quick Diagnostic Queries

Run these queries to diagnose the issue for a specific user:

### 1. Check if records exist for a user

```sql
-- Replace 'USER_ID_HERE' with the actual user ID
SELECT 
  'parents' as table_name,
  COUNT(*) as record_count
FROM public.parents 
WHERE id = 'USER_ID_HERE'
UNION ALL
SELECT 
  'families' as table_name,
  COUNT(*) as record_count
FROM public.families 
WHERE id = 'USER_ID_HERE'
UNION ALL
SELECT 
  'adult_profiles' as table_name,
  COUNT(*) as record_count
FROM public.adult_profiles 
WHERE user_id = 'USER_ID_HERE' 
  AND role = 'parent' 
  AND family_id = 'USER_ID_HERE';
```

### 2. Check RLS policies

```sql
-- Check all UPDATE policies on families table
SELECT 
  policyname,
  cmd,
  qual as using_clause,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'families'
  AND cmd = 'UPDATE';
```

### 3. Test if user can update their family

```sql
-- Replace 'USER_ID_HERE' with the actual user ID
-- This simulates what the RLS policy checks
SELECT 
  EXISTS (
    SELECT 1 FROM public.adult_profiles ap
    WHERE ap.user_id = 'USER_ID_HERE'
      AND ap.family_id = 'USER_ID_HERE'
      AND ap.role = 'parent'
  ) as has_adult_profile,
  EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = 'USER_ID_HERE'
  ) as has_family_record;
```

## Common Issues and Solutions

### Issue 1: Records don't exist

**Symptom**: Query 1 shows 0 records for families or adult_profiles

**Solution**: The trigger may not have run. Check:

- Is the trigger attached to the auth.users table?
- Did the signup complete successfully?

**Fix**: Run the backfill queries from the migration manually:

```sql
-- Create family if missing
INSERT INTO public.families (id, invite_code, household_type, created_at)
SELECT 
    p.id,
    COALESCE(p.family_code, 'FAM-' || REPLACE(p.id::text, '-', '')),
    'single',
    NOW()
FROM public.parents p
WHERE p.id = 'USER_ID_HERE'
  AND NOT EXISTS (SELECT 1 FROM public.families f WHERE f.id = p.id)
ON CONFLICT (id) DO NOTHING;

-- Create adult_profiles if missing
INSERT INTO public.adult_profiles (
    user_id, family_id, role, relationship_type, name, email
)
SELECT 
    p.id,
    p.id,
    'parent',
    NULL,
    COALESCE(p.name, ''),
    p.email
FROM public.parents p
WHERE p.id = 'USER_ID_HERE'
  AND NOT EXISTS (
    SELECT 1 FROM public.adult_profiles ap 
    WHERE ap.user_id = p.id 
    AND ap.role = 'parent'
    AND ap.family_id = p.id
  )
ON CONFLICT (user_id, family_id, role) DO NOTHING;
```

### Issue 2: RLS policy not matching

**Symptom**: Query 2 shows policies exist, but Query 3 shows false

**Solution**: The RLS policy conditions aren't matching. Check:

- Does the adult_profiles record have the correct family_id?
- Is the user authenticated when making the request?

### Issue 3: Timing/Race condition

**Symptom**: Records exist but update still fails intermittently

**Solution**: The component now has retry logic. If it still fails:

- Check browser console for detailed error messages
- Verify the user is authenticated (auth.uid() matches the user_id)
- Check if there are any database constraints preventing the update

## Manual Fix for Stuck Users

If a user is stuck and can't complete family setup:

```sql
-- 1. Ensure all records exist
-- (Run the backfill queries from Issue 1)

-- 2. Manually set household_type if needed
UPDATE public.families
SET household_type = 'single'  -- or 'two_household'
WHERE id = 'USER_ID_HERE';

-- 3. Verify the update worked
SELECT id, household_type, invite_code 
FROM public.families 
WHERE id = 'USER_ID_HERE';
```



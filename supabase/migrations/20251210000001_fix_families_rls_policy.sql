-- Migration: Fix Families Table RLS Policy
-- Purpose: Ensure parents can query their family record for safety mode settings
-- Date: 2025-12-10
-- 
-- Issue: 406 error when querying families table - RLS policy requires adult_profiles
-- but the query uses parent user ID directly. Need to ensure policy works correctly.

-- =====================================================
-- STEP 1: Verify RLS is enabled on families table
-- =====================================================
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Drop existing SELECT policy
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view families." ON public.families;

-- =====================================================
-- STEP 3: Create improved policy that handles both cases
-- =====================================================
-- This policy allows:
-- 1. Users with adult_profiles entry matching family_id
-- 2. Direct match if family_id equals user_id (for backward compatibility)
CREATE POLICY "Authenticated users can view families."
  ON public.families FOR SELECT
  TO authenticated
  USING (
    -- Check through adult_profiles (preferred method)
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = families.id
    )
    OR
    -- Fallback: Direct match for backward compatibility
    -- (Some families might use parent user_id as family_id)
    families.id = auth.uid()
  );

-- =====================================================
-- STEP 4: Ensure family records exist for existing parents
-- =====================================================
-- Create family records for parents who don't have one yet
-- Use their user_id as the family_id (backward compatibility)
INSERT INTO public.families (id, invite_code, household_type, created_at)
SELECT 
    p.id as id,
    COALESCE(p.family_code, 'FAM-' || SUBSTRING(p.id::text, 1, 8)) as invite_code,
    'single' as household_type,
    COALESCE(p.created_at, NOW()) as created_at
FROM public.parents p
WHERE NOT EXISTS (
    SELECT 1 FROM public.families f WHERE f.id = p.id
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STEP 5: Ensure adult_profiles have correct family_id
-- =====================================================
-- Update adult_profiles to use parent's user_id as family_id if not set
UPDATE public.adult_profiles ap
SET family_id = ap.user_id
WHERE ap.role = 'parent'
  AND ap.family_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.parents p WHERE p.id = ap.user_id
  );

-- =====================================================
-- STEP 6: Verify policy was created
-- =====================================================
SELECT 
    'Families Table RLS Policy' as info,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN qual IS NULL THEN 'NULL (permissive)'
        ELSE 'HAS USING CLAUSE'
    END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'families'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- =====================================================
-- Migration complete
-- =====================================================
-- After running this migration:
-- 1. Parents should be able to SELECT their family record
-- 2. Works with both adult_profiles-based and direct user_id matching
-- 3. Family records are created for existing parents if missing
-- 
-- To verify:
-- 1. Log in as parent
-- 2. Query: SELECT * FROM families WHERE id = '<parent_id>';
-- 3. Should return the family record


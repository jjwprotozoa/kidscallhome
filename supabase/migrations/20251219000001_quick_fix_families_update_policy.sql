-- Quick Fix: Add UPDATE policy for families table
-- Purpose: Allow parents to update their own family's household_type
-- Date: 2025-12-19
-- 
-- This is a standalone fix if STEP 4 of the main migration didn't run
-- Run this if the UPDATE policy is missing

-- Drop existing UPDATE policy if it exists (safe - only affects permissions)
DROP POLICY IF EXISTS "Parents can update their own family" ON public.families;

-- Create policy for parents to update their own family
CREATE POLICY "Parents can update their own family"
  ON public.families FOR UPDATE
  TO authenticated
  USING (
    -- Check through adult_profiles (preferred method)
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = families.id
        AND ap.role = 'parent'
    )
    OR
    -- Fallback: Direct match for backward compatibility
    families.id = auth.uid()
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = families.id
        AND ap.role = 'parent'
    )
    OR
    families.id = auth.uid()
  );

-- Verify the policy was created
SELECT 
  'UPDATE policy check' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ UPDATE policy MISSING'
    ELSE '✅ UPDATE policy exists'
  END as status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'families'
  AND policyname = 'Parents can update their own family'
  AND cmd = 'UPDATE';





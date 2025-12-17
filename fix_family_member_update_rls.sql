-- =====================================================
-- CRITICAL FIX: Allow Family Members to UPDATE Calls
-- =====================================================
-- Issue: Family members cannot UPDATE calls with answer
-- Root Cause: No UPDATE policy exists for authenticated users (parents/family members)
-- Solution: Create UPDATE policy for authenticated users where they are recipients
-- =====================================================

-- Drop existing policy if it exists (in case we need to recreate it)
DROP POLICY IF EXISTS "Parents and family members can update calls where they are recipients" ON public.calls;

-- Create UPDATE policy for parents and family members
-- This allows them to update calls where they are the recipient (parent_id or family_member_id matches)
CREATE POLICY "Parents and family members can update calls where they are recipients"
ON public.calls
FOR UPDATE
TO authenticated
USING (
  -- Parent can update calls where they are the recipient
  (parent_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.adult_profiles ap
    WHERE ap.user_id = auth.uid()
      AND ap.role = 'parent'
  ))
  OR
  -- Family member can update calls where they are the recipient
  (family_member_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.adult_profiles ap
    WHERE ap.user_id = auth.uid()
      AND ap.role = 'family_member'
  ))
  OR
  -- Also support legacy family_members table
  (family_member_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.id = auth.uid()
      AND fm.status = 'active'
  ))
)
WITH CHECK (
  -- Same conditions for WITH CHECK
  (parent_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.adult_profiles ap
    WHERE ap.user_id = auth.uid()
      AND ap.role = 'parent'
  ))
  OR
  (family_member_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.adult_profiles ap
    WHERE ap.user_id = auth.uid()
      AND ap.role = 'family_member'
  ))
  OR
  (family_member_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.id = auth.uid()
      AND fm.status = 'active'
  ))
);

-- Verify the policy was created
SELECT 
    'UPDATE Policy for Authenticated Users' as info,
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'calls'
  AND cmd = 'UPDATE'
  AND policyname = 'Parents and family members can update calls where they are recipients'
ORDER BY policyname;

-- =====================================================
-- Fix Applied!
-- =====================================================
-- This should now allow:
-- 1. ✅ Parents can UPDATE calls where parent_id matches their user_id
-- 2. ✅ Family members can UPDATE calls where family_member_id matches their user_id
-- 3. ✅ Family members can now save the answer when they answer a child's call
-- =====================================================



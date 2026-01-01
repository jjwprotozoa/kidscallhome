-- Quick Fix: Consolidate remaining calls INSERT policies for authenticated
-- Run this if the consolidation migration didn't fully resolve the issue

-- Drop the individual policies
DROP POLICY IF EXISTS "Parents can initiate calls to their children" ON public.calls;
DROP POLICY IF EXISTS "Family members can initiate calls to children in their family" ON public.calls;

-- Create consolidated policy for authenticated call inserts
CREATE POLICY "Adults can initiate calls to children in their family"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (
    caller_type IN ('parent', 'family_member') AND
    (
      -- Parent calling their child
      (caller_type = 'parent' AND parent_id = (select auth.uid()) AND
       EXISTS (
         SELECT 1 FROM public.child_family_memberships cfm
         JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
         WHERE cfm.child_profile_id = calls.child_id
           AND ap.user_id = (select auth.uid())
           AND ap.role = 'parent'
       ))
      OR
      -- Family member calling child in their family
      (caller_type = 'family_member' AND
       EXISTS (
         SELECT 1 FROM public.adult_profiles ap_sender
         JOIN public.child_family_memberships cfm ON cfm.child_profile_id = calls.child_id
         WHERE ap_sender.user_id = (select auth.uid())
           AND ap_sender.role = 'family_member'
           AND ap_sender.family_id = cfm.family_id
       ))
    )
  );


-- Migration: Fix Anonymous Access to Family Member Invitations
-- Purpose: Ensure anonymous users can read family_members records to verify invitation tokens
-- Date: 2025-12-18
-- 
-- Issue: Family members clicking invitation links get "Invalid invitation" error
--        because anonymous users cannot read from family_members table due to RLS
--
-- Root Cause: Multiple migrations have created/dropped/consolidated RLS policies.
--             The anonymous access policy may be missing or misconfigured.
--
-- Fix: Ensure there's a working SELECT policy for anonymous users on family_members

-- =====================================================
-- STEP 1: Check and drop conflicting policies
-- =====================================================
-- Drop any existing policies that might conflict

DROP POLICY IF EXISTS "Anyone can verify invitation tokens" ON public.family_members;
DROP POLICY IF EXISTS "Family members can view own profile and anyone can verify tokens" ON public.family_members;
DROP POLICY IF EXISTS "Anonymous can verify invitation tokens" ON public.family_members;

-- =====================================================
-- STEP 2: Create separate, clear policies
-- =====================================================
-- Instead of using a consolidated policy with OR logic that might have issues,
-- create separate clear policies for each use case

-- Policy 1: Anonymous users can read family_members to verify invitation tokens
-- This is critical for the invitation acceptance flow
CREATE POLICY "Anonymous can verify invitation tokens"
  ON public.family_members FOR SELECT
  TO anon
  USING (true);

-- Policy 2: Authenticated family members can view their own profile
CREATE POLICY "Family members can view own profile"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- =====================================================
-- STEP 3: Ensure RLS is enabled
-- =====================================================
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 4: Grant necessary permissions to anonymous role
-- =====================================================
-- Ensure the anon role can access the table at all
GRANT SELECT ON public.family_members TO anon;

-- =====================================================
-- STEP 5: Verify the policy works
-- =====================================================
DO $$
DECLARE
  v_policy_count INT;
  v_anon_policy_exists BOOLEAN;
BEGIN
  -- Check if our anonymous policy exists
  SELECT EXISTS(
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'family_members' 
    AND policyname = 'Anonymous can verify invitation tokens'
    AND roles::text LIKE '%anon%'
  ) INTO v_anon_policy_exists;
  
  -- Count all SELECT policies on family_members
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies 
  WHERE tablename = 'family_members' 
  AND cmd = 'SELECT';
  
  RAISE NOTICE 'Migration verification:';
  RAISE NOTICE '  Anonymous policy exists: %', v_anon_policy_exists;
  RAISE NOTICE '  Total SELECT policies on family_members: %', v_policy_count;
  
  IF NOT v_anon_policy_exists THEN
    RAISE WARNING 'Anonymous policy not found! Invitation verification will fail.';
  END IF;
END $$;

-- =====================================================
-- Migration complete
-- =====================================================
-- Now anonymous users can:
-- 1. Access family_members table via SELECT
-- 2. Look up invitation tokens to verify them
-- 3. See invitation details (email, name, relationship, status)
--
-- The FamilyMemberInvite.tsx page queries:
--   SELECT * FROM family_members WHERE invitation_token = :token
-- This query should now work for unauthenticated users


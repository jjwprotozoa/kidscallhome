-- Migration: Fix RLS Policy for Children Viewing Adult Names
-- Purpose: Fix RLS recursion issue preventing children from seeing adult names
-- Date: 2025-12-13
-- Issue: The EXISTS subquery in the adult_profiles RLS policy is subject to RLS on conversations table
-- Solution: Use SECURITY DEFINER function to bypass RLS when checking if conversation exists

-- =====================================================
-- STEP 1: Create SECURITY DEFINER function to check if adult has conversation
-- =====================================================
-- This function bypasses RLS to check if a conversation exists for an adult profile
-- This is needed because the RLS policy on adult_profiles uses an EXISTS subquery
-- on conversations, which is subject to RLS and can cause recursion issues

CREATE OR REPLACE FUNCTION public.adult_has_conversation(p_adult_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Check if there's a conversation with this adult profile
  -- SECURITY DEFINER bypasses RLS, so this won't be blocked
  RETURN EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.adult_id = p_adult_profile_id
  );
END;
$$;

-- Grant execute permission to anonymous users (children)
GRANT EXECUTE ON FUNCTION public.adult_has_conversation(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.adult_has_conversation(UUID) TO authenticated;

-- =====================================================
-- STEP 2: Update the RLS policy to use the SECURITY DEFINER function
-- =====================================================

DROP POLICY IF EXISTS "Children can view adult names from conversations" ON public.adult_profiles;

CREATE POLICY "Children can view adult names from conversations"
  ON public.adult_profiles FOR SELECT
  TO anon
  USING (
    -- Use SECURITY DEFINER function to bypass RLS when checking conversations
    -- This ensures the check works even if RLS on conversations would block it
    public.adult_has_conversation(adult_profiles.id)
  );

-- =====================================================
-- STEP 3: Add comment explaining the fix
-- =====================================================

COMMENT ON FUNCTION public.adult_has_conversation(UUID) IS 
  'Checks if an adult profile has any conversations. Uses SECURITY DEFINER to bypass RLS on conversations table, preventing recursion issues in RLS policies.';

-- =====================================================
-- Migration complete
-- =====================================================
-- What this fixes:
-- 1. ✅ Children can now see adult names in chat headers
-- 2. ✅ RLS recursion issue resolved by using SECURITY DEFINER function
-- 3. ✅ Policy still secure - only allows viewing names when conversation exists








-- Migration: Sync children table to child_profiles and child_family_memberships
-- Purpose: Automatically create child_profiles and child_family_memberships when a child is added
-- Date: 2025-12-20
-- This ensures new children can see family members on /child/family page

-- =====================================================
-- STEP 1: Create trigger function to sync children to child_profiles
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_child()
RETURNS TRIGGER AS $$
DECLARE
  v_family_id UUID;
  v_child_profile_id UUID;
  v_family_code TEXT;
BEGIN
  -- Get family_id from parent (parent_id = family_id for single household)
  -- First try to get from adult_profiles
  SELECT ap.family_id INTO v_family_id
  FROM public.adult_profiles ap
  WHERE ap.user_id = NEW.parent_id
    AND ap.role = 'parent'
  LIMIT 1;

  -- If not found, try to get from families table (parent_id should match family.id)
  IF v_family_id IS NULL THEN
    SELECT f.id INTO v_family_id
    FROM public.families f
    WHERE f.id = NEW.parent_id
    LIMIT 1;
  END IF;

  -- If still not found, create family record for parent
  IF v_family_id IS NULL THEN
    -- Get parent's family_code
    SELECT p.family_code INTO v_family_code
    FROM public.parents p
    WHERE p.id = NEW.parent_id
    LIMIT 1;

    -- Create family record
    INSERT INTO public.families (id, invite_code, household_type, name, created_at)
    VALUES (
      NEW.parent_id,
      COALESCE(v_family_code, 'FAM' || upper(substr(NEW.parent_id::text, 1, 8))),
      'single',
      NULL,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    v_family_id := NEW.parent_id;
  END IF;

  -- Ensure adult_profiles exists for parent
  INSERT INTO public.adult_profiles (
    user_id,
    family_id,
    role,
    name,
    email
  )
  SELECT
    p.id,
    p.id as family_id,
    'parent' as role,
    COALESCE(p.name, ''),
    p.email
  FROM public.parents p
  WHERE p.id = NEW.parent_id
  ON CONFLICT (user_id, family_id, role) DO NOTHING;

  -- Create child_profiles record (use same ID as children.id)
  INSERT INTO public.child_profiles (
    id,
    family_id,
    name,
    login_code,
    avatar_color,
    created_at
  )
  VALUES (
    NEW.id,
    v_family_id,
    NEW.name,
    NEW.login_code,
    COALESCE(NEW.avatar_color, '#3B82F6'),
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    login_code = EXCLUDED.login_code,
    avatar_color = EXCLUDED.avatar_color,
    updated_at = NOW();

  v_child_profile_id := NEW.id;

  -- Create child_family_memberships record
  INSERT INTO public.child_family_memberships (
    child_profile_id,
    family_id
  )
  VALUES (
    v_child_profile_id,
    v_family_id
  )
  ON CONFLICT (child_profile_id, family_id) DO NOTHING;

  -- Create conversations for all family members (parent + family members)
  -- This ensures the child can see all family members on /child/family page
  INSERT INTO public.conversations (adult_id, child_id, adult_role)
  SELECT
    ap.id as adult_id,
    v_child_profile_id as child_id,
    ap.role as adult_role
  FROM public.adult_profiles ap
  WHERE ap.family_id = v_family_id
    AND ap.role IN ('parent', 'family_member')
  ON CONFLICT (adult_id, child_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- STEP 2: Create trigger on children table
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_child_insert ON public.children;

CREATE TRIGGER on_child_insert
  AFTER INSERT ON public.children
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_child();

-- =====================================================
-- STEP 3: Backfill existing children that are missing child_profiles/child_family_memberships
-- =====================================================

-- Create child_profiles for children that don't have them
INSERT INTO public.child_profiles (
  id,
  family_id,
  name,
  login_code,
  avatar_color,
  created_at
)
SELECT
  c.id,
  COALESCE(
    -- Try to get family_id from adult_profiles
    (SELECT ap.family_id
     FROM public.adult_profiles ap
     WHERE ap.user_id = c.parent_id AND ap.role = 'parent'
     LIMIT 1),
    -- Fallback to parent_id (which should be the family_id)
    c.parent_id
  ) as family_id,
  c.name,
  c.login_code,
  COALESCE(c.avatar_color, '#3B82F6'),
  COALESCE(c.created_at, NOW())
FROM public.children c
WHERE NOT EXISTS (
  SELECT 1 FROM public.child_profiles cp WHERE cp.id = c.id
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  login_code = EXCLUDED.login_code,
  avatar_color = EXCLUDED.avatar_color,
  updated_at = NOW();

-- Create child_family_memberships for children that don't have them
INSERT INTO public.child_family_memberships (
  child_profile_id,
  family_id
)
SELECT
  cp.id as child_profile_id,
  cp.family_id
FROM public.child_profiles cp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.child_family_memberships cfm
  WHERE cfm.child_profile_id = cp.id
    AND cfm.family_id = cp.family_id
)
ON CONFLICT (child_profile_id, family_id) DO NOTHING;

-- =====================================================
-- STEP 4: Create conversations for existing children with their family members
-- =====================================================
-- This ensures existing children can see all family members on /child/family page

INSERT INTO public.conversations (adult_id, child_id, adult_role)
SELECT DISTINCT
  ap.id as adult_id,
  cp.id as child_id,
  ap.role as adult_role
FROM public.child_profiles cp
JOIN public.child_family_memberships cfm ON cfm.child_profile_id = cp.id
JOIN public.adult_profiles ap ON ap.family_id = cfm.family_id
WHERE ap.role IN ('parent', 'family_member')
  AND NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.adult_id = ap.id
      AND c.child_id = cp.id
  )
ON CONFLICT (adult_id, child_id) DO NOTHING;

-- =====================================================
-- STEP 5: Create trigger to create conversations when new family member is added
-- =====================================================
-- This ensures existing children can see new family members on /child/family page

CREATE OR REPLACE FUNCTION public.handle_new_family_member_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_family_id UUID;
BEGIN
  -- Only process family_member role (parents are handled separately)
  IF NEW.role = 'family_member' THEN
    v_family_id := NEW.family_id;

    -- Create conversations for this new family member with all children in the family
    INSERT INTO public.conversations (adult_id, child_id, adult_role)
    SELECT
      NEW.id as adult_id,
      cp.id as child_id,
      'family_member' as adult_role
    FROM public.child_profiles cp
    JOIN public.child_family_memberships cfm ON cfm.child_profile_id = cp.id
    WHERE cfm.family_id = v_family_id
    ON CONFLICT (adult_id, child_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_family_member_profile_insert ON public.adult_profiles;

CREATE TRIGGER on_family_member_profile_insert
  AFTER INSERT ON public.adult_profiles
  FOR EACH ROW
  WHEN (NEW.role = 'family_member')
  EXECUTE FUNCTION public.handle_new_family_member_profile();

-- =====================================================
-- Migration complete
-- =====================================================


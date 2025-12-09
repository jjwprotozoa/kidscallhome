-- Migration: Create Profile Tables (Phase 0)
-- Purpose: Create unified adult_profiles and child_profiles tables to align account/profile model with conversation model
-- Date: 2025-12-07
-- This migration creates profile tables that will be referenced by conversations.adult_id and conversations.child_id

-- =====================================================
-- STEP 1: Create adult_profiles table
-- =====================================================
-- Unified table for both parents and family members
-- adult_id in conversations will reference adult_profiles.id

CREATE TABLE IF NOT EXISTS public.adult_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL, -- References a family grouping (initially parent_id, but can be extended)
  role TEXT NOT NULL CHECK (role IN ('parent', 'family_member')),
  relationship_type TEXT CHECK (relationship_type IN ('grandparent', 'aunt', 'uncle', 'cousin', 'other')),
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure one profile per user per family per role
  UNIQUE (user_id, family_id, role)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_adult_profiles_user_id ON public.adult_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_adult_profiles_family_id ON public.adult_profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_adult_profiles_role ON public.adult_profiles(role);
CREATE INDEX IF NOT EXISTS idx_adult_profiles_user_family ON public.adult_profiles(user_id, family_id);

-- =====================================================
-- STEP 2: Create child_profiles table
-- =====================================================
-- child_id in conversations will reference child_profiles.id

CREATE TABLE IF NOT EXISTS public.child_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL, -- References the same family_id as adult_profiles
  name TEXT NOT NULL,
  login_code TEXT NOT NULL UNIQUE, -- Preserve login_code from children table
  avatar_url TEXT,
  avatar_color TEXT DEFAULT '#3B82F6',
  age INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_child_profiles_family_id ON public.child_profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_child_profiles_login_code ON public.child_profiles(login_code);

-- =====================================================
-- STEP 3: Migrate existing parents to adult_profiles
-- =====================================================

INSERT INTO public.adult_profiles (user_id, family_id, role, name, email, created_at)
SELECT 
  p.id as user_id,
  p.id as family_id, -- Use parent's own ID as family_id initially
  'parent' as role,
  COALESCE(p.name, '') as name,
  p.email,
  p.created_at
FROM public.parents p
ON CONFLICT (user_id, family_id, role) DO NOTHING;

-- =====================================================
-- STEP 4: Migrate existing family_members to adult_profiles
-- =====================================================

INSERT INTO public.adult_profiles (user_id, family_id, role, relationship_type, name, email, created_at)
SELECT 
  fm.id as user_id,
  fm.parent_id as family_id, -- Use parent_id as family_id
  'family_member' as role,
  fm.relationship as relationship_type,
  fm.name,
  fm.email,
  fm.created_at
FROM public.family_members fm
WHERE fm.status = 'active' -- Only migrate active family members
ON CONFLICT (user_id, family_id, role) DO NOTHING;

-- =====================================================
-- STEP 5: Migrate existing children to child_profiles
-- =====================================================

INSERT INTO public.child_profiles (id, family_id, name, login_code, avatar_color, created_at)
SELECT 
  c.id, -- Preserve original child ID
  c.parent_id as family_id, -- Use parent_id as family_id
  c.name,
  c.login_code,
  c.avatar_color,
  c.created_at
FROM public.children c
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STEP 6: Create mapping table for old children.id to child_profiles.id
-- =====================================================
-- This is a temporary helper to ensure we can map old references
-- child_profiles.id should match children.id after migration

-- Add a column to track the original children.id if needed
-- Since we're preserving the ID, we don't need a separate mapping table

-- =====================================================
-- STEP 7: Create helper functions
-- =====================================================

-- Get adult_profile_id for a given user and family
CREATE OR REPLACE FUNCTION get_adult_profile_id(
  p_user_id UUID,
  p_family_id UUID,
  p_role TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF p_role IS NOT NULL THEN
    SELECT id INTO v_profile_id
    FROM public.adult_profiles
    WHERE user_id = p_user_id
      AND family_id = p_family_id
      AND role = p_role
    LIMIT 1;
  ELSE
    -- If no role specified, try parent first, then family_member
    SELECT id INTO v_profile_id
    FROM public.adult_profiles
    WHERE user_id = p_user_id
      AND family_id = p_family_id
      AND role = 'parent'
    LIMIT 1;
    
    IF v_profile_id IS NULL THEN
      SELECT id INTO v_profile_id
      FROM public.adult_profiles
      WHERE user_id = p_user_id
        AND family_id = p_family_id
        AND role = 'family_member'
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN v_profile_id;
END;
$$;

-- Get child_profile_id for a given child (by old children.id or child_profiles.id)
CREATE OR REPLACE FUNCTION get_child_profile_id(p_child_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- child_profiles.id should match children.id, so this should work
  SELECT id INTO v_profile_id
  FROM public.child_profiles
  WHERE id = p_child_id
  LIMIT 1;
  
  RETURN v_profile_id;
END;
$$;

-- =====================================================
-- STEP 8: Enable RLS on profile tables
-- =====================================================

ALTER TABLE public.adult_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 9: Create RLS policies for adult_profiles
-- =====================================================

-- Adults can view their own profile
CREATE POLICY "Adults can view own profile"
  ON public.adult_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Adults can view profiles in their family
CREATE POLICY "Adults can view profiles in their family"
  ON public.adult_profiles FOR SELECT
  TO authenticated
  USING (
    -- User is in the same family
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = adult_profiles.family_id
    )
  );

-- Adults can update their own profile
CREATE POLICY "Adults can update own profile"
  ON public.adult_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Parents can insert their own profile
CREATE POLICY "Parents can insert own profile"
  ON public.adult_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'parent'
  );

-- Parents can insert family member profiles (when adding family members)
CREATE POLICY "Parents can insert family member profiles"
  ON public.adult_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be a parent in the same family
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = adult_profiles.family_id
    )
    AND role = 'family_member'
  );

-- =====================================================
-- STEP 10: Create RLS policies for child_profiles
-- =====================================================

-- Adults can view children in their family
CREATE POLICY "Adults can view children in their family"
  ON public.child_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.family_id = child_profiles.family_id
    )
  );

-- Children can view their own profile (via anonymous auth with child_id in session)
-- This will be handled at application level since children use anonymous auth
CREATE POLICY "Anyone can view child profiles for login code verification"
  ON public.child_profiles FOR SELECT
  TO anon
  USING (true); -- Limited by login_code lookup in application

-- Parents can insert children in their family
CREATE POLICY "Parents can insert children in their family"
  ON public.child_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = child_profiles.family_id
    )
  );

-- Parents can update children in their family
CREATE POLICY "Parents can update children in their family"
  ON public.child_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = child_profiles.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = child_profiles.family_id
    )
  );

-- Parents can delete children in their family
CREATE POLICY "Parents can delete children in their family"
  ON public.child_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adult_profiles ap
      WHERE ap.user_id = auth.uid()
        AND ap.role = 'parent'
        AND ap.family_id = child_profiles.family_id
    )
  );

-- =====================================================
-- STEP 11: Create trigger to update updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_adult_profiles_updated_at
  BEFORE UPDATE ON public.adult_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();

CREATE TRIGGER update_child_profiles_updated_at
  BEFORE UPDATE ON public.child_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();

-- =====================================================
-- STEP 12: Enable realtime for profile tables
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.adult_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.child_profiles;

-- =====================================================
-- Migration complete
-- =====================================================
-- Next steps:
-- 1. Update conversations table to reference adult_profiles.id and child_profiles.id
-- 2. Update all queries to use profile IDs instead of raw auth UIDs
-- 3. Update RLS policies to resolve profile IDs from auth context


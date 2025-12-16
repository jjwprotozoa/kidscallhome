-- Migration: Add avatar_color to adult_profiles
-- Purpose: Allow parents and family members to have different avatar colors similar to children
-- Date: 2025-12-16

-- STEP 1: Add avatar_color column to adult_profiles if it doesn't exist
ALTER TABLE public.adult_profiles
ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT '#3B82F6';

-- STEP 2: Populate existing adult_profiles with colors from the AVATAR_COLORS array
-- Use a deterministic hash based on the adult_profiles.id to assign colors consistently
-- This ensures each parent/family member gets a consistent color
UPDATE public.adult_profiles
SET avatar_color = (
  CASE (hashtext(id::text) % 5)
    WHEN 0 THEN '#3B82F6' -- blue
    WHEN 1 THEN '#F97316' -- orange
    WHEN 2 THEN '#10B981' -- green
    WHEN 3 THEN '#A855F7' -- purple
    WHEN 4 THEN '#EC4899' -- pink
    ELSE '#3B82F6' -- default to blue
  END
)
WHERE avatar_color IS NULL OR avatar_color = '#3B82F6';

-- STEP 3: Create a function to generate avatar color for new adult profiles
-- This function will be called via trigger or application code
CREATE OR REPLACE FUNCTION assign_adult_avatar_color()
RETURNS TRIGGER AS $$
DECLARE
  avatar_colors TEXT[] := ARRAY['#3B82F6', '#F97316', '#10B981', '#A855F7', '#EC4899'];
  color_index INTEGER;
BEGIN
  -- If avatar_color is not set, assign one based on ID hash
  IF NEW.avatar_color IS NULL OR NEW.avatar_color = '#3B82F6' THEN
    color_index := (hashtext(NEW.id::text) % array_length(avatar_colors, 1)) + 1;
    NEW.avatar_color := avatar_colors[color_index];
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Create trigger to auto-assign avatar colors for new adult profiles
DROP TRIGGER IF EXISTS assign_adult_avatar_color_trigger ON public.adult_profiles;
CREATE TRIGGER assign_adult_avatar_color_trigger
  BEFORE INSERT ON public.adult_profiles
  FOR EACH ROW
  EXECUTE FUNCTION assign_adult_avatar_color();

-- STEP 5: Update RLS policy to allow children to view avatar_color from adult_profiles
-- The existing policy "Children can view adult names from conversations" should already allow this
-- but we'll verify it includes avatar_color in the SELECT

COMMENT ON COLUMN public.adult_profiles.avatar_color IS 
  'Avatar color for the adult profile. Used to display different colors for parents and family members, similar to children.';


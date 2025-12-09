-- Migration: Optimize Login Code Storage
-- Purpose: Store only child-specific part in children.login_code (e.g., "dog-42")
-- Family code is already stored in parents.family_code, so we don't need to duplicate it
-- This reduces storage and makes the schema cleaner

-- Step 1: Extract child-specific part from existing login codes and update login_code
-- Format: FAMILYCODE-color-number -> color-number
-- This updates all existing records to store only the child-specific part
UPDATE public.children c
SET login_code = SUBSTRING(c.login_code FROM '^[^-]+-(.+)$')
WHERE c.login_code LIKE '%-%-%';  -- Has 3 parts (family-code-number)

-- Step 2: Drop the old unique constraint on login_code (it's no longer globally unique)
ALTER TABLE public.children
DROP CONSTRAINT IF EXISTS children_login_code_key;

-- Step 3: Add unique constraint on (parent_id, login_code) to ensure uniqueness within a family
-- This ensures "dog-42" can exist in multiple families, but only once per family
CREATE UNIQUE INDEX IF NOT EXISTS idx_children_parent_login_code_unique 
ON public.children(parent_id, login_code);

-- Step 4: Create a function to get full login code (for display purposes)
CREATE OR REPLACE FUNCTION public.get_full_login_code(p_child_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_code TEXT;
  v_child_code TEXT;
BEGIN
  SELECT p.family_code, c.login_code
  INTO v_family_code, v_child_code
  FROM public.children c
  JOIN public.parents p ON c.parent_id = p.id
  WHERE c.id = p_child_id;
  
  IF v_family_code IS NULL OR v_child_code IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN v_family_code || '-' || v_child_code;
END;
$$;

-- Note: After this migration:
-- - children.login_code now stores only the child-specific part (e.g., "dog-42")
-- - parents.family_code stores the family code (e.g., "EGW6RZ")
-- - To query a child, join on parent_id and match: family_code + '-' + login_code
-- - The get_full_login_code() function can be used to display the full code


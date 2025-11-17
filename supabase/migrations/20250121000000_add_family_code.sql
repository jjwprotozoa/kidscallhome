-- Migration: Add Family Code to Authentication Flow
-- Purpose: Add unique family_code to parents table and update login code format to include family code
-- Format: familyCode-color/animal-number (e.g., "ABC123-blue-19" or "123456-cat-7")

-- Step 1: Add family_code column to parents table
ALTER TABLE public.parents 
ADD COLUMN IF NOT EXISTS family_code TEXT UNIQUE;

-- Step 2: Create index on family_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_parents_family_code ON public.parents(family_code);

-- Step 3: Create function to generate unique family codes
-- Format: 6-character alphanumeric (uppercase letters and numbers, excluding confusing chars)
CREATE OR REPLACE FUNCTION public.generate_unique_family_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; -- All alphanumeric characters
  code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    code := '';
    -- Generate 6-character code
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if code exists
    IF NOT EXISTS (SELECT 1 FROM public.parents WHERE family_code = code) THEN
      RETURN code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 500 THEN
      RAISE EXCEPTION 'Could not generate unique family code after 500 attempts';
    END IF;
  END LOOP;
END;
$$;

-- Step 4: Update existing parents without family_code (backfill)
DO $$
DECLARE
  parent_record RECORD;
BEGIN
  FOR parent_record IN SELECT id FROM public.parents WHERE family_code IS NULL LOOP
    UPDATE public.parents 
    SET family_code = public.generate_unique_family_code()
    WHERE id = parent_record.id;
  END LOOP;
END $$;

-- Step 5: Update trigger function to generate family_code on parent creation
CREATE OR REPLACE FUNCTION public.handle_new_parent()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.parents (id, email, name, family_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    public.generate_unique_family_code()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 6: Update login code generation to include family_code
-- New format: {family_code}-{color|animal}-{number}
CREATE OR REPLACE FUNCTION public.generate_kid_friendly_login_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  options TEXT[] := ARRAY[
    -- Colors (10)
    'red', 'blue', 'green', 'yellow', 'orange', 
    'purple', 'pink', 'brown', 'black', 'white',
    -- Animals (15)
    'cat', 'dog', 'bird', 'fish', 'bear', 
    'lion', 'tiger', 'elephant', 'monkey', 'rabbit',
    'horse', 'duck', 'cow', 'pig', 'sheep'
  ];
  selected_option TEXT;
  selected_number INT;
  code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    -- Randomly select color or animal
    selected_option := options[floor(random() * array_length(options, 1) + 1)::int];
    
    -- Randomly select number 1-99
    selected_number := floor(random() * 99 + 1)::int;
    
    -- Format: "color-7" or "tiger-4" (family_code will be prepended by application)
    -- This function now returns just the child-specific part
    code := selected_option || '-' || selected_number::text;
    
    -- Check if code exists (without family_code prefix)
    -- Note: We check for partial matches since login_code now includes family_code
    IF NOT EXISTS (
      SELECT 1 FROM public.children 
      WHERE login_code LIKE '%-' || code
    ) THEN
      RETURN code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 500 THEN
      RAISE EXCEPTION 'Could not generate unique kid-friendly code after 500 attempts';
    END IF;
  END LOOP;
END;
$$;

-- Step 7: Add index on login_code for faster authentication lookups
CREATE INDEX IF NOT EXISTS idx_children_login_code ON public.children(login_code);

-- Step 8: Add composite index for family_code + child code lookup optimization
-- This helps with queries that filter by family_code first
CREATE INDEX IF NOT EXISTS idx_children_login_code_pattern ON public.children(login_code text_pattern_ops);


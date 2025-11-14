-- Migration: Kid-Friendly Login Codes
-- Purpose: Replace alphanumeric codes with color/animal + number format (e.g., "blue-7", "tiger-4")

-- Create function to generate kid-friendly login codes
-- Format: {color|animal}-{1-99}
-- Total possibilities: 25 options * 99 numbers = 2,475 unique codes
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
    
    -- Format: "color-7" or "tiger-4"
    code := selected_option || '-' || selected_number::text;
    
    -- Check if code exists
    IF NOT EXISTS (SELECT 1 FROM public.children WHERE login_code = code) THEN
      RETURN code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 500 THEN
      RAISE EXCEPTION 'Could not generate unique kid-friendly code after 500 attempts';
    END IF;
  END LOOP;
END;
$$;

-- Update the existing function to use kid-friendly format
-- Keep old function name for backward compatibility but use new format
CREATE OR REPLACE FUNCTION public.generate_unique_login_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.generate_kid_friendly_login_code();
END;
$$;


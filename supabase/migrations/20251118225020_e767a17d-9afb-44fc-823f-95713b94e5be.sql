-- =====================================================
-- Fix Security Issues: Parent Email Exposure & Input Validation
-- =====================================================

-- =====================================================
-- PART 1: Fix Parent Email Exposure
-- =====================================================
-- Drop the existing policy that exposes parent emails
DROP POLICY IF EXISTS "Children can view their parent's name" ON public.parents;

-- Create SECURITY DEFINER function to return only parent name
CREATE OR REPLACE FUNCTION public.get_parent_name(p_parent_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name FROM public.parents WHERE id = p_parent_id LIMIT 1;
$$;

-- Grant execute to anonymous users (children)
GRANT EXECUTE ON FUNCTION public.get_parent_name(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_parent_name(uuid) TO authenticated;

-- =====================================================
-- PART 2: Add Input Validation Constraints
-- =====================================================

-- Add constraint for message content length (max 5000 characters)
ALTER TABLE public.messages 
ADD CONSTRAINT messages_content_length 
CHECK (char_length(content) > 0 AND char_length(content) <= 5000);

-- Add constraint for child name length (1-100 characters)
ALTER TABLE public.children 
ADD CONSTRAINT children_name_length 
CHECK (char_length(name) >= 1 AND char_length(name) <= 100);

-- Add constraint for login code format (must be 6 characters)
ALTER TABLE public.children 
ADD CONSTRAINT children_login_code_format 
CHECK (char_length(login_code) = 6);

-- =====================================================
-- Verification
-- =====================================================
SELECT 
    'Security fixes applied' as status,
    'Parent emails no longer exposed, input validation constraints added' as description;
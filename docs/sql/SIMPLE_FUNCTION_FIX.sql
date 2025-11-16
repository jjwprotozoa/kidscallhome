-- SIMPLE_FUNCTION_FIX.sql
-- Simple function that definitely bypasses RLS
-- This function will work regardless of RLS policies

-- =====================================================
-- STEP 1: Drop existing function
-- =====================================================
DROP FUNCTION IF EXISTS public.get_parent_name_for_child(uuid);

-- =====================================================
-- STEP 2: Create simplest possible function
-- SECURITY DEFINER means it runs with creator's privileges (bypasses RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_parent_name_for_child(parent_uuid uuid)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- Direct query - SECURITY DEFINER bypasses all RLS
  -- Just verify relationship exists, then return parent
  SELECT p.id, p.name
  FROM public.parents p
  INNER JOIN public.children c ON c.parent_id = p.id
  WHERE p.id = parent_uuid
  LIMIT 1;
$$;

-- Grant execute to anon
GRANT EXECUTE ON FUNCTION public.get_parent_name_for_child(uuid) TO anon;

-- =====================================================
-- STEP 3: Test the function
-- =====================================================
SELECT 
    '🧪 Function Test' as test_type,
    *
FROM public.get_parent_name_for_child('70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid);

-- =====================================================
-- STEP 4: Verify function was created
-- =====================================================
SELECT 
    '✅ Function Status' as status,
    p.proname as function_name,
    pg_get_userbyid(p.proowner) as owner,
    p.prosecdef as is_security_definer
FROM pg_proc p
WHERE p.proname = 'get_parent_name_for_child';


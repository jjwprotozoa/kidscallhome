-- Migration: Add Timezone Cache Function
-- Purpose: Create a cached function for timezone names to avoid repeated pg_timezone_names queries
-- Date: 2025-01-20
-- This addresses the 0% cache hit rate issue with pg_timezone_names queries

-- =====================================================
-- STEP 1: Create function to get timezone names
-- =====================================================
-- This function can be called via Supabase RPC and will benefit from query result caching
-- The function itself is simple, but having it as a function allows Supabase to cache results

CREATE OR REPLACE FUNCTION public.get_timezone_names()
RETURNS TABLE(name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name::text FROM pg_timezone_names ORDER BY name;
$$;

-- =====================================================
-- STEP 2: Grant execute permission to authenticated and anon users
-- =====================================================
-- This allows the application to call this function via Supabase RPC

GRANT EXECUTE ON FUNCTION public.get_timezone_names() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_timezone_names() TO anon;

-- =====================================================
-- STEP 3: Add comment explaining the function
-- =====================================================
COMMENT ON FUNCTION public.get_timezone_names() IS 
'Returns all timezone names from pg_timezone_names. This function is marked as STABLE to enable query result caching. Use this instead of direct pg_timezone_names queries to improve performance.';

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. The function is marked as STABLE, which tells PostgreSQL it can cache results
-- 2. SECURITY DEFINER allows the function to access system catalogs
-- 3. SET search_path prevents search_path injection attacks
-- 4. The application should use this via: supabase.rpc('get_timezone_names')
-- 5. Supabase should cache the results automatically due to STABLE marking


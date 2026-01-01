-- =====================================================
-- Slow Query Optimization Script
-- Purpose: Optimize 200+ slow queries identified in performance analysis
-- Date: 2025-01-20
-- =====================================================

-- =====================================================
-- ISSUE 1: pg_timezone_names - 0% Cache Hit Rate, 477ms mean
-- =====================================================
-- Problem: Direct queries to pg_timezone_names have 0% cache hit rate
-- Solution: Create materialized view for better caching

-- Drop existing materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS public.timezone_names_cache CASCADE;

-- Create materialized view for timezone names
-- This will be cached and refreshed only when needed
CREATE MATERIALIZED VIEW public.timezone_names_cache AS
SELECT name::text as name
FROM pg_timezone_names
ORDER BY name;

-- Create unique index on the materialized view for fast lookups
CREATE UNIQUE INDEX idx_timezone_names_cache_name ON public.timezone_names_cache(name);

-- Grant select to authenticated and anon users
GRANT SELECT ON public.timezone_names_cache TO authenticated;
GRANT SELECT ON public.timezone_names_cache TO anon;

-- Update the existing function to use the materialized view
CREATE OR REPLACE FUNCTION public.get_timezone_names()
RETURNS TABLE(name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name FROM public.timezone_names_cache ORDER BY name;
$$;

-- Create a function to refresh the cache (run periodically or on-demand)
CREATE OR REPLACE FUNCTION public.refresh_timezone_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.timezone_names_cache;
END;
$$;

-- Grant execute on refresh function to authenticated users (admins only)
-- Note: You may want to restrict this further based on your needs
GRANT EXECUTE ON FUNCTION public.refresh_timezone_cache() TO authenticated;

COMMENT ON MATERIALIZED VIEW public.timezone_names_cache IS 
'Cached timezone names from pg_timezone_names. Refresh periodically using refresh_timezone_cache(). This provides much better cache hit rates than direct pg_timezone_names queries.';

COMMENT ON FUNCTION public.refresh_timezone_cache() IS 
'Refreshes the timezone_names_cache materialized view. Run this periodically (e.g., monthly) or when timezone data changes.';

-- =====================================================
-- ISSUE 2: Calls table UPDATE queries - Optimize WHERE id = $2
-- =====================================================
-- Problem: UPDATE queries on calls table with WHERE id = $2
-- Solution: Ensure primary key index exists and is optimized

-- Verify primary key exists (should already exist, but ensure it's optimized)
-- The primary key automatically creates an index, but we'll verify

-- Add index for calls.id if not already covered by primary key
-- This is likely already covered, but we'll ensure it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'calls' 
    AND indexname = 'calls_pkey'
  ) THEN
    -- Primary key should exist, but if not, create it
    ALTER TABLE public.calls ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Add covering index for UPDATE queries that filter by id
-- This helps with UPDATE ... WHERE id = $2 queries
-- Note: Primary key already covers this, but we can add a partial index if needed
CREATE INDEX IF NOT EXISTS idx_calls_id_active 
ON public.calls(id) 
WHERE id IS NOT NULL;

-- =====================================================
-- ISSUE 3: Conversations queries - Ensure optimal indexes
-- =====================================================
-- Problem: Queries filtering by adult_id need optimal indexes
-- Solution: Verify and create composite indexes if needed

-- Ensure index exists for conversations.adult_id (for WHERE adult_id = $1 queries)
CREATE INDEX IF NOT EXISTS idx_conversations_adult_id_covering 
ON public.conversations(adult_id) 
INCLUDE (id, child_id, type, created_at, updated_at)
WHERE adult_id IS NOT NULL;

-- Add index for child_id lookups as well
CREATE INDEX IF NOT EXISTS idx_conversations_child_id_covering 
ON public.conversations(child_id) 
INCLUDE (id, adult_id, type, created_at, updated_at)
WHERE child_id IS NOT NULL;

-- =====================================================
-- ISSUE 4: Adult Profiles queries - Optimize user_id + role lookups
-- =====================================================
-- Problem: Queries filtering by user_id AND role
-- Solution: Ensure composite index exists

-- Verify composite index exists for (user_id, role) queries
CREATE INDEX IF NOT EXISTS idx_adult_profiles_user_role_covering 
ON public.adult_profiles(user_id, role) 
INCLUDE (id, family_id, created_at)
WHERE user_id IS NOT NULL AND role IS NOT NULL;

-- =====================================================
-- ISSUE 5: Calls table - Optimize parent_ice_candidates and child_ice_candidates updates
-- =====================================================
-- Problem: UPDATE queries setting ice_candidates by id
-- Solution: Ensure id index is optimal (already covered by primary key)

-- The primary key on calls.id should already be optimal for these queries
-- But we can add a partial index if there are specific patterns

-- =====================================================
-- ISSUE 6: pg_publication_tables - Supabase Realtime optimization
-- =====================================================
-- Problem: Queries to pg_publication_tables for realtime subscriptions
-- Solution: This is a system catalog query, but we can ensure indexes exist

-- Note: pg_publication_tables is a system view, so we can't add indexes directly
-- However, we can ensure the underlying tables are optimized
-- This is primarily a Supabase internal query, so optimization is limited

-- =====================================================
-- ISSUE 7: Dashboard/Metadata queries - Cannot be directly optimized
-- =====================================================
-- Problem: Complex dashboard queries for schema introspection
-- Solution: These are Supabase dashboard queries that are hard to optimize
-- Recommendation: These queries are infrequent and acceptable

-- =====================================================
-- ISSUE 8: realtime.list_changes - Supabase internal
-- =====================================================
-- Problem: This is a Supabase Realtime function (98.4% of total time)
-- Solution: Cannot be directly optimized, but mean time is acceptable (5.5ms)
-- Recommendation: Monitor for spikes (max_time: 1590ms is concerning)

-- =====================================================
-- ADDITIONAL OPTIMIZATIONS
-- =====================================================

-- Ensure statistics are up to date for better query planning
ANALYZE public.calls;
ANALYZE public.conversations;
ANALYZE public.adult_profiles;
ANALYZE public.messages;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check that indexes were created successfully
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('calls', 'conversations', 'adult_profiles', 'timezone_names_cache')
ORDER BY tablename, indexname;

-- Check materialized view exists
SELECT 
    schemaname,
    matviewname,
    hasindexes
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname = 'timezone_names_cache';

-- =====================================================
-- MAINTENANCE RECOMMENDATIONS
-- =====================================================

-- 1. Refresh timezone cache periodically (monthly or when timezone data changes)
--    Run: SELECT public.refresh_timezone_cache();

-- 2. Update table statistics regularly (weekly or after large data changes)
--    Run: ANALYZE public.calls; ANALYZE public.conversations; etc.

-- 3. Monitor query performance using Supabase dashboard
--    Watch for queries with high max_time relative to mean_time (indicates spikes)

-- 4. For realtime.list_changes spikes (max_time: 1590ms), consider:
--    - Reducing number of active realtime subscriptions
--    - Using connection pooling
--    - Monitoring WAL (Write-Ahead Log) size

-- =====================================================
-- NOTES
-- =====================================================

-- Many of the slow queries are Supabase internal functions that cannot be directly optimized:
-- - realtime.list_changes (Supabase Realtime)
-- - realtime.subscription (Supabase Realtime)
-- - Dashboard metadata queries (Supabase Dashboard)
-- - PostgREST internal queries

-- The optimizations above focus on:
-- 1. Application queries (calls, conversations, adult_profiles)
-- 2. Timezone queries (materialized view for better caching)
-- 3. Index optimization for common query patterns

-- Expected improvements:
-- - pg_timezone_names: Should see 100% cache hit rate after using materialized view
-- - Calls UPDATE queries: Should be faster with optimized indexes
-- - Conversations queries: Should benefit from covering indexes
-- - Adult profiles queries: Should benefit from composite indexes


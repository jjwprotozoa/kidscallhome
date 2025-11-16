-- FIX_PERFORMANCE_AND_WEBRTC.sql
-- Comprehensive fix for:
-- 1. Parent dashboard slow loading (missing indexes on children table)
-- 2. Video/audio not working (ICE candidates and WebRTC issues)
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Create Performance Indexes
-- ============================================
-- CRITICAL: RLS policies use EXISTS subqueries on children table
-- Without indexes, these queries are slow, causing parent dashboard to load slowly

-- Index on children.id (used in EXISTS subqueries)
CREATE INDEX IF NOT EXISTS idx_children_id ON public.children(id);

-- Index on children.parent_id (used in EXISTS subqueries and parent queries)
CREATE INDEX IF NOT EXISTS idx_children_parent_id ON public.children(parent_id);

-- Composite index for common query pattern (child_id + parent_id)
CREATE INDEX IF NOT EXISTS idx_children_id_parent_id ON public.children(id, parent_id);

-- Index on calls.parent_id (used in parent SELECT queries)
CREATE INDEX IF NOT EXISTS idx_calls_parent_id ON public.calls(parent_id);

-- Index on calls.child_id (used in child SELECT queries)
CREATE INDEX IF NOT EXISTS idx_calls_child_id ON public.calls(child_id);

-- Index on calls.status (already exists but ensure it's there)
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);

-- Composite index for parent dashboard queries (parent_id + status)
CREATE INDEX IF NOT EXISTS idx_calls_parent_status ON public.calls(parent_id, status);

-- Composite index for child queries (child_id + status)
CREATE INDEX IF NOT EXISTS idx_calls_child_status ON public.calls(child_id, status);

-- ============================================
-- STEP 2: Add ICE Candidate Fields (if missing)
-- ============================================
-- CRITICAL: Separate fields prevent ICE candidates from overwriting each other
-- This is required for WebRTC video/audio to work

-- Add parent_ice_candidates column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'parent_ice_candidates'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN parent_ice_candidates jsonb DEFAULT '[]'::jsonb;
    RAISE NOTICE '✅ Added parent_ice_candidates column';
  ELSE
    RAISE NOTICE '✅ parent_ice_candidates column already exists';
  END IF;
END $$;

-- Add child_ice_candidates column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'calls' 
    AND column_name = 'child_ice_candidates'
  ) THEN
    ALTER TABLE public.calls ADD COLUMN child_ice_candidates jsonb DEFAULT '[]'::jsonb;
    RAISE NOTICE '✅ Added child_ice_candidates column';
  ELSE
    RAISE NOTICE '✅ child_ice_candidates column already exists';
  END IF;
END $$;

-- Verify columns exist
SELECT 
    'ICE Candidate Columns' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
  AND column_name IN ('parent_ice_candidates', 'child_ice_candidates', 'ice_candidates')
ORDER BY column_name;

-- ============================================
-- STEP 3: Verify Indexes Were Created
-- ============================================
SELECT 
    'Performance Indexes' as info,
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND (
    indexname LIKE 'idx_children%' 
    OR indexname LIKE 'idx_calls%'
)
ORDER BY tablename, indexname;

-- ============================================
-- STEP 4: Analyze Tables for Query Optimization
-- ============================================
-- Run ANALYZE to update statistics for query planner
ANALYZE public.children;
ANALYZE public.calls;

-- ============================================
-- STEP 5: Show Current Index Status
-- ============================================
SELECT 
    'Index Summary' as info,
    COUNT(*) FILTER (WHERE tablename = 'children') as children_indexes,
    COUNT(*) FILTER (WHERE tablename = 'calls') as calls_indexes,
    COUNT(*) as total_indexes
FROM pg_indexes
WHERE schemaname = 'public'
AND (
    tablename IN ('children', 'calls')
    AND indexname LIKE 'idx_%'
);


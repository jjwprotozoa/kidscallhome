-- Check the actual schema of the calls table
-- Run this first to see what columns exist

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
ORDER BY ordinal_position;

-- If the table has caller_id/callee_id instead of child_id/parent_id/caller_type,
-- we need to either:
-- 1. Alter the table to match the expected schema, OR
-- 2. Update the code to match the existing schema

-- Expected schema (from migrations):
-- - id (uuid)
-- - child_id (uuid, references children.id)
-- - parent_id (uuid)
-- - caller_type (text: 'parent' or 'child')
-- - status (text: 'ringing', 'active', 'ended')
-- - offer (jsonb)
-- - answer (jsonb)
-- - ice_candidates (jsonb)
-- - created_at (timestamptz)
-- - ended_at (timestamptz)


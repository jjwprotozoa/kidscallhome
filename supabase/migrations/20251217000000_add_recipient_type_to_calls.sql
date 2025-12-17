-- Migration: Add recipient_type discriminator to calls table
-- Purpose: Enable Supabase Realtime subscriptions to filter calls correctly
-- Date: 2025-12-17
-- 
-- This adds a recipient_type field that can be filtered by Supabase Realtime
-- (which only supports single-column filters). This prevents parent subscriptions
-- from matching family member calls and vice versa.

-- =====================================================
-- STEP 1: Add recipient_type column
-- =====================================================

ALTER TABLE public.calls 
ADD COLUMN IF NOT EXISTS recipient_type TEXT 
CHECK (recipient_type IN ('parent', 'family_member', 'child'));

-- =====================================================
-- STEP 2: Add comment explaining the field
-- =====================================================

COMMENT ON COLUMN public.calls.recipient_type IS 
'Discriminator field for Supabase Realtime filtering. Values: parent (call is for parent), family_member (call is for family member), child (call is for child). This allows single-column filtering since Supabase Realtime does not support AND conditions.';

-- =====================================================
-- STEP 3: Create index for better query performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_calls_recipient_type ON public.calls(recipient_type);

-- =====================================================
-- STEP 4: Backfill existing records
-- =====================================================

-- Set recipient_type based on existing data
-- If family_member_id is set, recipient_type = 'family_member'
UPDATE public.calls 
SET recipient_type = 'family_member'
WHERE family_member_id IS NOT NULL 
  AND recipient_type IS NULL;

-- If parent_id is set and family_member_id is NULL, recipient_type = 'parent'
UPDATE public.calls 
SET recipient_type = 'parent'
WHERE parent_id IS NOT NULL 
  AND family_member_id IS NULL 
  AND recipient_type IS NULL;

-- If child_id is set and caller_type is parent/family_member, recipient_type = 'child'
UPDATE public.calls 
SET recipient_type = 'child'
WHERE child_id IS NOT NULL 
  AND caller_type IN ('parent', 'family_member')
  AND recipient_type IS NULL;

-- =====================================================
-- STEP 5: Make recipient_type NOT NULL after backfill
-- =====================================================

-- First, set any remaining NULL values to a default based on caller_type
UPDATE public.calls 
SET recipient_type = CASE 
  WHEN caller_type = 'child' AND parent_id IS NOT NULL THEN 'parent'
  WHEN caller_type = 'child' AND family_member_id IS NOT NULL THEN 'family_member'
  WHEN caller_type IN ('parent', 'family_member') THEN 'child'
  ELSE 'parent' -- fallback
END
WHERE recipient_type IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.calls 
ALTER COLUMN recipient_type SET NOT NULL;

-- =====================================================
-- STEP 6: Update RLS policies to use recipient_type
-- =====================================================

-- Note: RLS policies are already in place, but we ensure they work with recipient_type
-- The existing policies should continue to work, but we can add recipient_type checks
-- for better clarity and performance

-- Parents can see calls where they are the recipient (recipient_type = 'parent')
-- OR where they are the caller
-- This is already handled by existing policies, but we document it here

-- Family members can see calls where they are the recipient (recipient_type = 'family_member')
-- OR where they are the caller
-- This is already handled by existing policies, but we document it here

-- Children can see calls where they are the recipient (recipient_type = 'child')
-- OR where they are the caller
-- This is already handled by existing policies, but we document it here


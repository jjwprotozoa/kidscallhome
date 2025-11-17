-- Migration: Update Existing Children Login Codes
-- Purpose: Prepend family code to existing children's login codes that don't have it
-- This ensures backward compatibility and updates old format codes to new format

-- Update children's login codes to include family code
-- Only updates codes that don't already have 3 parts (familyCode-color-number)
UPDATE public.children c
SET login_code = p.family_code || '-' || c.login_code
FROM public.parents p
WHERE c.parent_id = p.id
  AND p.family_code IS NOT NULL
  AND c.login_code NOT LIKE '%-%-%'  -- Doesn't already have 3 parts
  AND c.login_code LIKE '%-%';  -- Has at least one dash (color-number format)

-- Note: This migration is idempotent - it only updates codes that don't already have family code
-- Codes that already have 3 parts (new format) are left unchanged


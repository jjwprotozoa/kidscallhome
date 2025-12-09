-- Migration: Fix family_members table to allow NULL id for pending invitations
-- Purpose: Allow creating invitations before users sign up (id should be nullable initially)
-- Date: 2025-12-04

-- =====================================================
-- STEP 1: Drop foreign key constraints that depend on the primary key
-- =====================================================
-- Drop foreign keys that reference family_members(id)
ALTER TABLE public.calls
DROP CONSTRAINT IF EXISTS calls_family_member_id_fkey;

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_family_member_id_fkey;

-- =====================================================
-- STEP 2: Add internal_id as primary key
-- =====================================================
-- Add a new internal_id column that will be the primary key
ALTER TABLE public.family_members
ADD COLUMN IF NOT EXISTS internal_id UUID DEFAULT gen_random_uuid();

-- Set internal_id for existing rows that don't have it
UPDATE public.family_members
SET internal_id = gen_random_uuid()
WHERE internal_id IS NULL;

-- Make internal_id NOT NULL
ALTER TABLE public.family_members
ALTER COLUMN internal_id SET NOT NULL;

-- =====================================================
-- STEP 3: Drop the old primary key constraint on id
-- =====================================================
-- Drop the primary key constraint on id
ALTER TABLE public.family_members
DROP CONSTRAINT IF EXISTS family_members_pkey;

-- =====================================================
-- STEP 4: Make id nullable and remove NOT NULL constraint
-- =====================================================
-- Make id nullable (it will be set when user signs up)
ALTER TABLE public.family_members
ALTER COLUMN id DROP NOT NULL;

-- =====================================================
-- STEP 5: Create new primary key on internal_id
-- =====================================================
-- Create primary key on internal_id
ALTER TABLE public.family_members
ADD CONSTRAINT family_members_pkey PRIMARY KEY (internal_id);

-- =====================================================
-- STEP 6: Create full unique constraint on id for foreign key references
-- =====================================================
-- Create a full unique constraint on id (required for foreign keys)
-- PostgreSQL allows multiple NULLs in unique constraints, so pending invitations won't conflict
-- This ensures that when id is set (after user signs up), it's unique
ALTER TABLE public.family_members
ADD CONSTRAINT family_members_id_unique UNIQUE (id);

-- =====================================================
-- STEP 7: Recreate foreign key constraints
-- =====================================================
-- Recreate foreign keys - they still reference id (user ID), not internal_id
-- This is correct because family_member_id in calls/messages should reference the auth user ID
-- Foreign keys can handle NULL values, so pending invitations (with NULL id) won't cause issues
ALTER TABLE public.calls
ADD CONSTRAINT calls_family_member_id_fkey 
FOREIGN KEY (family_member_id) 
REFERENCES public.family_members(id) 
ON DELETE CASCADE;

ALTER TABLE public.messages
ADD CONSTRAINT messages_family_member_id_fkey 
FOREIGN KEY (family_member_id) 
REFERENCES public.family_members(id) 
ON DELETE CASCADE;

-- =====================================================
-- STEP 8: Update RLS policies that reference id
-- =====================================================
-- The RLS policies should still work because they check id = auth.uid()
-- which will be NULL for pending invitations (and those won't match anyway)
-- No changes needed to RLS policies

-- =====================================================
-- Migration complete
-- =====================================================
-- Now family_members can be created with:
-- - internal_id: always set (primary key)
-- - id: NULL for pending invitations, set when user signs up
-- - invitation_token: unique identifier for invitations
-- 
-- Foreign keys in calls and messages still reference id (user ID), which is correct


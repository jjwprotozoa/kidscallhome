-- Migration: Fix billing_subscriptions RLS policies
-- Purpose: Remove the blocking FOR ALL policy that was preventing SELECT queries
-- Date: 2025-01-23

-- Drop the problematic policy if it exists
-- This policy was blocking SELECT queries because it used FOR ALL with USING (false)
DROP POLICY IF EXISTS "Only service role can write" ON public.billing_subscriptions;


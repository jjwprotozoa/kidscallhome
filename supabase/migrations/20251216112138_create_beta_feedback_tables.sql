-- Migration: Create Beta Feedback Tables
-- Purpose: Add beta_signups and beta_feedback tables with RLS for beta testing feature
-- Date: 2025-12-16
-- This enables users to join beta testing and submit feedback

-- =====================================================
-- STEP 1: Create beta_signups table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.beta_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  platform text CHECK (platform IN ('ios', 'android', 'web')),
  app_version text,
  device_model text,
  timezone text,
  use_case text,
  consent boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'paused', 'exited')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- STEP 2: Create beta_feedback table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('bug', 'ux', 'feature', 'other')),
  rating int CHECK (rating >= 1 AND rating <= 5),
  message text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- STEP 3: Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_beta_signups_user_id ON public.beta_signups(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_signups_status ON public.beta_signups(status);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_user_id ON public.beta_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_category ON public.beta_feedback(category);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created_at ON public.beta_feedback(created_at DESC);

-- =====================================================
-- STEP 4: Enable RLS on both tables
-- =====================================================
ALTER TABLE public.beta_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 5: Create RLS policies for beta_signups
-- =====================================================

-- Policy: Users can INSERT their own signup
CREATE POLICY "Users can insert their own beta signup"
  ON public.beta_signups
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can SELECT their own signups
CREATE POLICY "Users can select their own beta signup"
  ON public.beta_signups
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can UPDATE their own signup status (for exiting beta)
CREATE POLICY "Users can update their own beta signup status"
  ON public.beta_signups
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- STEP 6: Create RLS policies for beta_feedback
-- =====================================================

-- Policy: Users can INSERT their own feedback
CREATE POLICY "Users can insert their own beta feedback"
  ON public.beta_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can SELECT their own feedback
CREATE POLICY "Users can select their own beta feedback"
  ON public.beta_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- STEP 7: Create function to update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_beta_signups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_beta_signups_updated_at
  BEFORE UPDATE ON public.beta_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_beta_signups_updated_at();

-- =====================================================
-- STEP 8: Grant necessary permissions
-- =====================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.beta_signups TO authenticated;
GRANT SELECT, INSERT ON public.beta_feedback TO authenticated;

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. Users can only see and modify their own beta signups and feedback
-- 2. No DELETE policies - users cannot delete their records (data retention)
-- 3. Status updates allowed only for users to exit beta (status = 'exited')
-- 4. Meta field in beta_feedback stores additional context (route, user agent, etc.)
-- 5. Deep link support: Marketing emails can link to /beta route
-- 6. For is_beta flag: Check beta_signups table existence instead of adding to profiles
--    This keeps profiles table safe and allows computed is_beta via service layer


-- Migration: Add Privacy Consent Fields
-- Purpose: Add privacy_cookie_accepted and email_updates_opt_in columns to parents table
-- Date: 2025-12-06

-- =====================================================
-- STEP 1: Add privacy consent columns to parents table
-- =====================================================
ALTER TABLE public.parents 
ADD COLUMN IF NOT EXISTS privacy_cookie_accepted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS email_updates_opt_in BOOLEAN NOT NULL DEFAULT false;

-- =====================================================
-- STEP 2: Update existing rows to have default values
-- =====================================================
-- This ensures existing rows have the correct default values
UPDATE public.parents 
SET 
  privacy_cookie_accepted = COALESCE(privacy_cookie_accepted, false),
  email_updates_opt_in = COALESCE(email_updates_opt_in, false)
WHERE privacy_cookie_accepted IS NULL OR email_updates_opt_in IS NULL;

-- =====================================================
-- STEP 3: Update handle_new_parent trigger function
-- =====================================================
-- Ensure new parent records get default values for privacy fields
-- Note: Preserves existing family_code generation from previous migration
-- The DEFAULT values on the columns handle this, but we explicitly set them
-- in the trigger for clarity and to ensure consistency
CREATE OR REPLACE FUNCTION public.handle_new_parent()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.parents (id, email, name, family_code, privacy_cookie_accepted, email_updates_opt_in)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    public.generate_unique_family_code(), -- Preserve family_code generation
    false, -- privacy_cookie_accepted defaults to false
    false  -- email_updates_opt_in defaults to false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- Migration complete
-- =====================================================
-- Next steps:
-- 1. Update CookieConsent component to check privacy_cookie_accepted from database
-- 2. Update CookieConsent component to update privacy_cookie_accepted on Accept
-- 3. Add email helper text to registration form
-- 4. email_updates_opt_in will be wired later for explicit email consent


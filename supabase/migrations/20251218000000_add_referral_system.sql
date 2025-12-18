-- Migration: Referral System
-- Purpose: Track referrals and rewards for the Kids Call Home referral program
-- Date: 2025-12-18
-- 
-- The referral program gives both referrer and referred user 1 week free when
-- the referred user subscribes to the Family Plan.

-- =====================================================
-- STEP 1: Add referral_code column to parents table
-- =====================================================
-- Each parent gets a unique referral code they can share
ALTER TABLE public.parents 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.parents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS referral_bonus_days INTEGER DEFAULT 0;

-- =====================================================
-- STEP 2: Create referrals tracking table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  referred_user_id UUID REFERENCES public.parents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'subscribed', 'credited', 'expired')),
  reward_days INTEGER DEFAULT 7, -- 1 week = 7 days
  referrer_credited_at TIMESTAMPTZ,
  referred_credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'), -- Referrals expire after 90 days
  UNIQUE (referrer_id, referred_email)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_email ON public.referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_parents_referral_code ON public.parents(referral_code);
CREATE INDEX IF NOT EXISTS idx_parents_referred_by ON public.parents(referred_by);

-- =====================================================
-- STEP 3: Function to generate unique referral codes
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a friendly 8-character alphanumeric code (uppercase)
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) for 8));
    
    -- Check if it already exists
    SELECT EXISTS(SELECT 1 FROM public.parents WHERE referral_code = v_code) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$;

-- =====================================================
-- STEP 4: Function to ensure parent has a referral code
-- =====================================================
CREATE OR REPLACE FUNCTION public.ensure_referral_code(p_parent_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Check if parent already has a code
  SELECT referral_code INTO v_code
  FROM public.parents
  WHERE id = p_parent_id;
  
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;
  
  -- Generate a new code
  v_code := public.generate_referral_code();
  
  -- Update the parent record
  UPDATE public.parents
  SET referral_code = v_code
  WHERE id = p_parent_id;
  
  RETURN v_code;
END;
$$;

-- =====================================================
-- STEP 5: Function to track referral signup
-- =====================================================
CREATE OR REPLACE FUNCTION public.track_referral_signup(
  p_referral_code TEXT,
  p_new_user_id UUID,
  p_new_user_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_id UUID;
BEGIN
  -- Find the referrer by code
  SELECT id INTO v_referrer_id
  FROM public.parents
  WHERE referral_code = upper(p_referral_code);
  
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid referral code'
    );
  END IF;
  
  -- Check for self-referral
  IF v_referrer_id = p_new_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot refer yourself'
    );
  END IF;
  
  -- Update the new user's referred_by field
  UPDATE public.parents
  SET referred_by = v_referrer_id
  WHERE id = p_new_user_id;
  
  -- Check if referral already exists for this email
  SELECT id INTO v_referral_id
  FROM public.referrals
  WHERE referrer_id = v_referrer_id
  AND referred_email = p_new_user_email;
  
  IF v_referral_id IS NOT NULL THEN
    -- Update existing referral
    UPDATE public.referrals
    SET 
      referred_user_id = p_new_user_id,
      status = 'signed_up',
      updated_at = NOW()
    WHERE id = v_referral_id;
  ELSE
    -- Create new referral record
    INSERT INTO public.referrals (
      referrer_id,
      referred_email,
      referred_user_id,
      status
    ) VALUES (
      v_referrer_id,
      p_new_user_email,
      p_new_user_id,
      'signed_up'
    )
    RETURNING id INTO v_referral_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_referral_id,
    'referrer_id', v_referrer_id
  );
END;
$$;

-- =====================================================
-- STEP 6: Function to credit referral rewards
-- =====================================================
CREATE OR REPLACE FUNCTION public.credit_referral_reward(p_referred_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_reward_days INTEGER := 7; -- 1 week
BEGIN
  -- Find the referral record
  SELECT r.*, p.subscription_status AS referred_status
  INTO v_referral
  FROM public.referrals r
  JOIN public.parents p ON p.id = r.referred_user_id
  WHERE r.referred_user_id = p_referred_user_id
  AND r.status IN ('signed_up', 'subscribed')
  AND r.referrer_credited_at IS NULL;
  
  IF v_referral IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No pending referral reward found'
    );
  END IF;
  
  -- Credit the referrer
  UPDATE public.parents
  SET 
    referral_bonus_days = COALESCE(referral_bonus_days, 0) + v_reward_days,
    subscription_expires_at = CASE 
      WHEN subscription_expires_at IS NOT NULL THEN subscription_expires_at + (v_reward_days || ' days')::INTERVAL
      ELSE subscription_expires_at
    END
  WHERE id = v_referral.referrer_id;
  
  -- Credit the referred user
  UPDATE public.parents
  SET 
    referral_bonus_days = COALESCE(referral_bonus_days, 0) + v_reward_days,
    subscription_expires_at = CASE 
      WHEN subscription_expires_at IS NOT NULL THEN subscription_expires_at + (v_reward_days || ' days')::INTERVAL
      ELSE subscription_expires_at
    END
  WHERE id = p_referred_user_id;
  
  -- Update the referral record
  UPDATE public.referrals
  SET 
    status = 'credited',
    referrer_credited_at = NOW(),
    referred_credited_at = NOW(),
    updated_at = NOW()
  WHERE id = v_referral.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_referral.id,
    'reward_days', v_reward_days,
    'referrer_id', v_referral.referrer_id,
    'referred_user_id', p_referred_user_id
  );
END;
$$;

-- =====================================================
-- STEP 7: Function to get referral statistics
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_parent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats JSONB;
  v_referral_code TEXT;
  v_total_referrals INTEGER;
  v_pending_referrals INTEGER;
  v_completed_referrals INTEGER;
  v_total_bonus_days INTEGER;
BEGIN
  -- Ensure parent has a referral code
  SELECT public.ensure_referral_code(p_parent_id) INTO v_referral_code;
  
  -- Get referral counts
  SELECT 
    COUNT(*) FILTER (WHERE status != 'expired'),
    COUNT(*) FILTER (WHERE status IN ('pending', 'signed_up')),
    COUNT(*) FILTER (WHERE status IN ('subscribed', 'credited'))
  INTO v_total_referrals, v_pending_referrals, v_completed_referrals
  FROM public.referrals
  WHERE referrer_id = p_parent_id;
  
  -- Get total bonus days earned
  SELECT COALESCE(referral_bonus_days, 0) INTO v_total_bonus_days
  FROM public.parents
  WHERE id = p_parent_id;
  
  RETURN jsonb_build_object(
    'referral_code', v_referral_code,
    'total_referrals', v_total_referrals,
    'pending_referrals', v_pending_referrals,
    'completed_referrals', v_completed_referrals,
    'total_bonus_days', v_total_bonus_days,
    'bonus_weeks', v_total_bonus_days / 7
  );
END;
$$;

-- =====================================================
-- STEP 8: Function to get referral list
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_referral_list(p_parent_id UUID)
RETURNS TABLE (
  id UUID,
  referred_email TEXT,
  status TEXT,
  reward_days INTEGER,
  created_at TIMESTAMPTZ,
  credited_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    -- Mask email for privacy (show first 2 chars + domain)
    CASE 
      WHEN position('@' in r.referred_email) > 2 
      THEN left(r.referred_email, 2) || '***' || substring(r.referred_email from position('@' in r.referred_email))
      ELSE '***' || substring(r.referred_email from position('@' in r.referred_email))
    END AS referred_email,
    r.status,
    r.reward_days,
    r.created_at,
    r.referrer_credited_at AS credited_at
  FROM public.referrals r
  WHERE r.referrer_id = p_parent_id
  AND r.status != 'expired'
  ORDER BY r.created_at DESC
  LIMIT 50;
END;
$$;

-- =====================================================
-- STEP 9: Enable RLS on referrals table
-- =====================================================
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Parents can view their own referrals
CREATE POLICY "Parents can view own referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());

-- Only system functions can modify referrals (SECURITY DEFINER)
CREATE POLICY "System can manage referrals"
  ON public.referrals FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STEP 10: Grant execute permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION public.generate_referral_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_referral_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_referral_signup TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_referral_reward TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_list TO authenticated;

-- =====================================================
-- STEP 11: Generate referral codes for existing users
-- =====================================================
-- This will generate codes for all existing parents who don't have one
UPDATE public.parents
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;



-- Migration: Device Management System
-- Purpose: Track and manage devices linked to family accounts for security and monitoring

-- Drop existing table if needed (use with caution - only for development)
-- DROP TABLE IF EXISTS public.devices CASCADE;

-- Create devices table
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'other')),
  device_identifier TEXT NOT NULL, -- Unique device fingerprint (browser fingerprint, device ID, etc.)
  last_used_child_id UUID REFERENCES public.children(id) ON DELETE SET NULL,
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  last_ip_address TEXT,
  last_location TEXT, -- City, State or approximate location
  user_agent TEXT, -- Browser/device info
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(parent_id, device_identifier) -- One device per parent per identifier
);

-- Drop existing indexes if they exist (for idempotency)
DROP INDEX IF EXISTS idx_devices_parent_id;
DROP INDEX IF EXISTS idx_devices_last_login;
DROP INDEX IF EXISTS idx_devices_active;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_devices_parent_id ON public.devices(parent_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_login ON public.devices(last_login_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_active ON public.devices(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Parents can view own devices" ON public.devices;
DROP POLICY IF EXISTS "Parents can insert own devices" ON public.devices;
DROP POLICY IF EXISTS "Parents can update own devices" ON public.devices;
DROP POLICY IF EXISTS "Parents can delete own devices" ON public.devices;

-- RLS Policies for devices
CREATE POLICY "Parents can view own devices"
  ON public.devices FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can insert own devices"
  ON public.devices FOR INSERT
  WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can update own devices"
  ON public.devices FOR UPDATE
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can delete own devices"
  ON public.devices FOR DELETE
  USING (parent_id = auth.uid());

-- Function to update device last login
CREATE OR REPLACE FUNCTION public.update_device_login(
  p_parent_id UUID,
  p_device_identifier TEXT,
  p_device_name TEXT,
  p_device_type TEXT,
  p_user_agent TEXT,
  p_ip_address TEXT,
  p_child_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  device_id UUID;
BEGIN
  -- Try to find existing device
  SELECT id INTO device_id
  FROM public.devices
  WHERE parent_id = p_parent_id
    AND device_identifier = p_device_identifier
    AND is_active = true
  LIMIT 1;

  IF device_id IS NOT NULL THEN
    -- Update existing device
    UPDATE public.devices
    SET 
      last_login_at = NOW(),
      last_used_child_id = COALESCE(p_child_id, last_used_child_id),
      last_ip_address = p_ip_address,
      user_agent = p_user_agent,
      updated_at = NOW()
    WHERE id = device_id;
  ELSE
    -- Create new device
    INSERT INTO public.devices (
      parent_id,
      device_name,
      device_type,
      device_identifier,
      last_used_child_id,
      last_ip_address,
      user_agent
    )
    VALUES (
      p_parent_id,
      p_device_name,
      p_device_type,
      p_device_identifier,
      p_child_id,
      p_ip_address,
      p_user_agent
    )
    RETURNING id INTO device_id;
  END IF;

  RETURN device_id;
END;
$$;

-- Function to revoke device (soft delete)
CREATE OR REPLACE FUNCTION public.revoke_device(
  p_device_id UUID,
  p_parent_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.devices
  SET is_active = false,
      updated_at = NOW()
  WHERE id = p_device_id
    AND parent_id = p_parent_id;

  RETURN FOUND;
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS devices_updated_at ON public.devices;

CREATE TRIGGER devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_devices_updated_at();

-- Add comment to table
COMMENT ON TABLE public.devices IS 'Tracks devices used to access family accounts for security and management';
COMMENT ON COLUMN public.devices.device_identifier IS 'Unique fingerprint/identifier for the device (browser fingerprint, device ID, etc.)';
COMMENT ON COLUMN public.devices.last_location IS 'Approximate location based on IP geolocation or user-provided location';


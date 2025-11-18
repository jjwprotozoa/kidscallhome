-- Migration: Add Country Code Support for Device Management
-- Purpose: Add country_code column to devices table for IP geolocation
-- This allows displaying country flags to show where devices are logging in from

-- Add country_code column to devices table
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS country_code TEXT;

-- Create index for country code lookups (optional, for analytics/grouping)
CREATE INDEX IF NOT EXISTS idx_devices_country_code ON public.devices(country_code) WHERE country_code IS NOT NULL;

-- Update the update_device_login function to accept country_code parameter
-- Drop ALL existing function signatures to avoid conflicts
-- This ensures we have a clean migration regardless of which previous version exists
DROP FUNCTION IF EXISTS public.update_device_login(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
);

DROP FUNCTION IF EXISTS public.update_device_login(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
);

DROP FUNCTION IF EXISTS public.update_device_login(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
);

-- Recreate function with country_code parameter
CREATE OR REPLACE FUNCTION public.update_device_login(
  p_parent_id UUID,
  p_device_identifier TEXT,
  p_device_name TEXT,
  p_device_type TEXT,
  p_user_agent TEXT,
  p_ip_address TEXT,
  p_mac_address TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_child_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  device_id UUID;
  ip_address_validated TEXT;
BEGIN
  -- Safely validate IP address (handles invalid IPs)
  BEGIN
    IF p_ip_address IS NULL OR p_ip_address = '' THEN
      ip_address_validated := NULL;
    ELSE
      -- Validate IP format by attempting conversion to INET
      PERFORM p_ip_address::inet;
      ip_address_validated := p_ip_address;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If IP address is invalid, set to NULL instead of failing
    ip_address_validated := NULL;
  END;

  -- Try to find existing device by identifier
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
      last_ip_address = CASE 
        WHEN ip_address_validated IS NULL THEN NULL 
        ELSE ip_address_validated::inet 
      END,
      mac_address = COALESCE(p_mac_address, mac_address),
      country_code = COALESCE(p_country_code, country_code), -- Update country if provided, keep existing if null
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
      mac_address,
      country_code,
      user_agent
    )
    VALUES (
      p_parent_id,
      p_device_name,
      p_device_type,
      p_device_identifier,
      p_child_id,
      CASE 
        WHEN ip_address_validated IS NULL THEN NULL 
        ELSE ip_address_validated::inet 
      END,
      p_mac_address,
      p_country_code,
      p_user_agent
    )
    RETURNING id INTO device_id;
  END IF;

  RETURN device_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_device_login(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
) TO anon;

GRANT EXECUTE ON FUNCTION public.update_device_login(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
) TO authenticated;

-- Add comment
COMMENT ON COLUMN public.devices.country_code IS 'ISO 3166-1 alpha-2 country code (e.g., US, GB, CA) derived from IP geolocation. Used to display country flags.';


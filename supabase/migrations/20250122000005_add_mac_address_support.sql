-- Migration: Add MAC Address Support for Native Apps
-- Purpose: Add MAC address field to devices table for Android native app tracking
-- Note: iOS blocks MAC address access, Android 6.0+ may restrict it

-- Add MAC address column to devices table
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS mac_address TEXT;

-- Create index for MAC address lookups (optional, for security/audit purposes)
CREATE INDEX IF NOT EXISTS idx_devices_mac_address ON public.devices(mac_address) WHERE mac_address IS NOT NULL;

-- Update the update_device_login function to accept MAC address parameter
-- Drop both old 7-parameter version and new 8-parameter version to ensure clean migration
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

CREATE OR REPLACE FUNCTION public.update_device_login(
  p_parent_id UUID,
  p_device_identifier TEXT,
  p_device_name TEXT,
  p_device_type TEXT,
  p_user_agent TEXT,
  p_ip_address TEXT,
  p_mac_address TEXT DEFAULT NULL,
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
  -- Store as TEXT to match column type, but validate format
  BEGIN
    IF p_ip_address IS NULL OR p_ip_address = '' THEN
      ip_address_validated := NULL;
    ELSE
      -- Validate IP format by attempting conversion to INET
      -- If valid, use original text; if invalid, set to NULL
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
      last_ip_address = ip_address_validated,
      mac_address = COALESCE(p_mac_address, mac_address), -- Update MAC if provided, keep existing if null
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
      user_agent
    )
    VALUES (
      p_parent_id,
      p_device_name,
      p_device_type,
      p_device_identifier,
      p_child_id,
      ip_address_validated,
      p_mac_address,
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
  UUID
) TO authenticated;

-- Add comment
COMMENT ON COLUMN public.devices.mac_address IS 'MAC address for native apps (Android only, iOS blocks access). Format: XX:XX:XX:XX:XX:XX or stored without colons.';


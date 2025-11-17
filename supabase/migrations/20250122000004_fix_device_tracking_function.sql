-- Migration: Fix Device Tracking Function
-- Purpose: Drop and recreate update_device_login function to ensure single definition
-- Fixes PGRST203 error (function overload resolution)

-- Drop existing function if it exists (to avoid conflicts)
DROP FUNCTION IF EXISTS public.update_device_login(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
);

-- Recreate function with explicit parameter types
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_device_login(
  UUID,
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
  UUID
) TO authenticated;


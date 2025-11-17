-- Migration: Grant Permissions for Device Tracking RPC Function
-- Purpose: Allow anonymous users (children) to call update_device_login function
-- This is required because children log in anonymously and need to track devices
-- Note: This migration grants permissions to the 7-parameter version.
-- Migration 20250122000005 will update the function to 8 parameters (with MAC address)
-- and re-grant permissions. This migration is kept for backward compatibility.

-- Grant execute permission on update_device_login to anonymous users (7-parameter version)
GRANT EXECUTE ON FUNCTION public.update_device_login(
  UUID, -- p_parent_id
  TEXT, -- p_device_identifier
  TEXT, -- p_device_name
  TEXT, -- p_device_type
  TEXT, -- p_user_agent
  TEXT, -- p_ip_address
  UUID  -- p_child_id
) TO anon;

-- Grant execute permission to authenticated users (parents) as well (7-parameter version)
GRANT EXECUTE ON FUNCTION public.update_device_login(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
) TO authenticated;

-- Note: The function is SECURITY DEFINER, so it runs with elevated privileges
-- but we still need to grant execute permission to the roles that will call it
-- Migration 20250122000005 will add MAC address support and update permissions


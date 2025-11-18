-- Migration: Grant Permissions for revoke_device Function
-- Purpose: Allow authenticated users (parents) to call revoke_device function
-- This function is used to soft-delete devices from the device management page

-- Grant execute permission on revoke_device to authenticated users (parents)
GRANT EXECUTE ON FUNCTION public.revoke_device(
  UUID, -- p_device_id
  UUID  -- p_parent_id
) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.revoke_device IS 'Revokes (soft deletes) a device by setting is_active = false. Returns true if device was found and updated, false otherwise.';


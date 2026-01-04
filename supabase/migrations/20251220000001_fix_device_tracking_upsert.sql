-- Migration: Fix Device Tracking UPSERT
-- Purpose: Fix race condition in update_device_login by using INSERT ... ON CONFLICT DO UPDATE
-- This prevents duplicate key errors when multiple requests come in simultaneously

CREATE OR REPLACE FUNCTION "public"."update_device_login"(
  "p_parent_id" "uuid",
  "p_device_identifier" "text",
  "p_device_name" "text",
  "p_device_type" "text",
  "p_user_agent" "text",
  "p_ip_address" "text",
  "p_mac_address" "text" DEFAULT NULL::"text",
  "p_country_code" "text" DEFAULT NULL::"text",
  "p_child_id" "uuid" DEFAULT NULL::"uuid"
) RETURNS "uuid"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
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

  -- Use UPSERT pattern to handle race conditions
  -- This prevents duplicate key errors when multiple requests come in simultaneously
  INSERT INTO public.devices (
    parent_id,
    device_name,
    device_type,
    device_identifier,
    last_used_child_id,
    last_ip_address,
    mac_address,
    country_code,
    user_agent,
    last_login_at,
    is_active
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
    p_user_agent,
    NOW(),
    true
  )
  ON CONFLICT (parent_id, device_identifier)
  DO UPDATE SET
    last_login_at = NOW(),
    last_used_child_id = COALESCE(p_child_id, devices.last_used_child_id),
    last_ip_address = CASE
      WHEN ip_address_validated IS NULL THEN devices.last_ip_address
      ELSE ip_address_validated::inet
    END,
    mac_address = COALESCE(p_mac_address, devices.mac_address),
    country_code = COALESCE(p_country_code, devices.country_code),
    user_agent = p_user_agent,
    device_name = p_device_name,
    device_type = p_device_type,
    is_active = true, -- Reactivate device if it was inactive
    updated_at = NOW()
  RETURNING id INTO device_id;

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


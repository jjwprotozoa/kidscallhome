// src/hooks/useDeviceTracking.ts
// Purpose: Hook to track device on login

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateDeviceIdentifierAsync,
  detectDeviceType,
  getDeviceName,
  getClientIP,
  getDeviceMacAddress,
  getCountryFromIP,
} from "@/utils/deviceTracking";

export function useDeviceTracking(parentId?: string, childId?: string) {
  useEffect(() => {
    const trackDevice = async () => {
      try {
        // Only track for parents (children don't have device management)
        if (!parentId) return;

        const deviceIdentifier = await generateDeviceIdentifierAsync();
        const deviceType = detectDeviceType();
        const deviceName = getDeviceName();
        const userAgent = navigator.userAgent;
        const ipAddress = await getClientIP();
        const macAddress = await getDeviceMacAddress(); // Get MAC address for native apps
        const countryCode = await getCountryFromIP(ipAddress); // Get country code from IP

        // Call the database function to update/create device
        const { error } = await supabase.rpc("update_device_login", {
          p_parent_id: parentId,
          p_device_identifier: deviceIdentifier,
          p_device_name: deviceName,
          p_device_type: deviceType,
          p_user_agent: userAgent,
          p_ip_address: ipAddress || null,
          p_mac_address: macAddress || null,
          p_country_code: countryCode || null,
          p_child_id: childId || null,
        });

        if (error) {
          // Don't show error to user - device tracking is non-critical
          console.warn("Device tracking error:", error);
        }
      } catch (error) {
        // Silently fail - device tracking shouldn't break the app
        console.warn("Device tracking failed:", error);
      }
    };

    trackDevice();
  }, [parentId, childId]);
}


// src/pages/ChildLogin/useChildAuth.ts
// Purpose: Authentication hook for child login

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { setChildSession } from "@/lib/childSession";
import { authorizeDevice } from "@/utils/deviceAuthorization";
import { getClientIP } from "@/utils/deviceTracking";
import { logDeviceTracking } from "@/utils/deviceTrackingLog";
import { safeLog, sanitizeError } from "@/utils/security";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseLoginCode } from "./codeValidation";
import { SUCCESS_REDIRECT_DELAY_MS } from "./constants";
import { ChildSession } from "./types";

export const useChildAuth = (skipFamilyCode: boolean) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [childData, setChildData] = useState<ChildSession | null>(null);

  const trackDevice = useCallback(async (childData: ChildSession) => {
    if (!childData.parent_id) return;

    // Fire-and-forget device tracking
    void (async () => {
      try {
        const {
          generateDeviceIdentifierAsync,
          detectDeviceType,
          getDeviceName,
          getClientIP,
          getDeviceMacAddress,
          getCountryFromIP,
        } = await import("@/utils/deviceTracking");

        const deviceIdentifier = await generateDeviceIdentifierAsync();
        const deviceType = detectDeviceType();
        const deviceName = getDeviceName();
        const userAgent = navigator.userAgent;
        const ipAddress = await getClientIP();
        const macAddress = await getDeviceMacAddress();
        const countryCode = await getCountryFromIP(ipAddress);

        await logDeviceTracking("info", "Attempting to track device", {
          parent_id: childData.parent_id,
          child_id: childData.id,
          device_identifier: deviceIdentifier,
          metadata: {
            device_type: deviceType,
            device_name: deviceName,
            is_native:
              deviceIdentifier.startsWith("native-") ||
              deviceIdentifier.startsWith("cordova-") ||
              deviceIdentifier.startsWith("mac-"),
          },
        });

        // Try with country_code first
        let { data: deviceData, error: deviceError } = await supabase.rpc(
          "update_device_login",
          {
            p_parent_id: childData.parent_id,
            p_device_identifier: deviceIdentifier,
            p_device_name: deviceName,
            p_device_type: deviceType,
            p_user_agent: userAgent,
            p_ip_address: ipAddress || null,
            p_mac_address: macAddress || null,
            p_country_code: countryCode || null,
            p_child_id: childData.id,
          }
        );

        // Fallback without country_code if needed
        if (
          deviceError &&
          (deviceError.code === "42883" ||
            deviceError.message?.includes("function") ||
            deviceError.message?.includes("does not exist"))
        ) {
          await logDeviceTracking(
            "warn",
            "Function signature mismatch, trying without country_code",
            {
              parent_id: childData.parent_id,
              child_id: childData.id,
              device_identifier: deviceIdentifier,
              error: deviceError,
            }
          );

          const fallbackResult = await supabase.rpc("update_device_login", {
            p_parent_id: childData.parent_id,
            p_device_identifier: deviceIdentifier,
            p_device_name: deviceName,
            p_device_type: deviceType,
            p_user_agent: userAgent,
            p_ip_address: ipAddress || null,
            p_mac_address: macAddress || null,
            p_child_id: childData.id,
          });

          if (fallbackResult.error) {
            await logDeviceTracking("error", "Error (fallback also failed)", {
              parent_id: childData.parent_id,
              child_id: childData.id,
              device_identifier: deviceIdentifier,
              error: fallbackResult.error,
            });
            throw fallbackResult.error;
          }

          deviceData = fallbackResult.data;
          deviceError = null;
          await logDeviceTracking(
            "success",
            "Device tracked successfully (without country_code)",
            {
              parent_id: childData.parent_id,
              child_id: childData.id,
              device_identifier: deviceIdentifier,
              device_id: deviceData,
            }
          );
        } else if (deviceError) {
          await logDeviceTracking("error", "Device tracking error", {
            parent_id: childData.parent_id,
            child_id: childData.id,
            device_identifier: deviceIdentifier,
            error: deviceError,
          });
          throw deviceError;
        } else {
          await logDeviceTracking("success", "Device tracked successfully", {
            parent_id: childData.parent_id,
            child_id: childData.id,
            device_identifier: deviceIdentifier,
            device_id: deviceData,
          });
        }
      } catch (error) {
        await logDeviceTracking("error", "Failed to track device", {
          parent_id: childData.parent_id,
          child_id: childData.id,
          error: error instanceof Error ? error : { message: String(error) },
        });
      }
    })();
  }, []);

  // Helper function to safely log login attempts
  const logLoginAttempt = useCallback(
    async (
      ipAddress: string | null,
      success: boolean,
      childId?: string
    ): Promise<void> => {
      // Ensure IP is always valid (PostgreSQL inet type requires valid IP)
      const validIp = ipAddress && /^\d+\.\d+\.\d+\.\d+$/.test(ipAddress)
        ? ipAddress
        : "0.0.0.0";

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from as any)(
          "child_login_attempts"
        ).insert({
          ip_address: validIp,
          success,
          child_id: childId || null,
        });

        if (error) {
          // Log error but don't throw - login attempt logging is non-critical
          safeLog.debug("Failed to log login attempt", {
            error: sanitizeError(error),
            ip: validIp.substring(0, 7) + "****",
            success,
          });
        }
      } catch (error) {
        // Log error but don't throw - login attempt logging is non-critical
        safeLog.debug("Exception logging login attempt", {
          error: sanitizeError(error),
          ip: validIp.substring(0, 7) + "****",
          success,
        });
      }
    },
    []
  );

  const handleLoginWithCode = useCallback(
    async (fullCode: string) => {
      setLoading(true);
      try {
        // CRITICAL: Ensure anonymous access for child login
        const { data: authCheck } = await supabase.auth.getSession();
        if (authCheck?.session) {
          await supabase.auth.signOut();
        }

        // Get client IP for rate limiting (ensure it's always a valid string)
        const clientIpRaw = await getClientIP().catch(() => null);
        const clientIp = clientIpRaw && /^\d+\.\d+\.\d+\.\d+$/.test(clientIpRaw)
          ? clientIpRaw
          : "0.0.0.0";

        // Check rate limit first
        // New function not yet in types (will be added after migration)
        const { data: rateLimitOk, error: rateLimitError } =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.rpc as any)("check_child_login_rate_limit", {
            client_ip: clientIp,
          });

        if (rateLimitError) {
          safeLog.error(
            "Rate limit check error:",
            sanitizeError(rateLimitError)
          );
          // Continue with login attempt even if rate limit check fails
          // (fail open for better UX, but log the error)
        } else if (rateLimitOk === false) {
          toast({
            title: "Too many login attempts",
            description:
              "You have attempted to log in too many times. Please wait an hour and try again.",
            variant: "destructive",
          });
          setLoading(false);
          return { success: false, error: "Rate limit exceeded" };
        }

        // Parse and validate code
        const parseResult = parseLoginCode(fullCode);
        if (!parseResult.valid || !parseResult.parsed) {
          // Log failed attempt (fire-and-forget)
          await logLoginAttempt(clientIp, false);

          toast({
            title: "Invalid login code",
            description: parseResult.error || "Login code format is incorrect",
            variant: "destructive",
          });
          setLoading(false);
          return { success: false, error: parseResult.error };
        }

        const { normalizedFamilyCode, normalizedChildCode } =
          parseResult.parsed;

        // Get parent_id from family_code
        const { data: parentData, error: parentError } = await supabase
          .from("parents")
          .select("id")
          .eq("family_code", normalizedFamilyCode)
          .maybeSingle();

        if (parentError || !parentData) {
          // Log failed attempt (fire-and-forget)
          await logLoginAttempt(clientIp, false);

          safeLog.debug("Family code not found", {
            familyCode: normalizedFamilyCode.substring(0, 2) + "****",
            error: parentError?.message,
          });
          toast({
            title: "Code not found",
            description: "Please check your family code and try again",
            variant: "destructive",
          });
          setLoading(false);
          return { success: false, error: "Family code not found" };
        }

        // Query children with parent_id and child_code
        const { data, error } = await supabase
          .from("children")
          .select("id, name, avatar_color, parent_id")
          .eq("parent_id", parentData.id)
          .eq("login_code", normalizedChildCode)
          .maybeSingle();

        if (error) {
          // Log failed attempt (fire-and-forget)
          await logLoginAttempt(clientIp, false);

          safeLog.error("Login error:", {
            error: sanitizeError(error),
            errorCode: error.code,
            errorMessage: error.message,
            parentId: parentData.id.substring(0, 8) + "****",
          });
          toast({
            title: "Login error",
            description:
              error.message || "Failed to verify login code. Please try again.",
            variant: "destructive",
          });
          setLoading(false);
          return { success: false, error: error.message };
        }

        if (!data) {
          // Log failed attempt (fire-and-forget)
          await logLoginAttempt(clientIp, false);

          safeLog.debug("Child code not found", {
            parentId: parentData.id.substring(0, 8) + "****",
            searchedCode: normalizedChildCode,
          });
          toast({
            title: "Code not found",
            description: `The child code "${normalizedChildCode}" was not found. Please check your code and try again.`,
            variant: "destructive",
          });
          setLoading(false);
          return { success: false, error: "Child code not found" };
        }

        // Log successful attempt (fire-and-forget)
        await logLoginAttempt(clientIp, true, data.id);

        // Success - create enhanced session with expiration and device fingerprint
        setChildData(data);
        
        // Set session synchronously before navigation
        setChildSession({
          childId: data.id,
          childName: data.name,
          avatarColor: data.avatar_color,
          parentId: data.parent_id,
        });

        // Verify session was set correctly before navigating
        // Use a small delay to ensure localStorage write completes
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Double-check session exists before navigation
        const { getChildSessionLegacy } = await import("@/lib/childSession");
        const verifySession = getChildSessionLegacy();
        if (!verifySession) {
          safeLog.error("Session verification failed after setting", {
            childId: data.id.substring(0, 8) + "****",
          });
          toast({
            title: "Session error",
            description: "Failed to create session. Please try logging in again.",
            variant: "destructive",
          });
          setLoading(false);
          return { success: false, error: "Session creation failed" };
        }

        // Authorize device if family code was used (new device)
        if (!skipFamilyCode) {
          authorizeDevice(data.id);
        }

        // Navigate after delay (show success message briefly)
        setTimeout(() => {
          navigate("/child/dashboard", { replace: true });
        }, SUCCESS_REDIRECT_DELAY_MS);

        // Track device (fire-and-forget)
        await trackDevice(data);

        return { success: true, childData: data };
      } catch (error: unknown) {
        safeLog.error("Login exception:", sanitizeError(error));
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "An error occurred during login",
          variant: "destructive",
        });
        setLoading(false);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        };
      } finally {
        setLoading(false);
      }
    },
    [navigate, toast, skipFamilyCode, trackDevice, logLoginAttempt]
  );

  return {
    loading,
    childData,
    handleLoginWithCode,
  };
};

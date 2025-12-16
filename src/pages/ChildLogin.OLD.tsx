// src/pages/ChildLogin.tsx
// Purpose: Kid-friendly login page with visual color/animal selection and number keypad

import { ColorAnimalSelector } from "@/components/childLogin/ColorAnimalSelector";
import { FamilyCodeKeypad } from "@/components/childLogin/FamilyCodeKeypad";
import { NumberEntryScreen } from "@/components/childLogin/NumberEntryScreen";
import { SuccessScreen } from "@/components/childLogin/SuccessScreen";
import { colors } from "@/data/childLoginConstants";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  authorizeDevice,
  getAuthorizedChildId,
  isDeviceAuthorized,
} from "@/utils/deviceAuthorization";
import { logDeviceTracking } from "@/utils/deviceTrackingLog";
import { safeLog, sanitizeError } from "@/utils/security";
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const ChildLogin = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<
    "familyCode" | "select" | "number" | "success"
  >("familyCode");
  const [familyCode, setFamilyCode] = useState<string>("");
  const [currentBlock, setCurrentBlock] = useState<number>(0); // Default to Block 1 (A-I)
  const [codeType, setCodeType] = useState<"color" | "animal">("color");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [number, setNumber] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [childData, setChildData] = useState<{
    id: string;
    name: string;
    avatar_color: string;
  } | null>(null);
  const [skipFamilyCode, setSkipFamilyCode] = useState(false); // Skip family code if device is authorized
  const navigate = useNavigate();
  const { toast } = useToast();
  const magicLinkProcessed = useRef(false); // Track if magic link has been processed

  const handleLoginWithCode = useCallback(async (fullCode: string) => {
    setLoading(true);
    try {
      // CRITICAL: Ensure we're using anonymous access for child login
      // Children should use anonymous role, not authenticated
      const { data: authCheck } = await supabase.auth.getSession();
      if (authCheck?.session) {
        await supabase.auth.signOut();
      }

      // Normalize the code: replace spaces with hyphens and trim
      // This allows users to enter "dog 42" or "dog-42" or "FAMILY-dog-42"
      const normalizedCode = fullCode.trim().replace(/\s+/g, "-");
      
      // Parse the full code: familyCode-color/animal-number
      const parts = normalizedCode.split("-");
      if (parts.length !== 3) {
        toast({
          title: "Invalid login code",
          description: "Login code must be in format: familyCode-color/animal-number",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const [famCode, option, num] = parts;
      const normalizedFamilyCode = famCode.toUpperCase().trim();
      // Normalize child code: lowercase option, normalize number (remove leading zeros)
      const normalizedOption = option.toLowerCase().trim();
      // Parse number to remove leading zeros (e.g., "042" -> "42", "7" -> "7")
      const normalizedNum = parseInt(num.trim(), 10).toString();
      if (isNaN(parseInt(normalizedNum, 10)) || parseInt(normalizedNum, 10) < 1 || parseInt(normalizedNum, 10) > 99) {
        toast({
          title: "Invalid login code",
          description: "The number in your login code must be between 1 and 99",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const normalizedChildCode = `${normalizedOption}-${normalizedNum}`;

      // First, get parent_id from family_code
      const { data: parentData, error: parentError } = await supabase
        .from("parents")
        .select("id")
        .eq("family_code", normalizedFamilyCode)
        .maybeSingle();

      if (parentError || !parentData) {
        safeLog.debug("Family code not found", { 
          familyCode: normalizedFamilyCode.substring(0, 2) + "****", 
          error: parentError?.message 
        });
        toast({
          title: "Code not found",
          description: "Please check your family code and try again",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Then query children with parent_id and child_code
      // Note: login_code in database stores only child-specific part (e.g., "dog-42")
      const { data, error } = await supabase
        .from("children")
        .select("id, name, avatar_color, parent_id")
        .eq("parent_id", parentData.id)
        .eq("login_code", normalizedChildCode)
        .maybeSingle();

      if (error) {
        // SECURITY: Never log login codes - they are sensitive credentials
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
        setNumber("");
        setFamilyCode("");
        setStep("familyCode");
        setLoading(false);
        return;
      }

      if (!data) {
        // SECURITY: Never log login codes - they are sensitive credentials
        // This is expected behavior for invalid codes - log as debug, not error
        // Debug: Check if there are any children for this parent to help diagnose
        const { data: childrenCheck, error: childrenError } = await supabase
          .from("children")
          .select("login_code")
          .eq("parent_id", parentData.id)
          .limit(5);
        
        safeLog.debug("Child code not found", {
          parentId: parentData.id.substring(0, 8) + "****",
          searchedCode: normalizedChildCode,
          childrenCount: childrenCheck?.length || 0,
          childrenError: childrenError?.message,
          availableCodes: childrenCheck?.map(c => c.login_code?.substring(0, 5) + "****") || [],
        });
        
        toast({
          title: "Code not found",
          description: `The child code "${normalizedOption}-${normalizedNum}" was not found. Please check your code and try again.`,
          variant: "destructive",
        });
        setNumber("");
        setFamilyCode("");
        setStep("familyCode");
        setLoading(false);
        return;
      }

      setChildData(data);
      setStep("success");
      localStorage.setItem("childSession", JSON.stringify(data));

      // Authorize device if family code was used (new device)
      if (!skipFamilyCode) {
        authorizeDevice(data.id);
      }

      // Navigate immediately - don't wait for device tracking
      setTimeout(() => {
        navigate("/child/dashboard");
      }, 2000);

      // Track device on child login (for parent's device management)
      // PERFORMANCE: Fire-and-forget - don't block navigation
      if (data.parent_id) {
        // Use void to explicitly mark as fire-and-forget
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
              parent_id: data.parent_id,
              child_id: data.id,
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

            // Try calling with country_code first (if migration 20250122000012 has been applied)
            let { data: deviceData, error: deviceError } = await supabase.rpc(
              "update_device_login",
              {
                p_parent_id: data.parent_id,
                p_device_identifier: deviceIdentifier,
                p_device_name: deviceName,
                p_device_type: deviceType,
                p_user_agent: userAgent,
                p_ip_address: ipAddress || null,
                p_mac_address: macAddress || null,
                p_country_code: countryCode || null,
                p_child_id: data.id,
              }
            );

            // If error suggests function signature mismatch, try without country_code
            // This handles the case where migration 20250122000012 hasn't been applied yet
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
                  parent_id: data.parent_id,
                  child_id: data.id,
                  device_identifier: deviceIdentifier,
                  error: deviceError,
                }
              );

              // Fallback: try without country_code parameter (for older function signature)
              const fallbackResult = await supabase.rpc("update_device_login", {
                p_parent_id: data.parent_id,
                p_device_identifier: deviceIdentifier,
                p_device_name: deviceName,
                p_device_type: deviceType,
                p_user_agent: userAgent,
                p_ip_address: ipAddress || null,
                p_mac_address: macAddress || null,
                p_child_id: data.id,
              });

              if (fallbackResult.error) {
                await logDeviceTracking("error", "Error (fallback also failed)", {
                  parent_id: data.parent_id,
                  child_id: data.id,
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
                  parent_id: data.parent_id,
                  child_id: data.id,
                  device_identifier: deviceIdentifier,
                  device_id: deviceData,
                }
              );
            } else if (deviceError) {
              await logDeviceTracking("error", "Device tracking error", {
                parent_id: data.parent_id,
                child_id: data.id,
                device_identifier: deviceIdentifier,
                error: deviceError,
              });
              throw deviceError;
            } else {
              await logDeviceTracking("success", "Device tracked successfully", {
                parent_id: data.parent_id,
                child_id: data.id,
                device_identifier: deviceIdentifier,
                device_id: deviceData,
              });
            }
          } catch (error) {
            // Log error but don't break login
            await logDeviceTracking("error", "Failed to track device", {
              parent_id: data.parent_id,
              child_id: data.id,
              error: error instanceof Error ? error : { message: String(error) },
            });
          }
        })();
      }
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
      setStep("familyCode");
      setLoading(false);
    }
  }, [navigate, toast, skipFamilyCode]);

  // Handle magic link with code parameter - MUST run first to take priority
  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam && codeParam.trim() !== "" && !magicLinkProcessed.current) {
      magicLinkProcessed.current = true; // Mark as processed to prevent re-running
      
      // Process magic link immediately
      // Normalize spaces to hyphens to handle user input like "dog 42"
      const decodedCode = decodeURIComponent(codeParam.trim()).replace(/\s+/g, "-");
      const parts = decodedCode.split("-");

      if (parts.length === 3) {
        const [famCode, option, num] = parts;
        // Validate family code is exactly 6 characters
        const cleanedFamilyCode = famCode
          ?.toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 6) || "";
        
        if (
          cleanedFamilyCode.length === 6 &&
          option &&
          num &&
          option.length > 0 &&
          num.length > 0
        ) {
          setFamilyCode(cleanedFamilyCode);
          setSelectedOption(option.toLowerCase());
          setNumber(num);
          // Determine if it's a color or animal
          const isColor = colors.some((c) => c.name === option.toLowerCase());
          setCodeType(isColor ? "color" : "animal");
          // Magic link always requires family code (new device)
          setSkipFamilyCode(false);
          // Normalize the code to match database format before auto-login
          // Format: FAMILYCODE-option-number (uppercase family code, lowercase option)
          const normalizedMagicCode = `${cleanedFamilyCode}-${option.toLowerCase()}-${num}`;
          // Auto-login immediately - no delay needed
          handleLoginWithCode(normalizedMagicCode);
        } else {
          toast({
            title: "Invalid login code",
            description:
              cleanedFamilyCode.length !== 6
                ? "Family code must be exactly 6 characters. Please check and try again."
                : "The login code format is incorrect. Please check and try again.",
            variant: "destructive",
          });
          magicLinkProcessed.current = false; // Reset on error to allow retry
        }
      } else {
        toast({
          title: "Invalid login code",
          description:
            "The login code format is incorrect. Expected: familyCode-color/animal-number (e.g., ABC123-monkey-37)",
          variant: "destructive",
        });
        magicLinkProcessed.current = false; // Reset on error to allow retry
      }
    }
  }, [searchParams, handleLoginWithCode, toast]);

  // Check if device is already authorized on mount - but skip if magic link is being processed
  useEffect(() => {
    // Don't run device authorization check if magic link code parameter is present
    const codeParam = searchParams.get("code");
    if (codeParam && codeParam.trim() !== "") {
      return; // Magic link handler will take care of this
    }
    
    // Don't run device authorization check if magic link is being processed
    if (magicLinkProcessed.current) {
      return;
    }
    
    const checkDeviceAuthorization = async () => {
      const authorizedChildId = getAuthorizedChildId();
      if (authorizedChildId && isDeviceAuthorized(authorizedChildId)) {
        // Device is authorized - check if child session still exists
        const sessionData = localStorage.getItem("childSession");
        if (sessionData) {
          try {
            const childData = JSON.parse(sessionData);
            if (childData.id === authorizedChildId) {
              // Device is authorized and session exists - skip to dashboard
              navigate("/child/dashboard");
              return;
            }
          } catch {
            // Invalid session data, continue with login
          }
        }
        // Device is authorized but no session - skip family code, go to select step
        // Fetch child data to get login code parts
        try {
          const { data: childRecord } = await supabase
            .from("children")
            .select("login_code")
            .eq("id", authorizedChildId)
            .maybeSingle();

          if (childRecord?.login_code) {
            // Parse login code to extract color/animal and number
            const parts = childRecord.login_code.split("-");
            if (parts.length === 3) {
              const [, option, num] = parts;
              setSelectedOption(option);
              setNumber(num);
              const isColor = colors.some((c) => c.name === option);
              setCodeType(isColor ? "color" : "animal");
              setSkipFamilyCode(true);
              setStep("select"); // Skip family code, go to select step
            }
          }
        } catch (error) {
          console.warn(
            "Failed to fetch child data for authorized device:",
            error
          );
          // Continue with normal login flow
        }
      }
    };

    checkDeviceAuthorization();
  }, [navigate, searchParams]);

  const handleOptionSelect = (option: string, type: "color" | "animal") => {
    setSelectedOption(option);
    setCodeType(type);
    setStep("number");
  };

  const handleNumberClick = (num: string) => {
    const newNumber = number + num;
    // Limit to 2 digits (1-99)
    if (newNumber.length <= 2 && parseInt(newNumber) <= 99) {
      setNumber(newNumber);
    }
  };

  const handleDelete = () => {
    setNumber(number.slice(0, -1));
  };

  const handleBack = () => {
    if (step === "number") {
      setStep("select");
      setNumber("");
    } else if (step === "select") {
      setStep("familyCode");
      setSelectedOption("");
    }
  };

  const handleFamilyCodeSubmit = () => {
    if (!familyCode || familyCode.trim().length < 3) {
      toast({
        title: "Family code required",
        description: "Please enter your family code (6 characters)",
        variant: "destructive",
      });
      return;
    }
    setStep("select");
  };

  const handleFamilyCodeChange = (value: string) => {
    // Only allow alphanumeric, uppercase, max 6 characters
    const cleaned = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    setFamilyCode(cleaned);
  };

  const handleBlockChange = (newBlock: number) => {
    setCurrentBlock(newBlock);
  };

  const handleLogin = async () => {
    // If device is authorized, we can skip family code
    let loginCode: string;

    // If user entered a family code, always use it (even if device is authorized)
    // This allows logging in as a different child on the same device
    if (familyCode && selectedOption && number) {
      // User entered family code - use it to construct login code
      // Store only child-specific part for query
      // Format: color/animal-number (family code is stored in parents table)
      loginCode = `${selectedOption.toLowerCase()}-${number}`;
    } else if (skipFamilyCode && selectedOption && number) {
      // Authorized device - get full login code from database (no family code entered)
      const authorizedChildId = getAuthorizedChildId();
      if (authorizedChildId) {
        try {
          const { data: childRecord } = await supabase
            .from("children")
            .select("login_code")
            .eq("id", authorizedChildId)
            .maybeSingle();

          if (childRecord?.login_code) {
            loginCode = childRecord.login_code;
          } else {
            toast({
              title: "Error",
              description:
                "Could not find your login code. Please enter your family code.",
              variant: "destructive",
            });
            setStep("familyCode");
            setSkipFamilyCode(false);
            return;
          }
        } catch (error) {
          toast({
            title: "Error",
            description:
              "Could not verify your login code. Please enter your family code.",
            variant: "destructive",
          });
          setStep("familyCode");
          setSkipFamilyCode(false);
          return;
        }
      } else {
        toast({
          title: "Incomplete code",
          description:
            "Please enter your family code, select a color/animal, and enter your number",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Missing required fields
      toast({
        title: "Incomplete code",
        description:
          "Please enter your family code, select a color/animal, and enter your number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // First, get parent_id from family_code
      const normalizedFamilyCode = familyCode.toUpperCase();
      const { data: parentData, error: parentError } = await supabase
        .from("parents")
        .select("id")
        .eq("family_code", normalizedFamilyCode)
        .maybeSingle();

      if (parentError || !parentData) {
        toast({
          title: "Code not found",
          description: "Please check your family code and try again",
          variant: "destructive",
        });
        setNumber("");
        setLoading(false);
        return;
      }

      // Then query children with parent_id and child_code
      const { data, error } = await supabase
        .from("children")
        .select("id, name, avatar_color, parent_id")
        .eq("parent_id", parentData.id)
        .eq("login_code", loginCode)
        .single();

      if (error || !data) {
        toast({
          title: "Code not found",
          description: "Please check your code and try again",
          variant: "destructive",
        });
        setNumber("");
        return;
      }

      // Show success animation
      setChildData(data);
      setStep("success");

      // Store child session in localStorage
      localStorage.setItem("childSession", JSON.stringify(data));

      // Authorize device if family code was used (new device)
      if (!skipFamilyCode) {
        authorizeDevice(data.id);
      }

      // Navigate immediately - don't wait for device tracking
      setTimeout(() => {
        navigate("/child/dashboard");
      }, 2000);

      // Track device on child login (for parent's device management)
      // PERFORMANCE: Fire-and-forget - don't block navigation
      if (data.parent_id) {
        // Use void to explicitly mark as fire-and-forget
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
              parent_id: data.parent_id,
              child_id: data.id,
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

            // Try calling with country_code first (if migration 20250122000012 has been applied)
            let { data: deviceData, error: deviceError } = await supabase.rpc(
              "update_device_login",
              {
                p_parent_id: data.parent_id,
                p_device_identifier: deviceIdentifier,
                p_device_name: deviceName,
                p_device_type: deviceType,
                p_user_agent: userAgent,
                p_ip_address: ipAddress || null,
                p_mac_address: macAddress || null,
                p_country_code: countryCode || null,
                p_child_id: data.id,
              }
            );

            // If error suggests function signature mismatch, try without country_code
            // This handles the case where migration 20250122000012 hasn't been applied yet
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
                  parent_id: data.parent_id,
                  child_id: data.id,
                  device_identifier: deviceIdentifier,
                  error: deviceError,
                }
              );

              // Fallback: try without country_code parameter (for older function signature)
              const fallbackResult = await supabase.rpc("update_device_login", {
                p_parent_id: data.parent_id,
                p_device_identifier: deviceIdentifier,
                p_device_name: deviceName,
                p_device_type: deviceType,
                p_user_agent: userAgent,
                p_ip_address: ipAddress || null,
                p_mac_address: macAddress || null,
                p_child_id: data.id,
              });

              if (fallbackResult.error) {
                await logDeviceTracking("error", "Error (fallback also failed)", {
                  parent_id: data.parent_id,
                  child_id: data.id,
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
                  parent_id: data.parent_id,
                  child_id: data.id,
                  device_identifier: deviceIdentifier,
                  device_id: deviceData,
                }
              );
            } else if (deviceError) {
              await logDeviceTracking("error", "Device tracking error", {
                parent_id: data.parent_id,
                child_id: data.id,
                device_identifier: deviceIdentifier,
                error: deviceError,
              });
              throw deviceError;
            } else {
              await logDeviceTracking("success", "Device tracked successfully", {
                parent_id: data.parent_id,
                child_id: data.id,
                device_identifier: deviceIdentifier,
                device_id: deviceData,
              });
            }
          } catch (error) {
            // Log error but don't break login
            await logDeviceTracking("error", "Failed to track device", {
              parent_id: data.parent_id,
              child_id: data.id,
              error: error instanceof Error ? error : { message: String(error) },
            });
          }
        })();
      }
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
      setNumber("");
    } finally {
      setLoading(false);
    }
  };

  // Success animation screen
  if (step === "success" && childData) {
    return (
      <SuccessScreen
        childName={childData.name}
        avatarColor={childData.avatar_color}
      />
    );
  }

  // Number entry screen
  if (step === "number") {
    return (
      <NumberEntryScreen
        selectedOption={selectedOption}
        codeType={codeType}
        familyCode={familyCode}
        number={number}
        loading={loading}
        onBack={handleBack}
        onNumberClick={handleNumberClick}
        onDelete={handleDelete}
        onLogin={handleLogin}
      />
    );
  }

  // Family code entry screen
  if (step === "familyCode") {
    return (
      <FamilyCodeKeypad
        familyCode={familyCode}
        currentBlock={currentBlock}
        loading={loading}
        onFamilyCodeChange={handleFamilyCodeChange}
        onBlockChange={handleBlockChange}
        onDelete={() => setFamilyCode(familyCode.slice(0, -1))}
        onSubmit={handleFamilyCodeSubmit}
      />
    );
  }

  // Initial selection screen
  return (
    <ColorAnimalSelector
      familyCode={familyCode}
      codeType={codeType}
      onCodeTypeChange={setCodeType}
      onOptionSelect={handleOptionSelect}
      onBack={handleBack}
    />
  );
};

export default ChildLogin;

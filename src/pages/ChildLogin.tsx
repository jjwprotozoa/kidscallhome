// src/pages/ChildLogin.tsx
// Purpose: Kid-friendly login page with visual color/animal selection and number keypad

import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Smile, Delete, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { isDeviceAuthorized, authorizeDevice, getAuthorizedChildId } from "@/utils/deviceAuthorization";

// Kid-friendly login code options (must match AddChildDialog)
const colors = [
  { name: "red", color: "#EF4444" },
  { name: "blue", color: "#3B82F6" },
  { name: "green", color: "#10B981" },
  { name: "yellow", color: "#FBBF24" },
  { name: "orange", color: "#F97316" },
  { name: "purple", color: "#A855F7" },
  { name: "pink", color: "#EC4899" },
  { name: "brown", color: "#92400E" },
  { name: "black", color: "#1F2937" },
  { name: "white", color: "#F3F4F6" },
];

const animals = [
  { name: "cat", emoji: "🐱" },
  { name: "dog", emoji: "🐶" },
  { name: "bird", emoji: "🐦" },
  { name: "fish", emoji: "🐠" },
  { name: "bear", emoji: "🐻" },
  { name: "lion", emoji: "🦁" },
  { name: "tiger", emoji: "🐯" },
  { name: "elephant", emoji: "🐘" },
  { name: "monkey", emoji: "🐵" },
  { name: "rabbit", emoji: "🐰" },
  { name: "horse", emoji: "🐴" },
  { name: "duck", emoji: "🦆" },
  { name: "cow", emoji: "🐄" },
  { name: "pig", emoji: "🐷" },
  { name: "sheep", emoji: "🐑" },
];

// Keypad blocks configuration
const KEYPAD_BLOCKS = [
  { id: 0, label: "A-I", chars: ["A", "B", "C", "D", "E", "F", "G", "H", "I"] },
  { id: 1, label: "J-R", chars: ["J", "K", "L", "M", "N", "O", "P", "Q", "R"] },
  { id: 2, label: "S-Z", chars: ["S", "T", "U", "V", "W", "X", "Y", "Z"] },
  { id: 3, label: "0-9", chars: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] },
];

const ChildLogin = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<"familyCode" | "select" | "number" | "success">("familyCode");
  const [familyCode, setFamilyCode] = useState<string>("");
  const [currentBlock, setCurrentBlock] = useState<number>(0); // Default to Block 1 (A-I)
  const [codeType, setCodeType] = useState<"color" | "animal">("color");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [number, setNumber] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [childData, setChildData] = useState<{ id: string; name: string; avatar_color: string } | null>(null);
  const [skipFamilyCode, setSkipFamilyCode] = useState(false); // Skip family code if device is authorized
  const navigate = useNavigate();
  const { toast } = useToast();
  const keypadRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const handleLoginWithCode = async (fullCode: string) => {
    setLoading(true);
    try {
      // Normalize the code: uppercase family code, lowercase option
      const parts = fullCode.split("-");
      let normalizedCode = fullCode;
      if (parts.length === 3) {
        const [famCode, option, num] = parts;
        normalizedCode = `${famCode.toUpperCase()}-${option.toLowerCase()}-${num}`;
      }

      const { data, error } = await supabase
        .from("children")
        .select("id, name, avatar_color, parent_id")
        .eq("login_code", normalizedCode)
        .maybeSingle();

      if (error) {
        console.error("Login error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        console.error("Attempted code:", normalizedCode);
        toast({
          title: "Login error",
          description: error.message || "Failed to verify login code. Please try again.",
          variant: "destructive",
        });
        setNumber("");
        setFamilyCode("");
        setStep("familyCode");
        setLoading(false);
        return;
      }

      if (!data) {
        console.error("No data returned for code:", normalizedCode);
        toast({
          title: "Code not found",
          description: "Please check your code and try again",
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

      // Track device on child login (for parent's device management)
      if (data.parent_id) {
        try {
          const { generateDeviceIdentifierAsync, detectDeviceType, getDeviceName, getClientIP, getDeviceMacAddress } = await import("@/utils/deviceTracking");
          const deviceIdentifier = await generateDeviceIdentifierAsync();
          const deviceType = detectDeviceType();
          const deviceName = getDeviceName();
          const userAgent = navigator.userAgent;
          const ipAddress = await getClientIP();
          const macAddress = await getDeviceMacAddress();
          
          console.log("🔍 [DEVICE TRACKING] Attempting to track device:", {
            parent_id: data.parent_id,
            child_id: data.id,
            device_identifier: deviceIdentifier,
            device_type: deviceType,
            device_name: deviceName,
            is_native: deviceIdentifier.startsWith('native-') || deviceIdentifier.startsWith('cordova-') || deviceIdentifier.startsWith('mac-'),
            mac_address: macAddress || 'not available',
          });
          
          const { data: deviceData, error: deviceError } = await supabase.rpc("update_device_login", {
            p_parent_id: data.parent_id,
            p_device_identifier: deviceIdentifier,
            p_device_name: deviceName,
            p_device_type: deviceType,
            p_user_agent: userAgent,
            p_ip_address: ipAddress || null,
            p_mac_address: macAddress || null,
            p_child_id: data.id,
          });
          
          if (deviceError) {
            console.error("❌ [DEVICE TRACKING] Error:", deviceError);
            throw deviceError;
          }
          
          console.log("✅ [DEVICE TRACKING] Device tracked successfully:", deviceData);
        } catch (error) {
          // Log error but don't break login
          console.error("❌ [DEVICE TRACKING] Failed to track device:", error);
        }
      }

      // Navigate after animation
      setTimeout(() => {
        navigate("/child/dashboard");
      }, 2000);
    } catch (error: any) {
      console.error("Login exception:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred during login",
        variant: "destructive",
      });
      setStep("familyCode");
      setLoading(false);
    }
  };

  // Check if device is already authorized on mount
  useEffect(() => {
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
          console.warn("Failed to fetch child data for authorized device:", error);
          // Continue with normal login flow
        }
      }
    };

    checkDeviceAuthorization();
  }, [navigate]);

  // Handle magic link with code parameter
  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam && codeParam.trim() !== "" && step === "familyCode") {
      // Only process magic link if we're on the initial familyCode step
      // This prevents re-processing if user navigates back
      const decodedCode = decodeURIComponent(codeParam.trim());
      const parts = decodedCode.split("-");
      
      if (parts.length === 3) {
        const [famCode, option, num] = parts;
        if (famCode && option && num && famCode.length > 0 && option.length > 0 && num.length > 0) {
          setFamilyCode(famCode.toUpperCase());
          setSelectedOption(option);
          setNumber(num);
          // Determine if it's a color or animal
          const isColor = colors.some((c) => c.name === option);
          setCodeType(isColor ? "color" : "animal");
          // Magic link always requires family code (new device)
          setSkipFamilyCode(false);
          // Don't change step - let handleLoginWithCode handle navigation
          // Auto-login if code is provided
          setTimeout(() => {
            handleLoginWithCode(decodedCode);
          }, 500);
        } else {
          toast({
            title: "Invalid login code",
            description: "The login code format is incorrect. Please check and try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Invalid login code",
          description: "The login code format is incorrect. Expected: familyCode-color/animal-number",
          variant: "destructive",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setFamilyCode(cleaned);
  };

  const handleBlockChange = (newBlock: number) => {
    if (newBlock >= 0 && newBlock < KEYPAD_BLOCKS.length) {
      setCurrentBlock(newBlock);
    }
  };

  const handleSwipeStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleSwipeMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleSwipeEnd = () => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50; // Minimum distance for a swipe

    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        // Swipe left - go to next block
        handleBlockChange(Math.min(currentBlock + 1, KEYPAD_BLOCKS.length - 1));
      } else {
        // Swipe right - go to previous block
        handleBlockChange(Math.max(currentBlock - 1, 0));
      }
    }
  };

  const handleLogin = async () => {
    // If device is authorized, we can skip family code
    let loginCode: string;
    
    if (skipFamilyCode && selectedOption && number) {
      // Authorized device - get full login code from database
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
              description: "Could not find your login code. Please enter your family code.",
              variant: "destructive",
            });
            setStep("familyCode");
            setSkipFamilyCode(false);
            return;
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "Could not verify your login code. Please enter your family code.",
            variant: "destructive",
          });
          setStep("familyCode");
          setSkipFamilyCode(false);
          return;
        }
      } else {
        toast({
          title: "Incomplete code",
          description: "Please enter your family code, select a color/animal, and enter your number",
          variant: "destructive",
        });
        return;
      }
    } else {
      // New device - require family code
      if (!familyCode || !selectedOption || !number) {
        toast({
          title: "Incomplete code",
          description: "Please enter your family code, select a color/animal, and enter your number",
          variant: "destructive",
        });
        return;
      }
      // Format: familyCode-color/animal-number
      loginCode = `${familyCode.toUpperCase()}-${selectedOption}-${number}`;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("children")
        .select("id, name, avatar_color, parent_id")
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

      // Track device on child login (for parent's device management)
      if (data.parent_id) {
        try {
          const { generateDeviceIdentifier, detectDeviceType, getDeviceName, getClientIP, getDeviceMacAddress } = await import("@/utils/deviceTracking");
          const deviceIdentifier = generateDeviceIdentifier();
          const deviceType = detectDeviceType();
          const deviceName = getDeviceName();
          const userAgent = navigator.userAgent;
          const ipAddress = await getClientIP();
          const macAddress = await getDeviceMacAddress();
          
          console.log("🔍 [DEVICE TRACKING] Attempting to track device:", {
            parent_id: data.parent_id,
            child_id: data.id,
            device_identifier: deviceIdentifier,
            device_type: deviceType,
            device_name: deviceName,
            mac_address: macAddress || 'not available',
          });
          
          const { data: deviceData, error: deviceError } = await supabase.rpc("update_device_login", {
            p_parent_id: data.parent_id,
            p_device_identifier: deviceIdentifier,
            p_device_name: deviceName,
            p_device_type: deviceType,
            p_user_agent: userAgent,
            p_ip_address: ipAddress || null,
            p_mac_address: macAddress || null,
            p_child_id: data.id,
          });
          
          if (deviceError) {
            console.error("❌ [DEVICE TRACKING] Error:", deviceError);
            throw deviceError;
          }
          
          console.log("✅ [DEVICE TRACKING] Device tracked successfully:", deviceData);
        } catch (error) {
          // Log error but don't break login
          console.error("❌ [DEVICE TRACKING] Failed to track device:", error);
        }
      }

      // Navigate after animation
      setTimeout(() => {
        navigate("/child/dashboard");
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-primary/5 p-4">
        <Card className="w-full max-w-md p-8 space-y-6 text-center">
          <div className="space-y-4 animate-bounce">
            <div className="flex justify-center">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-lg"
                style={{ backgroundColor: childData.avatar_color }}
              >
                {childData.name[0].toUpperCase()}
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <Sparkles className="h-8 w-8 text-yellow-500 animate-pulse" />
              <h1 className="text-4xl font-bold text-primary">
                Welcome, {childData.name}!
              </h1>
              <Sparkles className="h-8 w-8 text-yellow-500 animate-pulse" />
            </div>
            <p className="text-xl text-muted-foreground">You're all set! 🎉</p>
          </div>
        </Card>
      </div>
    );
  }

  // Number entry screen
  if (step === "number") {
    const selectedItem = codeType === "color"
      ? colors.find((c) => c.name === selectedOption)
      : animals.find((a) => a.name === selectedOption);

    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-primary/5 p-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="absolute top-4 left-4"
            >
              ← Back
            </Button>
            <div className="flex items-center justify-center gap-3">
              {codeType === "color" && selectedItem ? (
                <div
                  className="w-16 h-16 rounded-full border-4 border-primary"
                  style={{ backgroundColor: selectedItem.color }}
                />
              ) : selectedItem ? (
                <div className="text-6xl">{selectedItem.emoji}</div>
              ) : null}
              <div>
                <h2 className="text-2xl font-bold capitalize">{selectedOption}</h2>
                <p className="text-muted-foreground">Family: <span className="font-mono font-semibold">{familyCode}</span></p>
                <p className="text-muted-foreground">Now enter your number</p>
              </div>
            </div>
          </div>

          <div className="bg-muted p-6 rounded-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-32 h-20 rounded-xl bg-card flex items-center justify-center border-2 border-primary/20">
                <span className="text-5xl font-bold text-primary">
                  {number || "?"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                size="lg"
                variant="outline"
                className="h-16 text-2xl font-bold rounded-xl"
              >
                {num}
              </Button>
            ))}
            <Button
              onClick={handleDelete}
              size="lg"
              variant="outline"
              className="h-16 rounded-xl col-span-2"
              disabled={!number}
            >
              <Delete className="h-6 w-6 mr-2" />
              Delete
            </Button>
            <Button
              onClick={() => handleNumberClick("0")}
              size="lg"
              variant="outline"
              className="h-16 text-2xl font-bold rounded-xl"
            >
              0
            </Button>
          </div>

          <Button
            onClick={handleLogin}
            disabled={!number || loading}
            size="lg"
            className="w-full text-xl h-14 rounded-xl"
          >
            {loading ? "Checking..." : "Go!"}
          </Button>
        </Card>
      </div>
    );
  }

  // Family code entry screen
  if (step === "familyCode") {
    const currentBlockData = KEYPAD_BLOCKS[currentBlock];
    const isFirstBlock = currentBlock === 0;
    const isLastBlock = currentBlock === KEYPAD_BLOCKS.length - 1;

    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-primary/5 p-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-4">
            <Smile className="h-20 w-20 text-primary mx-auto" />
            <h1 className="text-4xl font-bold text-primary">Hi There!</h1>
            <p className="text-xl">Enter your family code</p>
            <p className="text-sm text-muted-foreground">
              Ask a parent for your 6-character family code
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-muted p-6 rounded-2xl">
              <div className="flex justify-center mb-4">
                <div className="w-full max-w-xs h-20 rounded-xl bg-card flex items-center justify-center border-2 border-primary/20">
                  <span className="text-4xl font-bold text-primary font-mono tracking-wider">
                    {familyCode || "______"}
                  </span>
                </div>
              </div>
            </div>

            {/* Block Navigation */}
            <div className="flex items-center justify-between gap-2">
              <Button
                onClick={() => handleBlockChange(currentBlock - 1)}
                disabled={isFirstBlock}
                variant="outline"
                size="sm"
                className="flex-shrink-0"
                aria-label="Previous block"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              {/* Block Indicator Dots */}
              <div className="flex items-center gap-2 flex-1 justify-center">
                {KEYPAD_BLOCKS.map((block, index) => (
                  <button
                    key={block.id}
                    onClick={() => handleBlockChange(index)}
                    className={`transition-all duration-200 rounded-full ${
                      index === currentBlock
                        ? "w-3 h-3 bg-primary scale-125"
                        : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    aria-label={`Go to ${block.label} block`}
                    aria-current={index === currentBlock ? "true" : "false"}
                  />
                ))}
              </div>

              <Button
                onClick={() => handleBlockChange(currentBlock + 1)}
                disabled={isLastBlock}
                variant="outline"
                size="sm"
                className="flex-shrink-0"
                aria-label="Next block"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Block Label */}
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {currentBlockData.label}
              </p>
            </div>

            {/* Keypad Block */}
            <div
              ref={keypadRef}
              className="relative overflow-hidden min-h-[280px] sm:min-h-[320px]"
              onTouchStart={handleSwipeStart}
              onTouchMove={handleSwipeMove}
              onTouchEnd={handleSwipeEnd}
            >
              {KEYPAD_BLOCKS.map((block, blockIndex) => (
                <div
                  key={block.id}
                  className={`grid grid-cols-3 gap-3 transition-all duration-300 ease-in-out ${
                    blockIndex === currentBlock
                      ? "opacity-100 translate-x-0"
                      : blockIndex < currentBlock
                      ? "opacity-0 -translate-x-full absolute inset-0"
                      : "opacity-0 translate-x-full absolute inset-0"
                  }`}
                >
                  {block.chars.map((char) => (
                    <Button
                      key={char}
                      onClick={() => handleFamilyCodeChange(familyCode + char)}
                      size="lg"
                      variant="outline"
                      className="h-16 sm:h-20 text-2xl sm:text-3xl font-bold rounded-xl hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 border-2"
                      disabled={familyCode.length >= 6}
                      aria-label={`Enter ${char}`}
                    >
                      {char}
                    </Button>
                  ))}
                  {/* Fill empty slots in last row for consistent grid (S-Z block has 8 chars) */}
                  {block.chars.length % 3 === 1 && (
                    <>
                      <div className="col-span-1" />
                      <div className="col-span-1" />
                    </>
                  )}
                  {block.chars.length % 3 === 2 && (
                    <div className="col-span-1" />
                  )}
                </div>
              ))}
            </div>

            {/* Delete Button */}
            <Button
              onClick={() => setFamilyCode(familyCode.slice(0, -1))}
              size="lg"
              variant="outline"
              className="w-full h-14 rounded-xl"
              disabled={!familyCode}
            >
              <Delete className="h-6 w-6 mr-2" />
              Delete
            </Button>

            {/* Next Button */}
            <Button
              onClick={handleFamilyCodeSubmit}
              disabled={familyCode.length < 3 || loading}
              size="lg"
              className="w-full text-xl h-14 rounded-xl"
            >
              {loading ? "Checking..." : "Next"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Initial selection screen
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-primary/5 p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6">
        <div className="text-center space-y-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="absolute top-4 left-4"
          >
            ← Back
          </Button>
          <Smile className="h-20 w-20 text-primary mx-auto" />
          <h1 className="text-4xl font-bold text-primary">Hi There!</h1>
          <p className="text-xl">Family Code: <span className="font-mono font-bold text-primary">{familyCode}</span></p>
          <p className="text-lg">Pick your color or animal</p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={codeType === "color" ? "default" : "outline"}
              onClick={() => setCodeType("color")}
              className="flex-1"
              size="lg"
            >
              Colors
            </Button>
            <Button
              variant={codeType === "animal" ? "default" : "outline"}
              onClick={() => setCodeType("animal")}
              className="flex-1"
              size="lg"
            >
              Animals
            </Button>
          </div>

          {codeType === "color" ? (
            <div className="grid grid-cols-5 gap-3">
              {colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => handleOptionSelect(c.name, "color")}
                  className="h-20 rounded-xl border-2 border-transparent hover:border-primary transition-all flex items-center justify-center hover:scale-105"
                  style={{ backgroundColor: c.color }}
                >
                  <span className="text-white font-bold text-sm capitalize drop-shadow-lg">
                    {c.name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {animals.map((a) => (
                <button
                  key={a.name}
                  onClick={() => handleOptionSelect(a.name, "animal")}
                  className="h-20 rounded-xl border-2 border-transparent hover:border-primary transition-all flex flex-col items-center justify-center hover:scale-105 hover:bg-muted"
                >
                  <span className="text-3xl">{a.emoji}</span>
                  <span className="text-xs font-medium capitalize mt-1">{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ChildLogin;

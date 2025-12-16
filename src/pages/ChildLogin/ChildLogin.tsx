// src/pages/ChildLogin/ChildLogin.tsx
// Purpose: Main orchestrator for ChildLogin page

import { ColorAnimalSelector } from "@/components/childLogin/ColorAnimalSelector";
import { FamilyCodeKeypad } from "@/components/childLogin/FamilyCodeKeypad";
import { NumberEntryScreen } from "@/components/childLogin/NumberEntryScreen";
import { SuccessScreen } from "@/components/childLogin/SuccessScreen";
import { colors } from "@/data/childLoginConstants";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  getAuthorizedChildId,
  isDeviceAuthorized,
} from "@/utils/deviceAuthorization";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useChildAuth } from "./useChildAuth";
import { validateFamilyCode, validateLoginNumber } from "./codeValidation";
import { LoginStep, CodeType } from "./types";
import { MAX_LOGIN_NUMBER, MAX_NUMBER_LENGTH } from "./constants";

const ChildLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const magicLinkProcessed = useRef(false);

  const [step, setStep] = useState<LoginStep>("familyCode");
  const [familyCode, setFamilyCode] = useState<string>("");
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [codeType, setCodeType] = useState<CodeType>("color");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [number, setNumber] = useState<string>("");
  const [skipFamilyCode, setSkipFamilyCode] = useState(false);

  const { loading, childData, handleLoginWithCode } = useChildAuth(skipFamilyCode);

  // Handle magic link with code parameter
  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam && codeParam.trim() !== "" && !magicLinkProcessed.current) {
      magicLinkProcessed.current = true;

      const decodedCode = decodeURIComponent(codeParam.trim()).replace(/\s+/g, "-");
      const parts = decodedCode.split("-");

      if (parts.length === 3) {
        const [famCode, option, num] = parts;
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
          const isColor = colors.some((c) => c.name === option.toLowerCase());
          setCodeType(isColor ? "color" : "animal");
          setSkipFamilyCode(false);
          const normalizedMagicCode = `${cleanedFamilyCode}-${option.toLowerCase()}-${num}`;
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
          magicLinkProcessed.current = false;
        }
      } else {
        toast({
          title: "Invalid login code",
          description:
            "The login code format is incorrect. Expected: familyCode-color/animal-number (e.g., ABC123-monkey-37)",
          variant: "destructive",
        });
        magicLinkProcessed.current = false;
      }
    }
  }, [searchParams, handleLoginWithCode, toast]);

  // Check device authorization on mount
  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam && codeParam.trim() !== "") {
      return; // Magic link handler will take care of this
    }

    if (magicLinkProcessed.current) {
      return;
    }

    const checkDeviceAuthorization = async () => {
      const authorizedChildId = getAuthorizedChildId();
      if (authorizedChildId && isDeviceAuthorized(authorizedChildId)) {
        const sessionData = localStorage.getItem("childSession");
        if (sessionData) {
          try {
            const childData = JSON.parse(sessionData);
            if (childData.id === authorizedChildId) {
              navigate("/child/dashboard");
              return;
            }
          } catch {
            // Invalid session data, continue with login
          }
        }

        // Device authorized but no session - skip family code
        try {
          const { data: childRecord } = await supabase
            .from("children")
            .select("login_code")
            .eq("id", authorizedChildId)
            .maybeSingle();

          if (childRecord?.login_code) {
            const parts = childRecord.login_code.split("-");
            if (parts.length === 3) {
              const [, option, num] = parts;
              setSelectedOption(option);
              setNumber(num);
              const isColor = colors.some((c) => c.name === option);
              setCodeType(isColor ? "color" : "animal");
              setSkipFamilyCode(true);
              setStep("select");
            }
          }
        } catch (error) {
          console.warn("Failed to fetch child data for authorized device:", error);
        }
      }
    };

    checkDeviceAuthorization();
  }, [navigate, searchParams]);

  const handleOptionSelect = (option: string, type: CodeType) => {
    setSelectedOption(option);
    setCodeType(type);
    setStep("number");
  };

  const handleNumberClick = (num: string) => {
    const newNumber = number + num;
    if (newNumber.length <= MAX_NUMBER_LENGTH && parseInt(newNumber) <= MAX_LOGIN_NUMBER) {
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
    const validation = validateFamilyCode(familyCode);
    if (!validation.valid) {
      toast({
        title: "Family code required",
        description: validation.error || "Please enter your family code (6 characters)",
        variant: "destructive",
      });
      return;
    }
    setStep("select");
  };

  const handleFamilyCodeChange = (value: string) => {
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
    let loginCode: string;

    if (familyCode && selectedOption && number) {
      loginCode = `${selectedOption.toLowerCase()}-${number}`;
    } else if (skipFamilyCode && selectedOption && number) {
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
      toast({
        title: "Incomplete code",
        description: "Please enter your family code, select a color/animal, and enter your number",
        variant: "destructive",
      });
      return;
    }

    // Validate number
    const numValidation = validateLoginNumber(number);
    if (!numValidation.valid) {
      toast({
        title: "Invalid number",
        description: numValidation.error || "Please enter a valid number",
        variant: "destructive",
      });
      return;
    }

    // Construct full code
    const normalizedFamilyCode = familyCode.toUpperCase();
    const fullCode = `${normalizedFamilyCode}-${loginCode}`;

    const result = await handleLoginWithCode(fullCode);
    if (result.success && result.childData) {
      setStep("success");
    }
  };

  // Success screen
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








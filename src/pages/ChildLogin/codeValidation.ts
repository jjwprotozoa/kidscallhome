// src/pages/ChildLogin/codeValidation.ts
// Purpose: Code validation functions

import { MIN_LOGIN_NUMBER, MAX_LOGIN_NUMBER, FAMILY_CODE_LENGTH } from "./constants";
import { ParsedLoginCode } from "./types";

export const validateFamilyCode = (code: string): { valid: boolean; error?: string } => {
  if (!code || code.trim().length === 0) {
    return { valid: false, error: "Family code is required" };
  }

  if (code.length < 3) {
    return { valid: false, error: "Family code must be at least 3 characters" };
  }

  if (code.length > FAMILY_CODE_LENGTH) {
    return { valid: false, error: `Family code must be ${FAMILY_CODE_LENGTH} characters or less` };
  }

  // Only alphanumeric characters
  if (!/^[A-Z0-9]+$/.test(code)) {
    return { valid: false, error: "Family code can only contain letters and numbers" };
  }

  return { valid: true };
};

export const validateLoginNumber = (number: string): { valid: boolean; error?: string } => {
  if (!number || number.trim().length === 0) {
    return { valid: false, error: "Number is required" };
  }

  const num = parseInt(number, 10);
  if (isNaN(num)) {
    return { valid: false, error: "Number must be a valid number" };
  }

  if (num < MIN_LOGIN_NUMBER || num > MAX_LOGIN_NUMBER) {
    return { valid: false, error: `Number must be between ${MIN_LOGIN_NUMBER} and ${MAX_LOGIN_NUMBER}` };
  }

  return { valid: true };
};

export const parseLoginCode = (fullCode: string): { valid: boolean; parsed?: ParsedLoginCode; error?: string } => {
  // Normalize: replace spaces with hyphens
  const normalizedCode = fullCode.trim().replace(/\s+/g, "-");
  
  // Parse: familyCode-color/animal-number
  const parts = normalizedCode.split("-");
  if (parts.length !== 3) {
    return {
      valid: false,
      error: "Login code must be in format: familyCode-color/animal-number",
    };
  }

  const [famCode, option, num] = parts;
  const normalizedFamilyCode = famCode.toUpperCase().trim();
  const normalizedOption = option.toLowerCase().trim();
  
  // Parse number to remove leading zeros
  const normalizedNum = parseInt(num.trim(), 10).toString();
  
  // Validate number
  const numValidation = validateLoginNumber(normalizedNum);
  if (!numValidation.valid) {
    return {
      valid: false,
      error: numValidation.error || "Invalid number in login code",
    };
  }

  const normalizedChildCode = `${normalizedOption}-${normalizedNum}`;
  const fullNormalizedCode = `${normalizedFamilyCode}-${normalizedOption}-${normalizedNum}`;

  return {
    valid: true,
    parsed: {
      normalizedFamilyCode,
      normalizedChildCode,
      fullCode: fullNormalizedCode,
    },
  };
};

export const validateCodeFormat = (code: string): boolean => {
  const result = parseLoginCode(code);
  return result.valid;
};










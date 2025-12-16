// src/pages/ParentAuth/authValidation.ts
// Purpose: Form validation logic for auth forms

import { sanitizeAndValidate } from "@/utils/inputValidation";
import { AuthFormData, AuthValidationResult } from "./types";

/**
 * Validate auth form data
 */
export function validateAuthForm(
  data: AuthFormData,
  isLogin: boolean
): AuthValidationResult {
  const validation = sanitizeAndValidate({
    email: data.email,
    password: data.password,
    name: !isLogin ? data.name : undefined,
  });

  return validation;
}

/**
 * Check if password breach status blocks submission
 */
export function shouldBlockPasswordSubmission(
  breachStatus: "safe" | "breached" | "checking" | null
): boolean {
  return breachStatus === "breached";
}








// src/utils/inputValidation/codeValidation.ts
// Purpose: Code validation functions (child login codes, etc.)

import { CHILD_LOGIN_CODE_REGEX } from './schemas';

/**
 * Validate child login code format
 * Format: familyCode-color/animal-number (e.g., "ABC123-blue-19" or "123456-cat-7")
 * Also accepts spaces instead of hyphens (e.g., "ABC123 blue 19")
 */
export function validateChildLoginCode(code: string): boolean {
  if (!code || typeof code !== "string") {
    return false;
  }

  // Normalize spaces to hyphens for user-friendly input
  const normalizedCode = code.trim().replace(/\s+/g, "-");

  return CHILD_LOGIN_CODE_REGEX.test(normalizedCode);
}









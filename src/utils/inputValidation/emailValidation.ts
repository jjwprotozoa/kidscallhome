// src/utils/inputValidation/emailValidation.ts
// Purpose: Email validation functions

import { EMAIL_REGEX } from './schemas';

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }

  return EMAIL_REGEX.test(email.trim());
}








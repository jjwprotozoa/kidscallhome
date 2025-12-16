// src/utils/inputValidation/passwordValidation.ts
// Purpose: Password validation functions

import { WEAK_PASSWORDS } from './schemas';

/**
 * Validate password strength (basic validation only)
 * For breach checking, use validatePasswordWithBreachCheck from passwordBreachCheck.ts
 *
 * Requirements (aligned with Supabase recommendations):
 * - Minimum 8 characters (Supabase recommends 8+)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one symbol (!@#$%^&*()_+-=[]{};':"|<>?,./`~)
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password || typeof password !== "string") {
    return { valid: false, errors: ["Password is required"] };
  }

  // Minimum length: 8 characters (Supabase recommendation)
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  if (password.length > 128) {
    errors.push("Password must be less than 128 characters");
  }

  // Character complexity requirements (Supabase strongest option)
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  // Allowed symbols per Supabase: !@#$%^&*()_+-=[]{};':"|<>?,./`~
  // Note: [ and ] are placed at start of character class to match them literally
  const hasSymbol = /[[\]!@#$%^&*()_+\-={};':"|<>?,./`~]/.test(password);

  if (!hasUppercase) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!hasLowercase) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!hasDigit) {
    errors.push("Password must contain at least one digit");
  }
  if (!hasSymbol) {
    errors.push(
      "Password must contain at least one symbol (!@#$%^&*()_+-=[]{};':\"|<>?,./`~)"
    );
  }

  // Check for common weak passwords
  if (WEAK_PASSWORDS.includes(password.toLowerCase())) {
    errors.push(
      "Password is too common. Please choose a more unique password."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}








// src/utils/inputValidation/textValidation.ts
// Purpose: Text sanitization and validation functions

import { isValidEmail } from './emailValidation';
import { validatePassword } from './passwordValidation';
import { validateChildLoginCode } from './codeValidation';
import { SQL_INJECTION_PATTERNS, XSS_PATTERNS } from './schemas';

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") {
    return String(input);
  }

  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, "") // Remove < and >
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers like onclick=
    .trim();
}

/**
 * Sanitize and validate user input
 */
export function sanitizeAndValidate(input: {
  email?: string;
  password?: string;
  name?: string;
  code?: string;
}): {
  valid: boolean;
  errors: Record<string, string[]>;
  sanitized: Record<string, string>;
} {
  const errors: Record<string, string[]> = {};
  const sanitized: Record<string, string> = {};

  if (input.email !== undefined) {
    const email = sanitizeInput(input.email);
    sanitized.email = email;
    if (!isValidEmail(email)) {
      errors.email = ["Invalid email format"];
    }
  }

  if (input.password !== undefined) {
    const password = input.password; // Don't sanitize password (preserve special chars)
    sanitized.password = password;
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      errors.password = passwordValidation.errors;
    }
  }

  if (input.name !== undefined) {
    const name = sanitizeInput(input.name);
    sanitized.name = name;
    if (name.length < 1) {
      errors.name = ["Name is required"];
    }
    if (name.length > 100) {
      errors.name = ["Name must be less than 100 characters"];
    }
  }

  if (input.code !== undefined) {
    const code = sanitizeInput(input.code);
    sanitized.code = code;
    if (!validateChildLoginCode(code)) {
      errors.code = ["Invalid login code format"];
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}

/**
 * Prevent SQL injection patterns (for display purposes)
 */
export function containsSQLInjection(input: string): boolean {
  if (!input || typeof input !== "string") {
    return false;
  }

  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Prevent XSS patterns
 */
export function containsXSS(input: string): boolean {
  if (!input || typeof input !== "string") {
    return false;
  }

  return XSS_PATTERNS.some((pattern) => pattern.test(input));
}


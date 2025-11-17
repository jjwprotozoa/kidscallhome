// src/utils/inputValidation.ts
// Purpose: Input validation and sanitization to prevent injection attacks

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
    .trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }

  if (password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Check for common weak passwords
  const weakPasswords = ['password', '123456', '12345678', 'qwerty', 'abc123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate child login code format
 */
export function validateChildLoginCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // Format: color-animal or animal-number (e.g., "red-5" or "cat-12")
  const codeRegex = /^[a-z]+-\d{1,2}$/i;
  return codeRegex.test(code.trim());
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
      errors.email = ['Invalid email format'];
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
      errors.name = ['Name is required'];
    }
    if (name.length > 100) {
      errors.name = ['Name must be less than 100 characters'];
    }
  }

  if (input.code !== undefined) {
    const code = sanitizeInput(input.code);
    sanitized.code = code;
    if (!validateChildLoginCode(code)) {
      errors.code = ['Invalid login code format'];
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
  if (!input || typeof input !== 'string') {
    return false;
  }

  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--|\#|\/\*|\*\/)/,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\bUNION\b.*\bSELECT\b)/i,
  ];

  return sqlPatterns.some((pattern) => pattern.test(input));
}

/**
 * Prevent XSS patterns
 */
export function containsXSS(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  return xssPatterns.some((pattern) => pattern.test(input));
}


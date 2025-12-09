// src/utils/inputValidation.ts
// Purpose: Input validation and sanitization to prevent injection attacks

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
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Common weak passwords to reject
 * Expanded list based on OWASP top 10,000 most common passwords
 * This provides immediate feedback without API calls, while HaveIBeenPwned API
 * checks against 600+ million leaked passwords for comprehensive protection.
 */
const WEAK_PASSWORDS = [
  // Top 20 most common passwords
  "password",
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "abc123",
  "password1",
  "password123",
  "admin",
  "letmein",
  "welcome",
  "monkey",
  "1234567",
  "sunshine",
  "princess",
  "qwerty123",
  "solo",
  "passw0rd",
  "starwars",

  // Sequential patterns
  "abcdef",
  "qwertyuiop",
  "asdfgh",
  "zxcvbn",
  "123qwe",
  "qwerty12",
  "1qaz2wsx",
  "qazwsxedc",
  "1q2w3e4r",
  "qwe123",
  "1234qwer",
  "qwer1234",
  "abcd1234",
  "1234abcd",
  "qwerty1",

  // Common substitutions and variations
  "Password1",
  "Welcome123",
  "Admin123",
  "Test1234",
  "Password123",
  "Passw0rd",
  "P@ssw0rd",
  "P@ssword1",
  "Pass1234",
  "Admin1234",
  "Welcome1",
  "Test123",
  "Password12",
  "Admin1",
  "Welcome12",

  // Common phrases and words
  "iloveyou",
  "trustno1",
  "dragon",
  "master",
  "hello",
  "freedom",
  "whatever",
  "qazwsx",
  "michael",
  "football",
  "baseball",
  "shadow",
  "superman",
  "qwertyui",
  "michael1",
  "jordan23",
  "harley",
  "hunter",
  "buster",
  "thomas",
  "tigger",
  "robert",
  "soccer",
  "batman",
  "taylor",
  "killer",
  "hockey",
  "jordan",
  "michelle",
  "charlie",
  "andrew",
  "joshua",
  "matthew",
  "jessica",
  "daniel",
  "anthony",
  "jennifer",
  "joshua1",
  "liverpool",
  "chelsea",

  // Common names with numbers
  "james123",
  "robert1",
  "michael1",
  "william1",
  "david1",
  "richard1",
  "joseph1",
  "thomas1",
  "charles1",
  "christopher1",
  "daniel1",
  "matthew1",
  "anthony1",
  "mark1",
  "donald1",
  "steven1",
  "paul1",
  "andrew1",
  "joshua1",
  "kenneth1",
  "kevin1",
  "brian1",
  "george1",
  "timothy1",
  "ronald1",
  "jason1",
  "edward1",
  "jeffrey1",
  "ryan1",
  "jacob1",
  "gary1",
  "nicholas1",
  "eric1",
  "jonathan1",
  "stephen1",
  "larry1",
  "justin1",
  "scott1",
  "brandon1",
  "benjamin1",
  "samuel1",
  "frank1",
  "gregory1",
  "raymond1",
  "alexander1",
  "patrick1",
  "jack1",
  "dennis1",
  "jerry1",
  "tyler1",
  "aaron1",
  "jose1",
  "henry1",
  "adam1",
  "douglas1",
  "nathan1",
  "zachary1",
  "kyle1",
  "noah1",
  "alan1",

  // Sports teams and common words
  "arsenal",
  "manchester",
  "liverpool",
  "chelsea",
  "barcelona",
  "real",
  "madrid",
  "juventus",
  "milan",
  "bayern",
  "dortmund",
  "psg",
  "atletico",
  "valencia",
  "sevilla",

  // Common patterns
  "111111",
  "222222",
  "333333",
  "444444",
  "555555",
  "666666",
  "777777",
  "888888",
  "999999",
  "000000",
  "aaaaaa",
  "bbbbbb",
  "cccccc",
  "dddddd",
  "eeeeee",
  "ffffff",
  "gggggg",
  "hhhhhh",
  "iiiiii",
  "jjjjjj",

  // Year-based passwords
  "password2020",
  "password2021",
  "password2022",
  "password2023",
  "password2024",
  "welcome2020",
  "welcome2021",
  "welcome2022",
  "welcome2023",
  "welcome2024",
  "admin2020",
  "admin2021",
  "admin2022",
  "admin2023",
  "admin2024",

  // Keyboard patterns
  "1q2w3e4r",
  "qwertyui",
  "asdfghjk",
  "zxcvbnm",
  "qwerty1",
  "asdf1234",
  "zxcv1234",
  "qwer1234",
  "asdfqwer",
  "qwertyuiop",

  // Common substitutions
  "p@ssw0rd",
  "p@ssword",
  "p@55w0rd",
  "p@55word",
  "p@ssw0rd1",
  "w3lc0m3",
  "w3lcome",
  "welc0me",
  "welcome1",
  "welc0me1",
  "adm1n",
  "admin1",
  "admin1",
  "adm1n1",
  "admin123",

  // Simple patterns
  "123abc",
  "abc123",
  "123abc123",
  "abc123abc",
  "1234abcd",
  "abcd1234",
  "12345a",
  "a12345",
  "12345ab",
  "ab12345",

  // Common phrases with numbers
  "iloveyou1",
  "iloveyou123",
  "trustno1",
  "trustno11",
  "trustno123",
  "letmein1",
  "letmein123",
  "welcome1",
  "welcome123",
  "hello123",

  // Default/placeholder passwords
  "changeme",
  "changeme1",
  "changeme123",
  "default",
  "default1",
  "newpassword",
  "newpassword1",
  "newpassword123",
  "temp",
  "temp123",
  "test",
  "test1",
  "test123",
  "testing",
  "testing123",

  // Common weak passwords from various breaches
  "ninja",
  "mustang",
  "access",
  "flower",
  "55555",
  "michael",
  "shadow",
  "master",
  "jennifer",
  "jordan",
  "superman",
  "harley",
  "hunter",
  "buster",
  "soccer",
  "tigger",
  "batman",
  "thomas",
  "hockey",
  "killer",
  "ranger",
  "daniel",
  "hannah",
  "maggie",
  "jessie",
  "charlie",
  "summer",
  "winter",
  "spring",
  "autumn",

  // Additional common patterns
  "qwerty1",
  "qwerty12",
  "qwerty123",
  "qwerty1234",
  "qwertyui",
  "asdfgh1",
  "asdfgh12",
  "zxcvbn1",
  "zxcvbn12",
  "123456a",
  "a123456",
  "123456ab",
  "ab123456",
  "123456abc",
  "abc123456",
];

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

  // Format: familyCode-color/animal-number
  // familyCode: 3-6 alphanumeric characters
  // color/animal: lowercase letters
  // number: 1-2 digits (1-99)
  const codeRegex = /^[A-Z0-9]{3,6}-[a-z]+-\d{1,2}$/i;
  return codeRegex.test(normalizedCode);
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

  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--|#|\/\*|\*\/)/,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\bUNION\b.*\bSELECT\b)/i,
  ];

  return sqlPatterns.some((pattern) => pattern.test(input));
}

/**
 * Prevent XSS patterns
 */
export function containsXSS(input: string): boolean {
  if (!input || typeof input !== "string") {
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

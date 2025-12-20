// src/utils/inputValidation/schemas.ts
// Purpose: Regex patterns and constants for input validation

/**
 * Common weak passwords to reject
 * Expanded list based on OWASP top 10,000 most common passwords
 * This provides immediate feedback without API calls, while HaveIBeenPwned API
 * checks against 600+ million leaked passwords for comprehensive protection.
 */
export const WEAK_PASSWORDS = [
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
 * Email validation regex pattern
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Child login code regex pattern
 * Format: familyCode-color/animal-number
 * familyCode: 3-6 alphanumeric characters
 * color/animal: lowercase letters
 * number: 1-2 digits (1-99)
 */
export const CHILD_LOGIN_CODE_REGEX = /^[A-Z0-9]{3,6}-[a-z]+-\d{1,2}$/i;

/**
 * SQL injection detection patterns
 */
export const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
  /(--|#|\/\*|\*\/)/,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
  /(\bUNION\b.*\bSELECT\b)/i,
];

/**
 * XSS attack detection patterns
 */
export const XSS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
];













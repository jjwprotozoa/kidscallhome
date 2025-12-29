// src/utils/passwordBreachCheck.ts
// Purpose: Check passwords and emails against HaveIBeenPwned API to prevent use of leaked credentials

/**
 * Hash a password using SHA-1
 * Uses Web Crypto API for secure hashing
 */
async function sha1Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Check if a password has been found in data breaches using HaveIBeenPwned API
 * Uses k-anonymity: only sends first 5 characters of SHA-1 hash
 * 
 * @param password - The password to check
 * @returns Promise<boolean> - true if password is found in breaches, false otherwise
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    // Hash the password
    const hash = await sha1Hash(password);
    
    // Get first 5 characters (prefix) and remaining characters (suffix)
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);
    
    // Call HaveIBeenPwned API with only the prefix (k-anonymity)
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'KidsCallHome-PasswordChecker/1.0',
      },
    });
    
    if (!response.ok) {
      // If API is unavailable, fail open (allow password) but log warning
      console.warn('HaveIBeenPwned API unavailable, skipping breach check');
      return false;
    }
    
    const text = await response.text();
    
    // Parse response: each line is "SUFFIX:COUNT"
    // Check if our suffix appears in the response
    // Handle both Unix (\n) and Windows (\r\n) line endings
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue; // Skip empty lines
      const [lineSuffix] = trimmedLine.split(':');
      if (lineSuffix && lineSuffix.toUpperCase() === suffix) {
        return true; // Password found in breaches
      }
    }
    
    return false; // Password not found in breaches
  } catch (error) {
    // Network errors or other issues: fail open (allow password) but log warning
    console.warn('Error checking password breach status:', error);
    return false;
  }
}

/**
 * Common weak passwords to reject
 * Expanded list based on OWASP top 10,000 most common passwords
 * This provides immediate feedback without API calls, while HaveIBeenPwned API
 * checks against 600+ million leaked passwords for comprehensive protection.
 */
const WEAK_PASSWORDS = [
  // Top 20 most common passwords
  'password', '123456', '12345678', '123456789', '1234567890',
  'qwerty', 'abc123', 'password1', 'password123', 'admin',
  'letmein', 'welcome', 'monkey', '1234567', 'sunshine',
  'princess', 'qwerty123', 'solo', 'passw0rd', 'starwars',
  
  // Sequential patterns
  'abcdef', 'qwertyuiop', 'asdfgh', 'zxcvbn', '123qwe',
  'qwerty12', '1qaz2wsx', 'qazwsxedc', '1q2w3e4r', 'qwe123',
  '1234qwer', 'qwer1234', 'abcd1234', '1234abcd', 'qwerty1',
  
  // Common substitutions and variations
  'Password1', 'Welcome123', 'Admin123', 'Test1234', 'Password123',
  'Passw0rd', 'P@ssw0rd', 'P@ssword1', 'Pass1234', 'Admin1234',
  'Welcome1', 'Test123', 'Password12', 'Admin1', 'Welcome12',
  
  // Common phrases and words
  'iloveyou', 'trustno1', 'dragon', 'master', 'hello',
  'freedom', 'whatever', 'qazwsx', 'michael', 'football',
  'baseball', 'shadow', 'superman', 'qwertyui', 'michael1',
  'jordan23', 'harley', 'hunter', 'buster', 'thomas',
  'tigger', 'robert', 'soccer', 'batman', 'taylor',
  'killer', 'hockey', 'jordan', 'michelle', 'charlie',
  'andrew', 'joshua', 'matthew', 'jessica', 'daniel',
  'anthony', 'jennifer', 'joshua1', 'liverpool', 'chelsea',
  
  // Common names with numbers
  'james123', 'robert1', 'michael1', 'william1', 'david1',
  'richard1', 'joseph1', 'thomas1', 'charles1', 'christopher1',
  'daniel1', 'matthew1', 'anthony1', 'mark1', 'donald1',
  'steven1', 'paul1', 'andrew1', 'joshua1', 'kenneth1',
  'kevin1', 'brian1', 'george1', 'timothy1', 'ronald1',
  'jason1', 'edward1', 'jeffrey1', 'ryan1', 'jacob1',
  'gary1', 'nicholas1', 'eric1', 'jonathan1', 'stephen1',
  'larry1', 'justin1', 'scott1', 'brandon1', 'benjamin1',
  'samuel1', 'frank1', 'gregory1', 'raymond1', 'alexander1',
  'patrick1', 'jack1', 'dennis1', 'jerry1', 'tyler1',
  'aaron1', 'jose1', 'henry1', 'adam1', 'douglas1',
  'nathan1', 'zachary1', 'kyle1', 'noah1', 'alan1',
  
  // Sports teams and common words
  'arsenal', 'manchester', 'liverpool', 'chelsea', 'barcelona',
  'real', 'madrid', 'juventus', 'milan', 'bayern',
  'dortmund', 'psg', 'atletico', 'valencia', 'sevilla',
  
  // Common patterns
  '111111', '222222', '333333', '444444', '555555',
  '666666', '777777', '888888', '999999', '000000',
  'aaaaaa', 'bbbbbb', 'cccccc', 'dddddd', 'eeeeee',
  'ffffff', 'gggggg', 'hhhhhh', 'iiiiii', 'jjjjjj',
  
  // Year-based passwords
  'password2020', 'password2021', 'password2022', 'password2023', 'password2024',
  'welcome2020', 'welcome2021', 'welcome2022', 'welcome2023', 'welcome2024',
  'admin2020', 'admin2021', 'admin2022', 'admin2023', 'admin2024',
  
  // Keyboard patterns
  '1q2w3e4r', 'qwertyui', 'asdfghjk', 'zxcvbnm', 'qwerty1',
  'asdf1234', 'zxcv1234', 'qwer1234', 'asdfqwer', 'qwertyuiop',
  
  // Common substitutions
  'p@ssw0rd', 'p@ssword', 'p@55w0rd', 'p@55word', 'p@ssw0rd1',
  'w3lc0m3', 'w3lcome', 'welc0me', 'welcome1', 'welc0me1',
  'adm1n', 'admin1', 'admin1', 'adm1n1', 'admin123',
  
  // Simple patterns
  '123abc', 'abc123', '123abc123', 'abc123abc', '1234abcd',
  'abcd1234', '12345a', 'a12345', '12345ab', 'ab12345',
  
  // Common phrases with numbers
  'iloveyou1', 'iloveyou123', 'trustno1', 'trustno11', 'trustno123',
  'letmein1', 'letmein123', 'welcome1', 'welcome123', 'hello123',
  
  // Default/placeholder passwords
  'changeme', 'changeme1', 'changeme123', 'default', 'default1',
  'newpassword', 'newpassword1', 'newpassword123', 'temp', 'temp123',
  'test', 'test1', 'test123', 'testing', 'testing123',
  
  // Common weak passwords from various breaches
  'ninja', 'mustang', 'access', 'flower', '55555',
  'michael', 'shadow', 'master', 'jennifer', 'jordan',
  'superman', 'harley', 'hunter', 'buster', 'soccer',
  'tigger', 'batman', 'thomas', 'hockey', 'killer',
  'ranger', 'daniel', 'hannah', 'maggie', 'jessie',
  'charlie', 'summer', 'winter', 'spring', 'autumn',
  
  // Additional common patterns
  'qwerty1', 'qwerty12', 'qwerty123', 'qwerty1234', 'qwertyui',
  'asdfgh1', 'asdfgh12', 'zxcvbn1', 'zxcvbn12', '123456a',
  'a123456', '123456ab', 'ab123456', '123456abc', 'abc123456',
];

/**
 * Enhanced password validation with breach checking
 * 
 * Requirements (aligned with Supabase recommendations):
 * - Minimum 8 characters (Supabase recommends 8+)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one symbol (!@#$%^&*()_+-=[]{};':"|<>?,./`~)
 * 
 * @param password - The password to validate
 * @param checkBreach - Whether to check against HaveIBeenPwned API (default: true)
 * @returns Promise with validation result
 */
export async function validatePasswordWithBreachCheck(
  password: string,
  checkBreach: boolean = true
): Promise<{
  valid: boolean;
  errors: string[];
  isPwned?: boolean;
}> {
  const errors: string[] = [];
  
  // Basic validation first
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }
  
  // Minimum length: 8 characters (Supabase recommendation)
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  // Character complexity requirements (Supabase strongest option)
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  // Allowed symbols per Supabase: !@#$%^&*()_+-=[]{};':"|<>?,./`~
  // Note: [ and ] are placed at start of character class to match them literally
  const hasSymbol = /[[\]!@#$%^&*()_+\-={};':"|<>?,./`~]/.test(password);

  if (!hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasDigit) {
    errors.push('Password must contain at least one digit');
  }
  if (!hasSymbol) {
    errors.push('Password must contain at least one symbol (!@#$%^&*()_+-=[]{};\':"|<>?,./`~)');
  }
  
  // Check for common weak passwords
  if (WEAK_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a more unique password.');
  }
  
  // If basic validation fails, don't check breach (save API call)
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  // Check against HaveIBeenPwned API
  if (checkBreach) {
    try {
      const pwned = await isPasswordPwned(password);
      if (pwned) {
        errors.push('This password has been found in data breaches. Please choose a different password.');
        return { valid: false, errors, isPwned: true };
      }
    } catch (error) {
      // If breach check fails, log but don't block (fail open)
      console.warn('Breach check failed, allowing password:', error);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    isPwned: false,
  };
}

/**
 * Check if an email address has been found in data breaches using HaveIBeenPwned API
 * 
 * IMPORTANT: This function ALWAYS fails open (never blocks signup). If the API is unavailable,
 * rate-limited, or returns any error, it silently returns { isPwned: false } to ensure
 * zero friction for users during signup.
 * 
 * Note: This uses the v3 API which requires a subscription for production use.
 * Without subscription: 1 request per 1.5 seconds (very limited)
 * With subscription: Higher rate limits available
 * 
 * @param email - The email address to check
 * @param apiKey - Optional API key (requires subscription)
 * @returns Promise with breach information (always fails open - never blocks)
 */
export async function checkEmailBreach(
  email: string,
  apiKey?: string
): Promise<{
  isPwned: boolean;
  breachCount?: number;
  breaches?: Array<{ Name: string; BreachDate: string; AddedDate: string }>;
}> {
  try {
    if (!email || typeof email !== 'string') {
      // Invalid input - fail open (don't block)
      return { isPwned: false };
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = encodeURIComponent(email.trim().toLowerCase());

    // Build request headers
    const headers: HeadersInit = {
      'User-Agent': 'KidsCallHome-EmailChecker/1.0',
    };

    // Add API key if provided (requires subscription)
    if (apiKey) {
      headers['hibp-api-key'] = apiKey;
    }

    // Call HaveIBeenPwned API v3
    // CRITICAL: All errors fail open - never block signup
    // 
    // IMPORTANT: This API doesn't support CORS from browsers, so direct browser calls will fail.
    // The error you see in console is expected and harmless - the code handles it gracefully.
    // In production, this should be done server-side via a proxy endpoint.
    // 
    // For now, we attempt the call but gracefully handle CORS/401 errors (fail open).
    let response: Response;
    try {
      response = await fetch(
        `https://haveibeenpwned.com/api/v3/breachedaccount/${normalizedEmail}?truncateResponse=false`,
        {
          method: 'GET',
          headers,
          // Suppress CORS error logging by catching before browser logs it
          // Note: Browser will still log CORS error, but we handle it gracefully
        }
      );
    } catch (fetchError) {
      // CORS errors, network failures, etc. - expected in browser environment
      // Silently fail open - this check should be done server-side in production
      if (fetchError instanceof TypeError || (fetchError as any)?.message?.includes('CORS')) {
        // CORS or network error - expected in browser, fail open silently
        // The browser console will show the CORS error, but that's harmless
        // The signup flow continues normally (fail-open behavior)
        return { isPwned: false };
      }
      // Re-throw other errors to be handled below
      throw fetchError;
    }

    // 404 means email not found in breaches (good!)
    if (response.status === 404) {
      return { isPwned: false };
    }

    // 429 means rate limit exceeded - FAIL OPEN (don't block signup)
    if (response.status === 429) {
      // Silently fail - rate limit reached, but don't block user
      console.warn('HaveIBeenPwned rate limit reached - allowing signup to proceed');
      return { isPwned: false };
    }

    // 400 means invalid email format - FAIL OPEN
    if (response.status === 400) {
      return { isPwned: false };
    }

    // 401 means unauthorized (missing/invalid API key or CORS issue) - FAIL OPEN
    // This is expected when calling from browser without proper server-side proxy
    if (response.status === 401) {
      // Expected in browser environment - fail open silently
      // The browser console may show the 401 error, but that's harmless
      return { isPwned: false };
    }

    // Any other error - FAIL OPEN (don't block signup)
    if (!response.ok) {
      // Log for monitoring but don't block user
      // Note: In browser, CORS/401 errors are expected and harmless
      if (import.meta.env.DEV && response.status !== 401) {
        // Only log non-401 errors in dev (401 is expected in browser)
        console.debug('HaveIBeenPwned API error:', response.status, response.statusText, '- allowing signup');
      }
      return { isPwned: false };
    }

    // Parse breach data
    const breaches = await response.json();
    
    if (Array.isArray(breaches) && breaches.length > 0) {
      return {
        isPwned: true,
        breachCount: breaches.length,
        breaches: breaches.map((b: any) => ({
          Name: b.Name || 'Unknown',
          BreachDate: b.BreachDate || 'Unknown',
          AddedDate: b.AddedDate || 'Unknown',
        })),
      };
    }

    return { isPwned: false };
  } catch (error) {
    // Network errors, timeouts, CORS, or any other issues: FAIL OPEN (allow signup)
    // Only log in dev mode - in production this is expected (API doesn't support browser CORS)
    if (import.meta.env.DEV) {
      // Check if it's a CORS error (expected in browser)
      const isCorsError = error instanceof TypeError && 
        (error.message.includes('CORS') || 
         error.message.includes('Failed to fetch') ||
         error.message.includes('NetworkError'));
      
      if (isCorsError) {
        console.debug('[Email Breach Check] CORS error (expected in browser) - allowing signup');
      } else {
        console.debug('[Email breach check] Network error - allowing signup:', error);
      }
    }
    return { isPwned: false };
  }
}


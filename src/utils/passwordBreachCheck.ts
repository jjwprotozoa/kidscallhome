// src/utils/passwordBreachCheck.ts
// Purpose: Check passwords against HaveIBeenPwned Pwned Passwords API to prevent use of leaked passwords

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
 * Enhanced password validation with breach checking
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


// src/utils/csrf.ts
// Purpose: CSRF token generation and validation

const CSRF_TOKEN_KEY = 'kch_csrf_token';
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  
  // Store token with expiry
  const tokenData = {
    token,
    expiresAt: Date.now() + CSRF_TOKEN_EXPIRY,
  };
  
  try {
    sessionStorage.setItem(CSRF_TOKEN_KEY, JSON.stringify(tokenData));
  } catch {
    // Fallback to memory if sessionStorage fails
    (window as any).__csrfToken = tokenData;
  }
  
  return token;
}

/**
 * Get current CSRF token (generates if doesn't exist)
 */
export function getCSRFToken(): string {
  try {
    const stored = sessionStorage.getItem(CSRF_TOKEN_KEY);
    if (stored) {
      const tokenData = JSON.parse(stored);
      if (tokenData.expiresAt > Date.now()) {
        return tokenData.token;
      }
    }
  } catch {
    // Check memory fallback
    const memoryToken = (window as any).__csrfToken;
    if (memoryToken && memoryToken.expiresAt > Date.now()) {
      return memoryToken.token;
    }
  }
  
  // Generate new token
  return generateCSRFToken();
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string): boolean {
  try {
    const stored = sessionStorage.getItem(CSRF_TOKEN_KEY);
    if (stored) {
      const tokenData = JSON.parse(stored);
      if (tokenData.expiresAt <= Date.now()) {
        return false; // Expired
      }
      return tokenData.token === token;
    }
  } catch {
    // Check memory fallback
    const memoryToken = (window as any).__csrfToken;
    if (memoryToken && memoryToken.expiresAt > Date.now()) {
      return memoryToken.token === token;
    }
  }
  
  return false;
}

/**
 * Clear CSRF token
 */
export function clearCSRFToken(): void {
  try {
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
  } catch {
    // Ignore
  }
  delete (window as any).__csrfToken;
}

/**
 * Add CSRF token to headers for API calls
 */
export function getCSRFHeaders(): Record<string, string> {
  return {
    'X-CSRF-Token': getCSRFToken(),
  };
}


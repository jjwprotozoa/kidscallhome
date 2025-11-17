// src/utils/rateLimiting.ts
// Purpose: Client-side rate limiting and failed login tracking to prevent brute-force attacks

interface RateLimitEntry {
  count: number;
  resetAt: number;
  lockedUntil?: number;
}

interface FailedLoginEntry {
  email: string;
  attempts: number;
  lastAttempt: number;
  lockedUntil?: number;
}

const RATE_LIMIT_STORAGE_KEY = 'kch_rate_limits';
const FAILED_LOGINS_STORAGE_KEY = 'kch_failed_logins';

// Rate limit configuration
const RATE_LIMITS = {
  login: {
    maxAttempts: 5,
    windowMs: 60 * 1000, // 1 minute
    lockoutDurationMs: 15 * 60 * 1000, // 15 minutes after 5 failed attempts
  },
  childLogin: {
    maxAttempts: 10,
    windowMs: 60 * 1000, // 1 minute
    lockoutDurationMs: 5 * 60 * 1000, // 5 minutes
  },
  apiCall: {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

/**
 * Get rate limit storage (in-memory with localStorage backup)
 */
function getRateLimitStorage(): Record<string, RateLimitEntry> {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveRateLimitStorage(data: Record<string, RateLimitEntry>): void {
  try {
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

function getFailedLoginsStorage(): Record<string, FailedLoginEntry> {
  try {
    const stored = localStorage.getItem(FAILED_LOGINS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveFailedLoginsStorage(data: Record<string, FailedLoginEntry>): void {
  try {
    localStorage.setItem(FAILED_LOGINS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if an action is rate limited
 */
export function checkRateLimit(
  key: string,
  type: keyof typeof RATE_LIMITS = 'apiCall'
): { allowed: boolean; resetAt?: number; lockedUntil?: number } {
  const config = RATE_LIMITS[type];
  const storage = getRateLimitStorage();
  const now = Date.now();
  const entry = storage[key];

  // Check if locked
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      lockedUntil: entry.lockedUntil,
    };
  }

  // Check if window expired
  if (!entry || entry.resetAt < now) {
    return { allowed: true };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxAttempts) {
    // Lock if this is a login attempt
    if (type === 'login' && config.lockoutDurationMs) {
      const lockedUntil = now + config.lockoutDurationMs;
      storage[key] = {
        count: entry.count,
        resetAt: entry.resetAt,
        lockedUntil,
      };
      saveRateLimitStorage(storage);
      return {
        allowed: false,
        lockedUntil,
      };
    }
    return {
      allowed: false,
      resetAt: entry.resetAt,
    };
  }

  return { allowed: true };
}

/**
 * Record an action for rate limiting
 */
export function recordRateLimit(
  key: string,
  type: keyof typeof RATE_LIMITS = 'apiCall'
): void {
  const config = RATE_LIMITS[type];
  const storage = getRateLimitStorage();
  const now = Date.now();
  const entry = storage[key];

  if (!entry || entry.resetAt < now) {
    // New window
    storage[key] = {
      count: 1,
      resetAt: now + config.windowMs,
    };
  } else {
    // Increment count
    storage[key] = {
      ...entry,
      count: entry.count + 1,
    };
  }

  saveRateLimitStorage(storage);
}

/**
 * Record a failed login attempt
 */
export function recordFailedLogin(email: string): {
  attempts: number;
  locked: boolean;
  lockedUntil?: number;
} {
  const storage = getFailedLoginsStorage();
  const now = Date.now();
  const config = RATE_LIMITS.login;
  const entry = storage[email];

  let attempts = 1;
  let lockedUntil: number | undefined;

  if (!entry || now - entry.lastAttempt > config.windowMs) {
    // New window or expired
    attempts = 1;
  } else {
    attempts = entry.attempts + 1;
  }

  // Check if should lock
  if (attempts >= config.maxAttempts && config.lockoutDurationMs) {
    lockedUntil = now + config.lockoutDurationMs;
  }

  storage[email] = {
    email,
    attempts,
    lastAttempt: now,
    lockedUntil,
  };

  saveFailedLoginsStorage(storage);

  return {
    attempts,
    locked: !!lockedUntil,
    lockedUntil,
  };
}

/**
 * Clear failed login attempts (on successful login)
 */
export function clearFailedLogins(email: string): void {
  const storage = getFailedLoginsStorage();
  delete storage[email];
  saveFailedLoginsStorage(storage);

  // Also clear rate limit for this email
  const rateLimitStorage = getRateLimitStorage();
  delete rateLimitStorage[`login:${email}`];
  saveRateLimitStorage(rateLimitStorage);
}

/**
 * Check if email is locked due to failed attempts
 */
export function isEmailLocked(email: string): {
  locked: boolean;
  lockedUntil?: number;
  attemptsRemaining?: number;
} {
  const storage = getFailedLoginsStorage();
  const entry = storage[email];
  const now = Date.now();
  const config = RATE_LIMITS.login;

  if (!entry) {
    return { locked: false };
  }

  // Check if lock expired
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      locked: true,
      lockedUntil: entry.lockedUntil,
      attemptsRemaining: 0,
    };
  }

  // Check if window expired
  if (now - entry.lastAttempt > config.windowMs) {
    return { locked: false };
  }

  // Check if approaching lockout
  const attemptsRemaining = config.maxAttempts - entry.attempts;
  return {
    locked: false,
    attemptsRemaining: Math.max(0, attemptsRemaining),
  };
}

/**
 * Get rate limit info for display
 */
export function getRateLimitInfo(
  key: string,
  type: keyof typeof RATE_LIMITS = 'apiCall'
): {
  remaining: number;
  resetAt?: number;
  lockedUntil?: number;
} {
  const config = RATE_LIMITS[type];
  const storage = getRateLimitStorage();
  const now = Date.now();
  const entry = storage[key];

  if (!entry || entry.resetAt < now) {
    return {
      remaining: config.maxAttempts,
    };
  }

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      remaining: 0,
      lockedUntil: entry.lockedUntil,
    };
  }

  return {
    remaining: Math.max(0, config.maxAttempts - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Generate rate limit key from IP/email/identifier
 */
export function getRateLimitKey(identifier: string, type: string): string {
  return `${type}:${identifier}`;
}


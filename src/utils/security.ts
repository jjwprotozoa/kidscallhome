// src/utils/security.ts
// Purpose: Security utilities to prevent sensitive data exposure in logs, errors, and DOM

/**
 * Sensitive fields that should never be logged
 */
const SENSITIVE_FIELDS = [
  'password',
  'Password',
  'PASSWORD',
  'passwd',
  'pwd',
  'secret',
  'Secret',
  'SECRET',
  'token',
  'Token',
  'TOKEN',
  'apiKey',
  'api_key',
  'apikey',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'authToken',
  'auth_token',
  'sessionToken',
  'session_token',
  'privateKey',
  'private_key',
  'privatekey',
  'secretKey',
  'secret_key',
  'secretkey',
  'authorization',
  'Authorization',
  'AUTHORIZATION',
  'cookie',
  'Cookie',
  'COOKIE',
  'session',
  'Session',
  'SESSION',
  'credential',
  'credentials',
  'Credential',
  'Credentials',
  'CREDENTIALS',
  'email', // Email addresses are sensitive
  'Email',
  'EMAIL',
  'userId', // User IDs can be sensitive
  'user_id',
  'userId',
  'ip', // IP addresses are sensitive
  'IP',
  'ipAddress',
  'ip_address',
  'userAgent', // User agent can be used for fingerprinting
  'user_agent',
  'UserAgent',
];

/**
 * Patterns that indicate sensitive data
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /key/i,
  /credential/i,
  /auth/i,
  /session/i,
  /cookie/i,
  /email/i,
  /userid/i,
  /user_id/i,
  /ip/i,
  /useragent/i,
  /user_agent/i,
];

/**
 * Sanitizes an object by removing or masking sensitive fields
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: { maskValue?: boolean; removeField?: boolean } = {}
): Partial<T> {
  const { maskValue = true, removeField = false } = options;

  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, options)) as any;
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj as any;
  }

  // Handle Error objects
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: import.meta.env.DEV ? obj.stack : '[REDACTED]',
    } as any;
  }

  const sanitized: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_FIELDS.includes(key) ||
      SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));

    if (isSensitive) {
      if (removeField) {
        // Skip this field entirely
        continue;
      } else if (maskValue) {
        // Mask the value
        sanitized[key as keyof T] = '[REDACTED]' as T[keyof T];
      }
    } else if (value && typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key as keyof T] = sanitizeObject(value, options) as T[keyof T];
    } else {
      sanitized[key as keyof T] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitizes a string that might contain sensitive data
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }

  // Check if string contains sensitive patterns
  const hasSensitivePattern = SENSITIVE_PATTERNS.some((pattern) => pattern.test(str));

  if (hasSensitivePattern && str.length > 20) {
    // If it looks like it might contain sensitive data, mask it
    return '[REDACTED]';
  }

  return str;
}

/**
 * Safe console.log that automatically sanitizes sensitive data
 * In production, all logging is completely disabled for security and performance
 */
export const safeLog = {
  log: (...args: any[]) => {
    // In production, completely disable logging
    if (import.meta.env.PROD) {
      return;
    }
    // In development, sanitize and log
    const sanitized = args.map((arg) => {
      if (typeof arg === 'object' && arg !== null) {
        return sanitizeObject(arg, { maskValue: true, removeField: false });
      }
      if (typeof arg === 'string') {
        return sanitizeString(arg);
      }
      return arg;
    });
    console.log(...sanitized);
  },

  error: (...args: any[]) => {
    // CRITICAL: Always log errors, even in production, for debugging
    // Errors are essential for diagnosing blank screens and rendering issues
    // Sanitize and log
    const sanitized = args.map((arg) => {
      if (arg instanceof Error) {
        return {
          name: arg.name,
          message: arg.message,
          stack: import.meta.env.DEV ? arg.stack : '[REDACTED]',
        };
      }
      if (typeof arg === 'object' && arg !== null) {
        return sanitizeObject(arg, { maskValue: true, removeField: false });
      }
      if (typeof arg === 'string') {
        return sanitizeString(arg);
      }
      return arg;
    });
    console.error(...sanitized);
  },

  warn: (...args: any[]) => {
    // In production, completely disable warning logging
    if (import.meta.env.PROD) {
      return;
    }
    // In development, sanitize and log
    const sanitized = args.map((arg) => {
      if (typeof arg === 'object' && arg !== null) {
        return sanitizeObject(arg, { maskValue: true, removeField: false });
      }
      if (typeof arg === 'string') {
        return sanitizeString(arg);
      }
      return arg;
    });
    console.warn(...sanitized);
  },

  debug: (...args: any[]) => {
    // Debug logs are only available in development
    if (import.meta.env.DEV) {
      const sanitized = args.map((arg) => {
        if (typeof arg === 'object' && arg !== null) {
          return sanitizeObject(arg, { maskValue: true, removeField: false });
        }
        if (typeof arg === 'string') {
          return sanitizeString(arg);
        }
        return arg;
      });
      console.debug(...sanitized);
    }
    // In production, debug logs are silent
  },
};

/**
 * Ensures password fields are never exposed in DOM or console
 */
export function securePasswordInput(element: HTMLInputElement | null) {
  if (!element || element.type !== 'password') {
    return;
  }

  // Ensure autocomplete is set correctly
  element.setAttribute('autocomplete', 'current-password');

  // Prevent value from being exposed in DevTools
  // Note: This is a best-effort approach - browsers may still show values in DevTools
  // The real protection is ensuring we never log the value
  Object.defineProperty(element, 'value', {
    get() {
      return this._value || '';
    },
    set(newValue: string) {
      this._value = newValue;
      // Trigger input event for React
      const event = new Event('input', { bubbles: true });
      this.dispatchEvent(event);
    },
    configurable: true,
  });
}

/**
 * Sanitizes error objects before logging
 */
export function sanitizeError(error: unknown): {
  name?: string;
  message: string;
  stack?: string;
  code?: string;
  details?: any;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: import.meta.env.DEV ? error.stack : undefined,
      ...(error as any).code && { code: (error as any).code },
      ...(error as any).details && {
        details: sanitizeObject((error as any).details),
      },
    };
  }

  if (typeof error === 'object' && error !== null) {
    return {
      message: 'Unknown error',
      ...sanitizeObject(error as Record<string, any>),
    };
  }

  return {
    message: String(error),
  };
}


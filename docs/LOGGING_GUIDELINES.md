# Logging Guidelines for Developers

## Overview

This document provides guidelines for safe logging practices in the KidsCallHome application. Following these guidelines helps protect user privacy and prevent sensitive data exposure.

---

## ⚠️ Critical Rules

### 1. **NEVER Log Sensitive Data**

**Never log the following:**

- Passwords
- Login codes (child credentials)
- Push notification tokens
- API keys or secrets
- Email addresses (sanitize first)
- Phone numbers
- Family codes
- Credit card information
- Any PII (Personally Identifiable Information)

### 2. **Always Use `safeLog` Instead of `console.log`**

```typescript
// ❌ BAD - Direct console.log
console.log("User logged in:", user.email);
console.log("Login code:", code);
console.error("Error:", error);

// ✅ GOOD - Use safeLog
import { safeLog, sanitizeError, sanitizeObject } from "@/utils/security";

safeLog.log("User logged in:", sanitizeObject({ email: user.email }));
safeLog.log("Login attempt (code redacted)");
safeLog.error("Error:", sanitizeError(error));
```

---

## Safe Logging Utilities

All safe logging utilities are available in `src/utils/security.ts`:

### `safeLog`

Drop-in replacement for `console.log/error/warn` with automatic sanitization:

```typescript
import { safeLog } from "@/utils/security";

safeLog.log("Debug message", { data: "safe data" });
safeLog.warn("Warning message");
safeLog.error("Error message");
```

### `sanitizeError(error)`

Strips sensitive data from error objects:

```typescript
import { safeLog, sanitizeError } from "@/utils/security";

try {
  // some operation
} catch (error) {
  safeLog.error("Operation failed:", sanitizeError(error));
}
```

### `sanitizeObject(obj)`

Recursively removes/masks sensitive fields from objects:

```typescript
import { safeLog, sanitizeObject } from "@/utils/security";

const user = { email: "user@example.com", password: "secret123" };
safeLog.log("User data:", sanitizeObject(user));
// Output: User data: { email: "[REDACTED]", password: "[REDACTED]" }
```

### `sanitizeString(str)`

Checks strings for sensitive patterns and masks them:

```typescript
import { sanitizeString } from "@/utils/security";

const input = "User email: user@example.com";
const safe = sanitizeString(input);
// Output: "User email: [REDACTED]"
```

---

## Best Practices

### 1. **Log Metadata, Not Content**

```typescript
// ❌ BAD - Logging message content
console.log("New message:", message.content);

// ✅ GOOD - Logging metadata only
safeLog.log("New message received:", {
  messageId: message.id,
  senderType: message.sender_type,
  length: message.content.length,
  timestamp: message.created_at,
});
```

### 2. **Sanitize Before Logging**

```typescript
// ❌ BAD
console.log("User:", user);

// ✅ GOOD
safeLog.log("User:", sanitizeObject(user));
```

### 3. **Use Descriptive Messages**

```typescript
// ❌ BAD - Vague
safeLog.log("Error");

// ✅ GOOD - Descriptive
safeLog.error("Failed to fetch child data:", sanitizeError(error));
```

### 4. **Log Errors with Context**

```typescript
// ❌ BAD
catch (error) {
  safeLog.error(error);
}

// ✅ GOOD
catch (error) {
  safeLog.error("Failed to save message:", {
    error: sanitizeError(error),
    childId: childId, // Safe to log IDs
    timestamp: new Date().toISOString(),
  });
}
```

---

## Common Patterns

### Authentication Logging

```typescript
// ✅ Safe authentication logging
safeLog.log("Login attempt:", {
  userId: user.id, // Safe - just an ID
  timestamp: new Date().toISOString(),
  // Never log: email, password, login codes
});
```

### API Error Logging

```typescript
// ✅ Safe API error logging
const { data, error } = await supabase.from("table").select();

if (error) {
  safeLog.error("Database query failed:", {
    error: sanitizeError(error),
    table: "table",
    operation: "select",
    // Never log: query parameters that might contain sensitive data
  });
}
```

### Message Logging

```typescript
// ✅ Safe message logging
safeLog.log("Message received:", {
  messageId: message.id,
  senderType: message.sender_type,
  childId: message.child_id,
  isRead: !!message.read_at,
  // Never log: message.content
});
```

---

## ESLint Rules

The project includes ESLint rules to help enforce safe logging:

- **`no-console`**: Warns about direct `console.log` usage
- **Allowed**: `console.warn` and `console.error` for critical errors (but prefer `safeLog`)

Run linting:

```bash
npm run lint
```

Run security scan:

```bash
npm run lint:security
```

---

## Production Builds

**Console logs are automatically removed in production builds** to:

1. Reduce bundle size
2. Prevent accidental data exposure
3. Improve performance

This is handled by the Vite build configuration. `safeLog` calls are preserved (they're safe), but direct `console.log` calls are stripped.

---

## Security Scanning

The project includes an automated security scanner that checks for:

- Direct `console.log` usage (should use `safeLog`)
- Potential sensitive data in console logs
- Unsafe logging patterns

Run the scanner:

```bash
npm run lint:security
```

The scanner will:

- Scan all `.ts`, `.tsx`, `.js`, `.jsx` files in `src/`
- Report direct console.log usage
- Flag potential sensitive data exposure
- Exit with error code if issues found

---

## Examples of What NOT to Do

### ❌ Never Do This:

```typescript
// Exposing login codes
console.log("Login code:", code);

// Exposing push tokens
console.log("Push token:", token.value);

// Exposing emails
console.log("User email:", user.email);

// Exposing passwords (even in errors)
console.error("Password validation failed:", password);

// Exposing message content
console.log("Message:", message.content);

// Exposing family codes
console.log("Family code:", familyCode);
```

### ✅ Always Do This Instead:

```typescript
// Redact sensitive data
safeLog.log("Login attempt (code redacted)");

// Redact tokens
safeLog.log("Push registration success (token redacted)");

// Sanitize emails
safeLog.log("User:", sanitizeObject({ email: user.email }));

// Sanitize errors
safeLog.error("Password validation failed:", sanitizeError(error));

// Log metadata only
safeLog.log("Message received:", {
  messageId: message.id,
  length: message.content.length,
});

// Redact family codes
safeLog.log("Family code generated (code redacted)");
```

---

## Testing Your Logs

Before committing code:

1. **Run the security scanner:**

   ```bash
   npm run lint:security
   ```

2. **Check browser DevTools:**

   - Open DevTools Console
   - Navigate through your feature
   - Verify no sensitive data appears in logs

3. **Test error scenarios:**
   - Trigger errors intentionally
   - Verify error logs are sanitized
   - Check that no sensitive data leaks

---

## Questions?

If you're unsure whether something is safe to log:

1. **Ask yourself**: "Could this data be used to harm the user or compromise security?"
2. **If yes**: Don't log it, or sanitize it first
3. **When in doubt**: Use `sanitizeObject()` or `sanitizeError()`
4. **Still unsure?**: Ask the team or review `docs/CONSOLE_LOG_SECURITY_AUDIT.md`

---

## References

- **Security Audit**: `docs/CONSOLE_LOG_SECURITY_AUDIT.md`
- **Security Utilities**: `src/utils/security.ts`
- **OWASP Logging Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

---

**Remember**: When in doubt, sanitize. It's better to be overly cautious than to expose sensitive data.

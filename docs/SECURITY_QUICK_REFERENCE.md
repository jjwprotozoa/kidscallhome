# Security Quick Reference

## Quick Rules

1. **NEVER log passwords, tokens, or secrets**
2. **Always use `safeLog` instead of `console.log`**
3. **Sanitize errors before logging**
4. **Never expose API keys in frontend code**

---

## Import Security Utilities

```typescript
import { safeLog, sanitizeError, sanitizeObject } from "@/utils/security";
```

---

## Safe Logging Examples

### ✅ Good - Using safeLog

```typescript
// Logging user data (passwords auto-sanitized)
safeLog.log("User logged in:", { 
  userId: user.id, 
  email: user.email 
  // password is automatically redacted
});

// Logging errors (sensitive data auto-sanitized)
try {
  await authenticate();
} catch (error) {
  safeLog.error("Auth failed:", sanitizeError(error));
}
```

### ❌ Bad - Direct console.log

```typescript
// NEVER DO THIS
console.log("Password:", password);
console.log("Token:", token);
console.log("User:", user); // if user contains password
```

---

## Password Handling

### ✅ Good - Password Input

```typescript
<Input
  type="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  autoComplete="current-password"
  // Clear password after use
  onBlur={() => {
    // Password cleared in finally block
  }}
/>

// In handler:
try {
  await signIn({ email, password });
} finally {
  setPassword(""); // Clear after use
}
```

---

## Error Handling

### ✅ Good - Sanitized Errors

```typescript
try {
  await apiCall();
} catch (error) {
  // Automatically sanitizes sensitive data
  safeLog.error("API call failed:", sanitizeError(error));
  
  // Show user-friendly message
  toast({
    title: "Error",
    description: error instanceof Error ? error.message : "Unknown error",
  });
}
```

---

## External API Integration

If you need to call external APIs with secrets:

### Step 1: Create Vercel API Route

```typescript
// api/external-service.ts
export default async function handler(req: Request) {
  // Secrets are server-side only
  const apiKey = process.env.EXTERNAL_API_KEY;
  
  const response = await fetch('https://external-api.com/endpoint', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req.body),
  });
  
  return Response.json(await response.json());
}
```

### Step 2: Call from Frontend

```typescript
// Frontend code - no secrets exposed
const response = await fetch('/api/external-service', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ publicData: 'value' }),
});
```

### Step 3: Add Secret to Vercel

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add `EXTERNAL_API_KEY` with your secret value
3. Redeploy

---

## Sensitive Fields Auto-Detected

These fields are automatically sanitized:
- `password`, `Password`, `PASSWORD`
- `token`, `Token`, `TOKEN`
- `secret`, `Secret`, `SECRET`
- `apiKey`, `api_key`, `apikey`
- `accessToken`, `refreshToken`
- `authorization`, `Authorization`
- `cookie`, `Cookie`
- `session`, `Session`
- `credential`, `credentials`

---

## Checklist

Before committing code:
- [ ] No `console.log` with passwords/tokens
- [ ] Using `safeLog` for all logging
- [ ] Errors are sanitized before logging
- [ ] Password fields clear after use
- [ ] No API keys in frontend code
- [ ] External API secrets use proxy API

---

## Need Help?

See `docs/SECURITY_AUDIT.md` for detailed security documentation.


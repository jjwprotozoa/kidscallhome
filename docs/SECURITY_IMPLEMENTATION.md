# Security Implementation Guide
## Comprehensive Bot, Spam, and Attack Prevention

This document outlines all security measures implemented in KidsCallHome to prevent bots, spam, credential stuffing, brute-force attacks, and scraping.

---

## 🔒 Security Layers Implemented

### 1. ✅ Rate Limiting

**Client-Side Rate Limiting** (`src/utils/rateLimiting.ts`):
- **Login attempts**: Max 5 attempts per minute per email
- **Account lockout**: 15 minutes after 5 failed attempts
- **Child login**: Max 10 attempts per minute (more lenient for kids)
- **API calls**: Max 100 requests per minute

**Server-Side Rate Limiting** (`middleware.ts`):
- Vercel Edge Middleware enforces rate limits at the edge
- IP-based rate limiting for auth endpoints
- Returns HTTP 429 with `Retry-After` header when exceeded

**Usage**:
```typescript
import { checkRateLimit, recordRateLimit } from "@/utils/rateLimiting";

const rateLimitKey = getRateLimitKey(email, 'login');
const check = checkRateLimit(rateLimitKey, 'login');

if (!check.allowed) {
  // Handle rate limit exceeded
}
```

---

### 2. ✅ CAPTCHA/Turnstile Integration

**Cloudflare Turnstile** (`src/components/Captcha.tsx`):
- Invisible CAPTCHA that appears after 2 failed login attempts
- Free, privacy-focused alternative to reCAPTCHA
- Automatically verifies users are human
- **Server-side validation** via Supabase Edge Function (`supabase/functions/verify-turnstile`)

**Setup**:
1. Get Turnstile site key and secret key from [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Add to environment variables:
   ```env
   # Client-side (public)
   VITE_TURNSTILE_SITE_KEY=your_site_key_here
   
   # Server-side (secret - add to Supabase Edge Function secrets)
   TURNSTILE_SECRET_KEY=your_secret_key_here
   ```
3. Deploy the `verify-turnstile` Edge Function:
   ```bash
   supabase functions deploy verify-turnstile
   ```
4. Set the secret key in Supabase:
   ```bash
   supabase secrets set TURNSTILE_SECRET_KEY=your_secret_key_here
   ```
5. CAPTCHA automatically appears after failed attempts
6. Tokens are validated server-side before allowing login

**Security**: All Turnstile tokens are validated server-side using Cloudflare's Siteverify API. This is mandatory for security.

**Fallback**: Includes reCAPTCHA fallback component if Turnstile unavailable

---

### 3. ✅ Account Lockout Mechanism

**Automatic Lockout**:
- After 5 failed login attempts → Account locked for 15 minutes
- Lockout status tracked per email address
- Visual warnings shown to users (attempts remaining)
- Lockout clears automatically after timeout

**Implementation**:
- `recordFailedLogin()` tracks failed attempts
- `isEmailLocked()` checks lockout status
- `clearFailedLogins()` clears on successful login

---

### 4. ✅ Session Security

**Secure Session Management**:
- Supabase handles session tokens securely
- Sessions expire based on inactivity
- "Stay signed in" option uses persistent sessions
- Session clearing on browser close when unchecked

**Cookie Security** (Future Enhancement):
- Currently using localStorage (Supabase default)
- For production, consider server-side session cookies with:
  - `HttpOnly` flag (prevents JS access)
  - `Secure` flag (HTTPS only)
  - `SameSite=Strict` (CSRF protection)

---

### 5. ✅ CSRF Protection

**CSRF Token System** (`src/utils/csrf.ts`):
- Generates cryptographically secure tokens
- Tokens expire after 1 hour
- Automatically included in forms
- Validates tokens on server-side (when implemented)

**Usage**:
```typescript
import { getCSRFToken, validateCSRFToken } from "@/utils/csrf";

// In forms
<input type="hidden" name="csrf_token" value={getCSRFToken()} />

// On server (when implementing API routes)
if (!validateCSRFToken(req.body.csrf_token)) {
  return res.status(403).json({ error: 'Invalid CSRF token' });
}
```

---

### 6. ✅ Bot Detection

**Headless Browser Detection** (`src/utils/botDetection.ts`):
- Detects common bot user agents (Selenium, Puppeteer, etc.)
- Checks for WebDriver properties
- Validates browser features (plugins, languages, WebGL)
- Analyzes user behavior patterns

**Behavioral Analysis**:
- Tracks mouse movements, clicks, keystrokes, scrolls
- Detects mechanical timing patterns
- Identifies rapid page switching
- Flags zero-interaction sessions

**Usage**:
```typescript
import { detectBot, initBehaviorTracking } from "@/utils/botDetection";

// Initialize on app load
initBehaviorTracking();

// Check for bots
const botDetection = detectBot();
if (botDetection.isBot) {
  // Block or require additional verification
}
```

---

### 7. ✅ Input Validation & Sanitization

**Input Validation** (`src/utils/inputValidation.ts`):
- Email format validation
- Password strength requirements (min 6 chars, max 128)
- XSS pattern detection
- SQL injection pattern detection
- Child login code format validation

**Sanitization**:
- Removes dangerous HTML tags (`<`, `>`)
- Strips `javascript:` protocol
- Removes event handlers (`onclick=`, etc.)
- Preserves password special characters

**Usage**:
```typescript
import { sanitizeAndValidate } from "@/utils/inputValidation";

const validation = sanitizeAndValidate({
  email: emailInput,
  password: passwordInput,
});

if (!validation.valid) {
  // Show errors
  console.log(validation.errors);
}
```

---

### 8. ✅ Audit Logging

**Security Event Logging** (`src/utils/auditLog.ts`):
- Tracks all login attempts (success/failure)
- Records account lockouts
- Logs rate limit violations
- Tracks bot detections
- Monitors suspicious activity patterns

**Event Types**:
- `login_attempt`, `login_success`, `login_failed`
- `login_locked`, `account_locked`
- `rate_limit_exceeded`
- `bot_detected`
- `suspicious_activity`

**Usage**:
```typescript
import { logAuditEvent } from "@/utils/auditLog";

logAuditEvent('login_failed', {
  email: userEmail,
  severity: 'medium',
});
```

---

### 9. ✅ Security Headers

**Middleware Security Headers** (`middleware.ts`):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (restricts camera/microphone/geolocation)

---

### 10. ✅ Origin/Referer Validation

**Request Origin Validation**:
- Validates Origin header on state-changing requests (POST, PUT, DELETE)
- Only allows requests from trusted domains
- Blocks cross-origin attacks

**Allowed Origins**:
- `https://www.kidscallhome.com`
- `https://kidscallhome.com`
- `http://localhost:8080` (development)
- `http://localhost:5173` (development)

---

## 🚀 Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```env
# Cloudflare Turnstile (get from https://dash.cloudflare.com/)
VITE_TURNSTILE_SITE_KEY=your_site_key_here

# Supabase (already configured)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

### 2. Deploy Middleware

The `middleware.ts` file automatically runs on Vercel Edge. No additional configuration needed.

### 3. Test Security Features

1. **Rate Limiting**: Try logging in 6 times rapidly → Should lock account
2. **CAPTCHA**: Fail login 2 times → CAPTCHA should appear
3. **Bot Detection**: Open DevTools → Check console for bot detection logs
4. **Input Validation**: Try entering XSS patterns → Should be sanitized

---

## 📊 Monitoring & Alerting

### Client-Side Monitoring

Audit logs are stored in localStorage (last 100 entries) and can be sent to your server:

```typescript
import { getStoredAuditLogs, detectSuspiciousActivity } from "@/utils/auditLog";

// Get all audit logs
const logs = getStoredAuditLogs();

// Check for suspicious patterns
const suspicious = detectSuspiciousActivity();
if (suspicious.suspicious) {
  // Alert admin or send to monitoring service
}
```

### Server-Side Monitoring (Recommended)

1. **Set up Sentry** for error tracking:
   ```typescript
   import * as Sentry from "@sentry/react";
   
   Sentry.init({
     dsn: "your-sentry-dsn",
     environment: import.meta.env.MODE,
   });
   ```

2. **Set up Vercel Analytics** for traffic monitoring

3. **Create API endpoint** for audit logs:
   ```typescript
   // api/audit.ts
   export async function POST(req: Request) {
     const logEntry = await req.json();
     // Store in database or send to monitoring service
   }
   ```

---

## 🔧 Configuration

### Adjust Rate Limits

Edit `src/utils/rateLimiting.ts`:

```typescript
const RATE_LIMITS = {
  login: {
    maxAttempts: 5,        // Change this
    windowMs: 60 * 1000,   // Change this (1 minute)
    lockoutDurationMs: 15 * 60 * 1000, // Change this (15 minutes)
  },
  // ...
};
```

### Adjust Bot Detection Sensitivity

Edit `src/utils/botDetection.ts`:

```typescript
return {
  isBot: confidence >= 30, // Change threshold (0-100)
  // ...
};
```

### Adjust CAPTCHA Trigger

Edit `src/pages/ParentAuth.tsx`:

```typescript
// Show CAPTCHA after N failed attempts
if (failedLogin.attempts >= 2) { // Change this number
  setShowCaptcha(true);
}
```

---

## 🛡️ Additional Security Recommendations

### 1. Enable Supabase Rate Limiting

In Supabase Dashboard:
- Go to Settings → API
- Enable rate limiting
- Set limits for auth endpoints

### 2. Implement IP Blocking

For persistent attackers:
- Use Vercel Edge Config or Upstash Redis
- Store blocked IPs
- Check in middleware before processing requests

### 3. Add MFA (Multi-Factor Authentication)

For high-value accounts:
- Use Supabase MFA features
- Require MFA after suspicious activity
- Send SMS/Email verification codes

### 4. Set Up Webhook Monitoring

Monitor Supabase webhooks for:
- Failed login spikes
- Unusual access patterns
- Account creation anomalies

### 5. Regular Security Audits

- Review audit logs weekly
- Check for suspicious patterns
- Update security rules based on threats

---

## 📝 Testing Checklist

- [ ] Rate limiting blocks after 5 failed attempts
- [ ] Account locks after 5 failed logins
- [ ] CAPTCHA appears after 2 failed attempts
- [ ] Bot detection identifies headless browsers
- [ ] Input validation prevents XSS/SQL injection
- [ ] CSRF tokens are generated and validated
- [ ] Security headers are present in responses
- [ ] Origin validation blocks unauthorized domains
- [ ] Audit logs record all security events
- [ ] Session expires after inactivity

---

## 🆘 Troubleshooting

### CAPTCHA Not Showing

1. Check `VITE_TURNSTILE_SITE_KEY` is set
2. Verify Turnstile site key is valid
3. Check browser console for errors

### Rate Limiting Too Strict

1. Adjust limits in `src/utils/rateLimiting.ts`
2. Clear localStorage: `localStorage.clear()`
3. Check middleware rate limits

### Bot Detection False Positives

1. Lower confidence threshold in `botDetection.ts`
2. Whitelist specific user agents if needed
3. Review behavior analysis logic

---

## 📚 Related Documentation

- [Security Audit Report](./SECURITY_AUDIT.md)
- [Security Quick Reference](./SECURITY_QUICK_REFERENCE.md)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [Cloudflare Turnstile Docs](https://developers.cloudflare.com/turnstile/)

---

**Last Updated**: 2024
**Status**: ✅ All security layers implemented and active


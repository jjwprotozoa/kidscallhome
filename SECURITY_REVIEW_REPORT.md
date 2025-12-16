# Security Review Report

**Date:** 2025-01-XX  
**Application:** KidsCallHome  
**Review Type:** Comprehensive Security Audit

---

## Executive Summary

This security review identified **15 security risks** across multiple categories. The codebase demonstrates good security practices in many areas (authentication, RLS policies, input sanitization), but several critical and high-priority issues require immediate attention.

**Risk Breakdown:**

- 🔴 **Critical:** 2 issues
- 🟠 **High:** 4 issues
- 🟡 **Medium:** 6 issues
- 🟢 **Low:** 3 issues

---

## 🔴 CRITICAL RISKS

### 1. **Webhook Signature Verification Bypass**

**Location:** `supabase/functions/stripe-webhook/index.ts:64`

**Issue:** The `verifyWebhookSignature()` function has a hardcoded `return true;` statement that bypasses all signature verification.

```64:64:supabase/functions/stripe-webhook/index.ts
    return true; // Will be properly verified below
```

**Impact:** Attackers can forge Stripe webhook events, potentially:

- Creating fake subscriptions
- Modifying subscription statuses
- Bypassing payment verification
- Accessing unauthorized data

**Recommendation:**

- Remove the hardcoded `return true;`
- The function already uses Stripe SDK's `constructEvent()` below (line 110), which properly verifies signatures
- Remove the incomplete `verifyWebhookSignature()` function entirely since it's not used

**Fix:**

```typescript
// Remove the verifyWebhookSignature function entirely
// The code already uses Stripe SDK verification at line 110
```

---

### 2. **Overly Permissive CORS Configuration**

**Location:** Multiple Edge Functions

**Issue:** Several Supabase Edge Functions use `Access-Control-Allow-Origin: "*"` which allows any origin to make requests.

**Affected Files:**

- `supabase/functions/create-stripe-subscription/index.ts:23, 183`
- `supabase/functions/create-customer-portal-session/index.ts:15, 108`
- `supabase/functions/send-family-member-invitation/index.ts:8`

**Impact:**

- Cross-site request forgery (CSRF) attacks
- Unauthorized access to subscription endpoints
- Data leakage to malicious sites

**Recommendation:**

- Use specific allowed origins instead of `*`
- Validate the `Origin` header against a whitelist
- For authenticated endpoints, use credentials: `Access-Control-Allow-Credentials: true` with specific origins

**Fix Example:**

```typescript
const allowedOrigins = [
  "https://www.kidscallhome.com",
  "https://kidscallhome.com",
  "http://localhost:8080", // dev only
];

const origin = req.headers.get("origin");
const corsHeaders = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

if (origin && allowedOrigins.includes(origin)) {
  corsHeaders["Access-Control-Allow-Origin"] = origin;
  corsHeaders["Access-Control-Allow-Credentials"] = "true";
}

return new Response(null, { headers: corsHeaders });
```

---

## 🟠 HIGH PRIORITY RISKS

### 3. **In-Memory Rate Limiting (Not Distributed)**

**Location:** `middleware.ts:9`

**Issue:** Rate limiting uses an in-memory `Map` which won't work in distributed/edge environments.

```9:9:middleware.ts
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
```

**Impact:**

- Rate limits reset on each edge function instance
- Attackers can bypass rate limits by hitting different instances
- No protection against distributed attacks

**Recommendation:**

- Use Redis or Upstash for distributed rate limiting
- Implement IP-based rate limiting at the CDN level (Cloudflare)
- Consider using Vercel's built-in rate limiting features

---

### 4. **Weak Origin Validation (Subdomain Attack)**

**Location:** `middleware.ts:162`

**Issue:** Origin validation uses `.includes()` which is vulnerable to subdomain attacks.

```162:162:middleware.ts
    if (origin && !allowedOrigins.some((allowed) => origin.includes(allowed))) {
```

**Impact:**

- An attacker with `evil-kidscallhome.com` would pass validation
- CSRF attacks from malicious subdomains

**Recommendation:**

- Use exact match: `allowedOrigins.includes(origin)`
- Or validate domain structure properly

**Fix:**

```typescript
if (origin && !allowedOrigins.includes(origin)) {
  return new Response(
    JSON.stringify({ error: "Forbidden", message: "Invalid origin" }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}
```

---

### 5. **CSP Allows Unsafe Eval and Inline Scripts**

**Location:** `vercel.json:48`

**Issue:** Content Security Policy includes `'unsafe-inline'` and `'unsafe-eval'` which weaken XSS protection.

```48:48:vercel.json
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://challenges.cloudflare.com https://*.cloudflare.com; ...
```

**Impact:**

- XSS attacks can execute inline scripts
- `eval()` can be used to execute arbitrary code
- Reduced protection against code injection

**Recommendation:**

- Remove `'unsafe-eval'` if possible
- Use nonces or hashes for inline scripts instead of `'unsafe-inline'`
- Review which scripts require these permissions

---

### 6. **Error Messages May Leak Information**

**Location:** Multiple files

**Issue:** Some error messages expose internal details that could aid attackers.

**Examples:**

- `supabase/functions/create-stripe-subscription/index.ts:115` - Exposes Stripe API error details
- `supabase/functions/stripe-webhook/index.ts:119` - Exposes webhook verification failure details

**Impact:**

- Information disclosure about system internals
- Helps attackers understand system architecture
- May reveal API keys or endpoints

**Recommendation:**

- Return generic error messages to clients
- Log detailed errors server-side only
- Use error codes instead of descriptive messages

**Fix Example:**

```typescript
// Instead of:
return new Response(
  JSON.stringify({ error: "Failed to create Stripe customer", details: error }),
  { status: 500 }
);

// Use:
safeLog.error("Stripe customer creation failed:", error);
return new Response(
  JSON.stringify({ error: "Payment processing failed. Please try again." }),
  { status: 500 }
);
```

---

## 🟡 MEDIUM PRIORITY RISKS

### 7. **Missing Input Validation on Quantity Parameter**

**Location:** `supabase/functions/create-stripe-subscription/index.ts:65`

**Issue:** The `quantity` parameter is not validated for reasonable bounds.

```65:65:supabase/functions/create-stripe-subscription/index.ts
    const { subscriptionType, quantity = 1 } = await req.json();
```

**Impact:**

- Potential for resource exhaustion
- Unintended charges if quantity is extremely high
- No validation that quantity is a positive integer

**Recommendation:**

- Validate quantity is a positive integer
- Set maximum quantity limit (e.g., 1-10)
- Validate before processing

---

### 8. **Origin Header Used for Redirect URL (Open Redirect Risk)**

**Location:** `supabase/functions/create-stripe-subscription/index.ts:131`

**Issue:** Using `req.headers.get("origin")` for redirect URL without validation.

```131:131:supabase/functions/create-stripe-subscription/index.ts
    const returnUrl = req.headers.get("origin") || "http://localhost:8080";
```

**Impact:**

- Open redirect vulnerability
- Phishing attacks via malicious redirect URLs
- Users redirected to attacker-controlled domains

**Recommendation:**

- Validate origin against whitelist
- Use environment variable for allowed redirect domains
- Never trust client-provided redirect URLs

---

### 9. **Bot Detection Can Be Easily Bypassed**

**Location:** `middleware.ts:132-147`

**Issue:** Bot detection relies on simple user-agent string matching which is easily spoofed.

**Impact:**

- Automated attacks can bypass bot detection
- Simple user-agent changes defeat the protection

**Recommendation:**

- Use more sophisticated bot detection (Cloudflare Bot Management, CAPTCHA)
- Implement behavioral analysis
- Use rate limiting as primary defense

---

### 10. **Missing Rate Limiting on Webhook Endpoint**

**Location:** `supabase/functions/stripe-webhook/index.ts`

**Issue:** No rate limiting on webhook endpoint, allowing potential DoS attacks.

**Impact:**

- Attackers can flood webhook endpoint
- Resource exhaustion
- Potential service disruption

**Recommendation:**

- Implement rate limiting for webhook endpoint
- Use IP-based rate limiting
- Consider requiring webhook signature verification (already done, but ensure it's enforced)

---

### 11. **SQL Injection Detection Not Applied to Database Queries**

**Location:** `src/utils/inputValidation/textValidation.ts:87`

**Issue:** SQL injection detection exists but is only for display purposes. Supabase client should handle this, but no explicit validation.

**Note:** Supabase client uses parameterized queries, which protects against SQL injection. However, the detection function exists but isn't used to reject malicious input.

**Recommendation:**

- Validate user input before sending to database
- Use the `containsSQLInjection()` function to reject suspicious input
- Document that Supabase client handles parameterization

---

### 12. **Missing HTTPS Enforcement in Development**

**Location:** `vite.config.ts:62`

**Issue:** HTTPS is disabled in development, which could lead to credential exposure.

```62:62:vite.config.ts
      // https: true, // Uncomment this if you set up proper certificates
```

**Impact:**

- Credentials transmitted in plaintext during development
- Risk if development environment is exposed

**Recommendation:**

- Use HTTPS in development (with self-signed certs or ngrok)
- Document security implications
- Ensure production always uses HTTPS

---

## 🟢 LOW PRIORITY RISKS

### 13. **Console.warn Used in Production Code**

**Location:** `src/pages/ParentAuth/authHandlers.ts:120, 152`

**Issue:** `console.warn()` is used directly instead of `safeLog.warn()`.

**Impact:**

- Potential information leakage in production
- Inconsistent logging practices

**Recommendation:**

- Replace with `safeLog.warn()`
- Ensure all logging goes through security utilities

---

### 14. **Missing Content-Type Validation**

**Location:** Edge Functions

**Issue:** Edge functions don't validate `Content-Type` header before parsing JSON.

**Impact:**

- Potential for content-type confusion attacks
- MIME type sniffing vulnerabilities

**Recommendation:**

- Validate `Content-Type: application/json` before parsing
- Reject requests with incorrect content types

---

### 15. **X-Frame-Options Inconsistency**

**Location:** `vercel.json:60` vs `middleware.ts:180`

**Issue:** `vercel.json` uses `SAMEORIGIN` while `middleware.ts` uses `DENY`.

**Impact:**

- Confusion about actual policy
- Potential clickjacking if wrong policy is applied

**Recommendation:**

- Standardize on one policy (prefer `DENY` for security)
- Remove duplicate header configuration

---

## ✅ SECURITY STRENGTHS

The codebase demonstrates several good security practices:

1. **✅ Row Level Security (RLS):** Comprehensive RLS policies protect data isolation
2. **✅ Input Sanitization:** Good input validation and sanitization utilities
3. **✅ Safe Logging:** `safeLog` utility prevents sensitive data exposure
4. **✅ Authentication:** Proper Supabase authentication flow
5. **✅ Password Security:** Passwords are never logged, cleared after use
6. **✅ Security Headers:** Most security headers are properly configured
7. **✅ Audit Logging:** Audit log system tracks security events
8. **✅ Rate Limiting:** Basic rate limiting implemented (needs distribution)
9. **✅ Account Lockout:** Failed login attempts trigger account lockout
10. **✅ CAPTCHA:** CAPTCHA shown after multiple failed attempts

---

## 📋 RECOMMENDED ACTION ITEMS

### Immediate (Critical)

1. ✅ Fix webhook signature verification bypass
2. ✅ Restrict CORS to specific origins
3. ✅ Fix origin validation to prevent subdomain attacks

### Short-term (High Priority)

4. ✅ Implement distributed rate limiting
5. ✅ Strengthen CSP (remove unsafe-eval, use nonces)
6. ✅ Sanitize error messages

### Medium-term (Medium Priority)

7. ✅ Add input validation for all parameters
8. ✅ Validate redirect URLs
9. ✅ Improve bot detection
10. ✅ Add rate limiting to webhook endpoint

### Long-term (Low Priority)

11. ✅ Standardize logging practices
12. ✅ Add content-type validation
13. ✅ Standardize security headers

---

## 🔍 ADDITIONAL RECOMMENDATIONS

1. **Dependency Scanning:** Regularly scan dependencies for vulnerabilities
2. **Security Testing:** Implement automated security testing in CI/CD
3. **Penetration Testing:** Conduct periodic penetration testing
4. **Security Monitoring:** Set up alerts for suspicious activity
5. **Documentation:** Document security architecture and decisions
6. **Incident Response:** Create incident response plan

---

## 📚 REFERENCES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [Vercel Security Headers](https://vercel.com/docs/concepts/projects/environment-variables)
- [Stripe Webhook Security](https://stripe.com/docs/webhooks/signatures)

---

**Report Generated:** Automated Security Review  
**Next Review:** Recommended in 3 months or after major changes

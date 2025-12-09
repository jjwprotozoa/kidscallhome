# Production Console Errors - Troubleshooting Guide

## Overview

This document addresses common console errors seen in production deployments.

## Errors Fixed

### 1. Vercel Live Feedback Script Error

**Error:**
```
The FetchEvent for "https://vercel.live/_next-live/feedback/feedback.js" resulted in a network error response: Cross-Origin-Resource-Policy prevented from serving the response to the client.
```

**Cause:** Vercel Live is a development/preview feature that shouldn't be enabled in production.

**Solution:**
1. **Disable Vercel Live in Vercel Dashboard:**
   - Go to your Vercel project settings
   - Navigate to **Settings** → **General**
   - Find **Vercel Live** or **Preview Comments** section
   - Disable it for production deployments

2. **Configuration Fixes Applied:**
   - Added rewrite rule to redirect `/_next-live/*` paths to 404
   - Added redirect rule to block `/_next-live/*` requests
   - CSP headers block external scripts from `vercel.live` domain
   - These rules ensure Vercel Live requests are blocked at the edge

### 2. Content Security Policy (CSP) Warnings

**Error:**
```
Note that 'script-src' was not explicitly set, so 'default-src' is used as a fallback.
```

**Solution:** ✅ Fixed in `vercel.json`
- Added explicit `Content-Security-Policy` header with proper `script-src` directive
- CSP now applies to all requests (removed HTML-only restriction)
- Allows necessary scripts while blocking unwanted external scripts
- **Note:** This warning may still appear from Cloudflare's challenge script, which is normal

### 3. Cloudflare Challenge Warnings

**Errors:**
```
Request for the Private Access Token challenge.
The resource https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/g/cmg/1 was preloaded...
```

**Status:** ✅ **Normal - No action needed**

These warnings are expected when Cloudflare is protecting your site:
- Cloudflare automatically challenges suspicious traffic
- The Private Access Token is part of Cloudflare's bot protection
- These warnings don't affect functionality
- The CSP headers allow `challenges.cloudflare.com` for legitimate challenges

### 4. 403 Forbidden Error & Cloudflare Verification Stuck

**Error:**
```
GET https://www.kidscallhome.com/ 403 (Forbidden)
Site stuck on Cloudflare verification
```

**Solution:** ✅ Fixed in `vercel.json`
- **CSP Updates**: Added `https://*.cloudflare.com` to all relevant CSP directives to allow Cloudflare challenge scripts and resources
- **X-Frame-Options**: Changed from `DENY` to `SAMEORIGIN` to allow Cloudflare challenge iframes
- **Frame-ancestors**: Changed from `'none'` to `'self'` to allow Cloudflare challenge frames
- **Form-action**: Added `https://*.cloudflare.com` to allow Cloudflare challenge form submissions

**Additional Steps (if still stuck):**
1. **Check Cloudflare Security Settings**:
   - Go to Cloudflare Dashboard → Security → WAF
   - Check if "Security Level" is set too high (should be "Medium" or "Low" for production)
   - Review any custom firewall rules that might be blocking legitimate traffic

2. **Check Cloudflare Challenge Settings**:
   - Go to Security → Bots
   - Ensure "Bot Fight Mode" or "Super Bot Fight Mode" isn't blocking legitimate users
   - Consider adding your domain to "Allowlist" if needed

3. **Check Rate Limiting**:
   - Go to Security → Rate Limiting
   - Ensure rate limits aren't too aggressive for normal traffic

### 5. Performance Warning

**Error:**
```
[Violation] 'message' handler took 709ms
[Violation] 'setTimeout' handler took 50ms
```

**Status:** ⚠️ **Monitor - May need optimization**

These indicate handlers taking longer than expected:
- Message handlers (likely in service worker or WebSocket connections)
- setTimeout handlers (may be from Cloudflare challenge scripts)
- Monitor these - if they happen frequently, investigate:
  - Check service worker message handlers in `public/sw.js`
  - Check WebSocket/real-time connection handlers
  - Cloudflare challenge scripts may cause some of these (normal)

## Configuration Changes Made

### Updated `vercel.json`

**Security Headers:**
- `Content-Security-Policy`: Restricts resource loading to trusted sources (applies to all requests)
  - Allows Cloudflare domains (`https://*.cloudflare.com`) for challenge scripts
  - Allows Cloudflare challenge frames and form submissions
- `X-Frame-Options: SAMEORIGIN`: Allows same-origin frames (needed for Cloudflare challenges)
- `Cross-Origin-Embedder-Policy: unsafe-none`: Allows necessary cross-origin resources
- Additional security headers (X-Content-Type-Options, X-XSS-Protection, etc.)

**Vercel Live Blocking:**
- Rewrite rule: `/_next-live/*` → `/404`
- Redirect rule: `/_next-live/*` → `/404`
- CSP blocks `vercel.live` domain scripts

**Note:** Removed `Cross-Origin-Resource-Policy` as it was causing 403 errors on the main page

## Verification Steps

After deploying these changes:

1. **Check Console:**
   - Vercel Live errors should be gone (or blocked by CSP)
   - CSP warnings should be resolved
   - Cloudflare warnings are normal and can be ignored

2. **Test Functionality:**
   - Verify app loads correctly
   - Test video calls (camera/microphone permissions)
   - Test messaging and real-time features
   - Verify service worker registration

3. **Check Network Tab:**
   - No failed requests to `vercel.live`
   - Cloudflare challenges should complete successfully
   - All app resources load correctly

## Additional Notes

- **Vercel Live**: This is a preview feature. If you need it for preview deployments, you can enable it only for preview environments, not production. The configuration now blocks it via rewrites/redirects and CSP.
- **Cloudflare**: The challenge warnings (`document.write`, Private Access Token, etc.) are informational and don't indicate problems. They're part of Cloudflare's bot protection.
- **CSP**: The current CSP allows `unsafe-eval` and `unsafe-inline` for Vite compatibility. Consider tightening this in the future if possible.
- **403 Errors**: If you see 403 errors, check:
  - Cloudflare security settings (may be blocking legitimate traffic)
  - Vercel project settings (check for any access restrictions)
  - Browser console for specific error details

## Related Files

- `vercel.json` - Security headers configuration
- `middleware.ts` - Edge middleware for additional security
- `public/sw.js` - Service worker (check for slow message handlers)


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

2. **Alternative (if setting not available):**
   - The CSP headers in `vercel.json` will block external scripts from `vercel.live`
   - The `Cross-Origin-Resource-Policy: same-origin` header will prevent cross-origin resource loading

### 2. Content Security Policy (CSP) Warnings

**Error:**
```
Note that 'script-src' was not explicitly set, so 'default-src' is used as a fallback.
```

**Solution:** ✅ Fixed in `vercel.json`
- Added explicit `Content-Security-Policy` header with proper `script-src` directive
- Allows necessary scripts while blocking unwanted external scripts

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

### 4. Performance Warning

**Error:**
```
[Violation] 'message' handler took 709ms
```

**Status:** ⚠️ **Monitor - May need optimization**

This indicates a message handler (likely in a service worker or WebSocket connection) is taking longer than expected. Monitor this:
- If it happens frequently, investigate the specific handler
- Check service worker message handlers in `public/sw.js`
- Check WebSocket/real-time connection handlers

## Configuration Changes Made

### Updated `vercel.json`

Added comprehensive security headers:
- `Content-Security-Policy`: Restricts resource loading to trusted sources
- `Cross-Origin-Resource-Policy`: Prevents cross-origin resource loading
- `Cross-Origin-Embedder-Policy`: Allows necessary cross-origin resources
- Additional security headers (X-Content-Type-Options, X-Frame-Options, etc.)

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

- **Vercel Live**: This is a preview feature. If you need it for preview deployments, you can enable it only for preview environments, not production.
- **Cloudflare**: The challenge warnings are informational and don't indicate problems.
- **CSP**: The current CSP allows `unsafe-eval` and `unsafe-inline` for Vite compatibility. Consider tightening this in the future if possible.

## Related Files

- `vercel.json` - Security headers configuration
- `middleware.ts` - Edge middleware for additional security
- `public/sw.js` - Service worker (check for slow message handlers)


# Cloudflare Verification Issues - Troubleshooting Guide

## Overview

This guide addresses issues where the site gets stuck on Cloudflare verification or returns 403 errors during Cloudflare challenges.

## Common Symptoms

- Site stuck on "Checking your browser before accessing..." screen
- 403 Forbidden errors during page load
- Cloudflare challenge not completing
- Console errors related to Cloudflare challenge scripts

## Root Causes

1. **Security Headers Too Restrictive**: CSP or X-Frame-Options blocking Cloudflare challenge scripts
2. **Cloudflare Security Settings**: WAF or Bot Fight Mode blocking legitimate traffic
3. **Rate Limiting**: Aggressive rate limits blocking normal traffic
4. **SSL/TLS Mode**: Incorrect SSL/TLS mode causing verification issues

## Solutions

### 1. ✅ Configuration Fixes (Applied in `vercel.json`)

**CSP Updates:**
- Added `https://*.cloudflare.com` to `script-src` directive
- Added `https://*.cloudflare.com` to `style-src` directive
- Added `https://*.cloudflare.com` to `connect-src` directive
- Added `https://*.cloudflare.com` to `frame-src` directive
- Added `https://*.cloudflare.com` to `form-action` directive

**X-Frame-Options:**
- Changed from `DENY` to `SAMEORIGIN` to allow Cloudflare challenge iframes

**Frame-Ancestors:**
- Changed from `'none'` to `'self'` to allow Cloudflare challenge frames

### 2. Cloudflare Dashboard Settings

#### Security Level

1. Go to Cloudflare Dashboard → **Security** → **WAF**
2. Check **Security Level**:
   - **Recommended**: "Medium" for production
   - **Too High**: "High" or "I'm Under Attack" can cause verification issues
   - **Too Low**: "Low" or "Essentially Off" reduces protection

#### Bot Fight Mode

1. Go to **Security** → **Bots**
2. Check **Bot Fight Mode**:
   - If enabled, it may be too aggressive
   - Consider disabling or adjusting settings
   - **Super Bot Fight Mode** (paid) can be very aggressive

#### Firewall Rules

1. Go to **Security** → **WAF** → **Custom Rules**
2. Review any custom firewall rules:
   - Check if rules are blocking legitimate traffic
   - Look for rules blocking your IP or user agents
   - Temporarily disable rules to test

#### Rate Limiting

1. Go to **Security** → **Rate Limiting**
2. Check rate limit rules:
   - Ensure limits aren't too aggressive
   - Default limits should be fine for most sites
   - Custom rules may need adjustment

### 3. SSL/TLS Settings

1. Go to **SSL/TLS** → **Overview**
2. Ensure **SSL/TLS encryption mode** is set to:
   - **Full** (recommended): Encrypts connection to Cloudflare and to origin
   - **Full (strict)**: Requires valid SSL certificate on origin
   - Avoid: **Flexible** (less secure) or **Off** (insecure)

### 4. Challenge Settings

1. Go to **Security** → **Settings**
2. Check **Challenge Passage**:
   - Default is usually fine (5 minutes)
   - Can be adjusted if challenges are too frequent

3. Check **Browser Integrity Check**:
   - Should be enabled for security
   - If causing issues, can be disabled temporarily for testing

### 5. IP Access Rules

1. Go to **Security** → **WAF** → **Tools** → **IP Access Rules**
2. Check if your IP or IP ranges are blocked:
   - If blocked, add to allowlist
   - Check for any IPs that should be allowed

### 6. Page Rules

1. Go to **Rules** → **Page Rules**
2. Review page rules:
   - Check if any rules are interfering with challenges
   - Rules that bypass Cloudflare may cause issues

## Testing After Changes

1. **Clear Browser Cache**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. **Test in Incognito**: Test in private/incognito window
3. **Test Different Browsers**: Try Chrome, Firefox, Safari
4. **Test Different Networks**: Try from different network/IP
5. **Check Network Tab**: Look for blocked requests in browser DevTools

## Verification Checklist

- [ ] CSP allows `https://*.cloudflare.com` domains
- [ ] X-Frame-Options is `SAMEORIGIN` (not `DENY`)
- [ ] Frame-ancestors allows `'self'` (not `'none'`)
- [ ] Cloudflare Security Level is "Medium" or "Low"
- [ ] Bot Fight Mode is not too aggressive
- [ ] No custom firewall rules blocking legitimate traffic
- [ ] SSL/TLS mode is "Full" or "Full (strict)"
- [ ] Rate limiting is not too aggressive
- [ ] IP Access Rules don't block legitimate IPs

## Still Having Issues?

If the site is still stuck on verification after these fixes:

1. **Temporarily Lower Security**:
   - Set Security Level to "Low"
   - Disable Bot Fight Mode
   - Test if site loads

2. **Check Cloudflare Logs**:
   - Go to **Analytics** → **Security Events**
   - Look for blocked requests
   - Check what's being blocked and why

3. **Contact Cloudflare Support**:
   - If on paid plan, contact support
   - Provide specific error messages
   - Share security event logs

4. **Bypass Cloudflare Temporarily**:
   - Set DNS records to "DNS only" (gray cloud)
   - This bypasses Cloudflare proxy
   - Use only for testing, not production

## Related Files

- `vercel.json` - Security headers configuration
- `docs/troubleshooting/PRODUCTION_CONSOLE_ERRORS.md` - General production errors
- `docs/setup/CLOUDFLARE_DNS_CONFIG.md` - Cloudflare DNS setup


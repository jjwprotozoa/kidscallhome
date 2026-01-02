# Domain Errors Troubleshooting Guide

## Problem
- ✅ Vercel deployment URL works: `kids-call-home-13mvk3l11-justins-projects-f7a019bf.vercel.app`
- ❌ Custom domain throws errors: `https://www.kidscallhome.com`

## Quick Diagnosis Steps

### Step 1: Identify the Specific Error

**What error are you seeing?**
- SSL/TLS certificate error?
- "This site can't be reached" / Connection timeout?
- 502/503/504 errors?
- DNS resolution error?
- Mixed content warnings?
- Redirect loop?

**How to check:**
1. Open browser DevTools (F12)
2. Go to **Console** tab - look for error messages
3. Go to **Network** tab - check failed requests and their status codes
4. Try accessing the domain in an incognito/private window

### Step 2: Check Cloudflare SSL/TLS Mode (MOST COMMON FIX)

**This is the #1 cause of domain errors when Vercel URL works.**

1. Go to Cloudflare Dashboard:
   - https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
2. Navigate to **SSL/TLS** → **Overview**
3. Check the current encryption mode:
   - ❌ **Flexible** - This is likely your problem!
   - ✅ **Full** - Correct setting
   - ✅ **Full (strict)** - Also correct, more secure

**If it's set to "Flexible:**
1. Click the dropdown
2. Select **"Full"** (or "Full (strict)" if you prefer)
3. Save
4. Wait 2-5 minutes
5. Test the domain again

**Why this fixes it:**
- **Flexible mode**: Cloudflare → Vercel connection is NOT encrypted (HTTP)
- Vercel requires HTTPS connections
- This causes SSL handshake failures
- **Full mode**: Cloudflare → Vercel connection IS encrypted (HTTPS)
- Matches what Vercel expects

### Step 3: Verify Domain in Vercel Dashboard

1. Go to: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
2. Check both domains:
   - `kidscallhome.com`
   - `www.kidscallhome.com`
3. Look at the status for each:
   - ✅ **Valid Configuration** - Domain is properly configured
   - ⚠️ **Invalid Configuration** - DNS needs to be fixed
   - ⏳ **Pending** - SSL certificate is being provisioned (wait 5-15 minutes)
   - ❌ **Not Found** - Domain is not added (add it)

**If domain shows "Invalid Configuration":**
- Check the DNS records shown in Vercel
- Compare with your Cloudflare DNS records
- Ensure they match exactly

### Step 4: Check Cloudflare DNS Records

1. Go to Cloudflare Dashboard → **DNS** → **Records**
2. Verify you have these records:

**For www subdomain:**
```
Type: CNAME
Name: www
Target: 2f47c9cb96396e48.vercel-dns-017.com
Proxy: Orange cloud (proxied) ✅
TTL: Auto
```

**For root domain:**
```
Type: CNAME
Name: @
Target: 2f47c9cb96396e48.vercel-dns-017.com
Proxy: Orange cloud (proxied) OR Gray cloud (DNS only)
TTL: Auto
```

**Important:**
- The CNAME target should match what Vercel shows in the domain settings
- If Vercel shows a different target, update Cloudflare to match
- You can find the correct target in Vercel → Settings → Domains → [Your Domain] → Configuration

### Step 5: Test DNS Resolution

**From your computer:**
```bash
# Windows PowerShell
nslookup www.kidscallhome.com
nslookup kidscallhome.com

# Should show Cloudflare IPs (if proxied) or Vercel CNAME (if DNS only)
```

**Online tools:**
1. Go to: https://dnschecker.org
2. Check `www.kidscallhome.com` globally
3. Check `kidscallhome.com` globally
4. All locations should show the same DNS records

**If DNS is inconsistent:**
- Wait 15-30 minutes for propagation
- Clear your local DNS cache:
  - Windows: `ipconfig /flushdns`
  - Mac: `sudo dscacheutil -flushcache`
  - Linux: `sudo systemd-resolve --flush-caches`

### Step 6: Check Cloudflare Proxy Status

**If SSL/TLS is set to "Full" but still getting errors:**

1. Go to Cloudflare Dashboard → **DNS** → **Records**
2. For the `www` CNAME record:
   - **Orange cloud** = Proxied (goes through Cloudflare CDN)
   - **Gray cloud** = DNS only (direct to Vercel)

**Try this:**
1. If `www` is proxied (orange), temporarily set it to DNS only (gray)
2. Wait 2-5 minutes
3. Test the domain
4. If it works, the issue is with Cloudflare proxy + SSL
5. You can either:
   - Keep it DNS only (loses CDN benefits)
   - Fix SSL/TLS mode to "Full" and re-enable proxy

### Step 7: Check Browser Console for Specific Errors

**Open DevTools (F12) and check:**

**Console Tab:**
- Look for red error messages
- Common errors:
  - `NET::ERR_CERT_AUTHORITY_INVALID` - SSL certificate issue
  - `ERR_CONNECTION_REFUSED` - Server not responding
  - `ERR_NAME_NOT_RESOLVED` - DNS resolution failed
  - `ERR_TOO_MANY_REDIRECTS` - Redirect loop

**Network Tab:**
- Look for failed requests (red status)
- Check the status code:
  - `502 Bad Gateway` - Cloudflare can't reach Vercel
  - `503 Service Unavailable` - Vercel is down or overloaded
  - `504 Gateway Timeout` - Cloudflare timeout waiting for Vercel
  - `SSL_ERROR_*` - SSL/TLS handshake failed

## Common Error Solutions

### Error: "This site can't be reached" / Connection Timeout

**Causes:**
1. DNS not resolving correctly
2. Cloudflare proxy blocking connection
3. Vercel domain not properly configured

**Fix:**
1. Check DNS propagation (Step 5)
2. Verify domain in Vercel (Step 3)
3. Try disabling Cloudflare proxy temporarily (Step 6)

### Error: SSL Certificate Error / "Not Secure"

**Causes:**
1. Cloudflare SSL/TLS mode set to "Flexible"
2. SSL certificate not provisioned yet
3. Mixed content (HTTP resources on HTTPS page)

**Fix:**
1. Set Cloudflare SSL/TLS to "Full" (Step 2)
2. Wait 5-15 minutes for SSL certificate provisioning
3. Check Vercel dashboard for certificate status

### Error: 502 Bad Gateway

**Causes:**
1. Cloudflare can't reach Vercel
2. SSL/TLS mode mismatch
3. Vercel deployment issue

**Fix:**
1. Set Cloudflare SSL/TLS to "Full"
2. Check Vercel deployment status
3. Verify domain is added in Vercel

### Error: 503 Service Unavailable

**Causes:**
1. Vercel deployment failed
2. Vercel service outage
3. Domain configuration issue in Vercel

**Fix:**
1. Check Vercel dashboard for deployment status
2. Verify domain configuration in Vercel
3. Check Vercel status page: https://www.vercel-status.com

### Error: ERR_TOO_MANY_REDIRECTS

**Causes:**
1. Redirect loop between root and www
2. Cloudflare Page Rule conflict
3. Vercel redirect conflict

**Fix:**
1. Check Cloudflare Page Rules (Rules → Page Rules)
2. Check `vercel.json` redirects
3. Remove duplicate redirects

## Quick Fix Checklist

Run through these in order:

- [ ] **Step 1**: Identify the specific error message
- [ ] **Step 2**: Set Cloudflare SSL/TLS to "Full" (most common fix)
- [ ] **Step 3**: Verify domain in Vercel dashboard (should show "Valid Configuration")
- [ ] **Step 4**: Check Cloudflare DNS records match Vercel
- [ ] **Step 5**: Test DNS resolution (should resolve correctly)
- [ ] **Step 6**: Try disabling Cloudflare proxy temporarily
- [ ] **Step 7**: Check browser console for specific errors

## Still Not Working?

If none of the above fixes work:

1. **Check Vercel deployment logs:**
   - Go to Vercel dashboard → Deployments
   - Check the latest deployment for errors

2. **Test from different networks:**
   - Try from mobile data (not WiFi)
   - Try from different location
   - Use VPN to test from different region

3. **Contact support:**
   - Vercel Support: https://vercel.com/support
   - Cloudflare Support: https://support.cloudflare.com

4. **Share diagnostic information:**
   - Browser console errors
   - Network tab failed requests
   - DNS resolution results
   - Cloudflare SSL/TLS mode
   - Vercel domain status

## Expected Configuration

**Cloudflare:**
- SSL/TLS mode: **Full** or **Full (strict)**
- DNS records: CNAME pointing to Vercel
- Proxy: Orange cloud (proxied) for CDN benefits

**Vercel:**
- Both domains added: `kidscallhome.com` and `www.kidscallhome.com`
- Status: **Valid Configuration**
- SSL certificates: Provisioned and valid

**DNS:**
- Nameservers: Cloudflare (`bruce.ns.cloudflare.com`, `kay.ns.cloudflare.com`)
- Records: CNAME to Vercel target
- Propagation: Complete globally

## Related Documentation

- [Quick Fix Guide](./QUICK_FIX_ROOT_DOMAIN.md)
- [Root Domain Loading Issue](./ROOT_DOMAIN_LOADING_ISSUE.md)
- [Confirmed Configuration](./CONFIRMED_CONFIGURATION.md)
- [Vercel Domain Configuration](../setup/VERCEL_CNAME_CONFIGURATION.md)


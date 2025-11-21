# Quick Fix: Root Domain Loading Issue

## Architecture
- **Domain**: Hostinger (registrar)
- **DNS**: Cloudflare (nameservers + DNS records)
- **Hosting**: Vercel (application)

## Problem
- ✅ `www.kidscallhome.com` always loads
- ❌ `kidscallhome.com` sometimes doesn't load on first try

## Immediate Fix (5 minutes)

### Step 0: Verify Domain Configuration ✅ **CONFIRMED**

**Status**: Both domains are confirmed to be added in Vercel with SSL certificates:
- ✅ `kidscallhome.com` - Has SSL certificate
- ✅ `www.kidscallhome.com` - Has SSL certificate

**This is NOT the issue.** Proceed to the solutions below.

### Step 1: Check Cloudflare SSL/TLS Settings

1. Go to: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
2. Navigate to **SSL/TLS** → **Overview**
3. Ensure SSL/TLS encryption mode is set to **"Full"** (not "Flexible")
4. If it's "Flexible", change it to **"Full"** and save

**Why**: Flexible mode can cause SSL handshake failures with Vercel, especially on first load.

### Step 2: Disable Cloudflare Proxy for Root Domain (Recommended)

This is the quickest fix that usually resolves the issue immediately.

1. In Cloudflare Dashboard, go to **DNS** → **Records**
2. Find the `@` CNAME record (root domain)
3. Click the **orange cloud** icon to turn it **gray** (DNS only)
4. Keep `www` as **orange cloud** (proxied) - this still gets CDN benefits
5. Wait 2-5 minutes for changes to propagate

**Why**: 
- Root domain with proxy can have SSL handshake delays
- DNS-only mode bypasses Cloudflare proxy for root domain
- Redirect still works (handled by Vercel)
- `www` subdomain still benefits from Cloudflare CDN

### Step 3: Test

1. Wait 2-5 minutes after making changes
2. Open incognito/private browser window
3. Try: `https://kidscallhome.com`
4. Should redirect to `https://www.kidscallhome.com` and load successfully

## Alternative: Use Cloudflare Page Rule (Better Long-term)

If you want to keep both domains proxied, use Cloudflare Page Rules instead:

1. Go to Cloudflare Dashboard → **Rules** → **Page Rules**
2. Click **Create Page Rule**
3. Configure:
   - **URL**: `kidscallhome.com/*`
   - **Setting**: Forwarding URL
   - **Status Code**: 301 (Permanent Redirect)
   - **Destination URL**: `https://www.kidscallhome.com/$1`
4. Save
5. (Optional) Remove redirect from `vercel.json` to avoid double redirect

**Why**: Redirect happens at Cloudflare edge (faster) instead of Vercel.

## Verify DNS Propagation

After making changes, verify DNS is working:

1. Go to: https://dnschecker.org
2. Check `kidscallhome.com` globally
3. All locations should show correct DNS records

## Current Configuration

- **Cloudflare Zone**: `47da5b94667c38fe40fe90419402ac78`
- **Dashboard**: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
- **Vercel CNAME**: `2f47c9cb96396e48.vercel-dns-017.com`

## Expected Result

After applying fixes:
- ✅ `kidscallhome.com` loads reliably on first try
- ✅ Redirects to `www.kidscallhome.com`
- ✅ `www.kidscallhome.com` continues to work perfectly

## If Issue Persists

1. Clear DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
2. Wait 15-30 minutes for full DNS propagation
3. Test from different networks/devices
4. Check Vercel dashboard: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
   - Both domains should show "Valid Configuration"

## Related Documentation

- [Full Troubleshooting Guide](./ROOT_DOMAIN_LOADING_ISSUE.md)
- [DNS Quick Reference](../setup/DNS_QUICK_REFERENCE.md)


# Root Domain Loading Issue (kidscallhome.com)

## Architecture Context

**Current Setup**:

- **Domain Registrar**: Hostinger (owns `kidscallhome.com`)
- **DNS Provider**: Cloudflare (manages DNS records)
- **Hosting**: Vercel (hosts the application)

**Flow**: Hostinger → Cloudflare Nameservers → Cloudflare DNS → Vercel

## Problem ✅ RESOLVED

- ✅ `www.kidscallhome.com` always loads on first try
- ✅ `kidscallhome.com` now loads reliably (resolved via Cloudflare Page Rule)
- **Solution Applied**: Cloudflare Page Rule redirect at edge

## Root Causes

### 0. Domain Not Added in Vercel ✅ **VERIFIED - NOT THE ISSUE**

**Status**: Both domains are confirmed to be added in Vercel:

- ✅ `kidscallhome.com` - SSL certificate: `cert_q3B3moGlXndt60zhlBnQDAMo` (expires Feb 12, 2026)
- ✅ `www.kidscallhome.com` - SSL certificate: `cert_DpMPL2DpBiWmiWOYprfJbjLa` (expires Feb 12, 2026)
- ✅ Wildcard certificate also covers both domains

**This is NOT the root cause.** The issue is likely one of the following solutions.

### 1. Cloudflare Proxy Mode Issues

When Cloudflare is proxying (orange cloud), the root domain can have issues with:

- SSL certificate handshake delays
- DNS resolution through Cloudflare's edge network
- First-request cold starts

### 2. DNS Propagation

After migrating DNS from Hostinger to Cloudflare, some DNS resolvers may still have cached Hostinger DNS records:

- Root domain (@) is more complex than subdomains
- Some resolvers cache root domain records longer
- TTL values may not have fully expired globally
- Hostinger DNS records may still be cached in some locations

### 3. Redirect Chain Complexity

Current flow for `kidscallhome.com`:

```
User's Browser
  → DNS Resolver (may have cached Hostinger DNS)
  → Cloudflare Nameservers (bruce.ns.cloudflare.com)
  → Cloudflare DNS Records
  → Cloudflare Proxy (if enabled) OR Direct to Vercel
  → Vercel (hosting)
  → 301 Redirect to www.kidscallhome.com (via vercel.json)
  → Repeat DNS lookup for www
  → Cloudflare Proxy (if enabled) OR Direct to Vercel
  → Vercel (hosting)
  → Returns: Application
```

This multi-hop chain can fail at any point, especially on first load when DNS may still be propagating.

### 4. SSL Certificate Provisioning

Root domain SSL may take longer to provision or validate through Cloudflare proxy.

## Solutions

### Solution 1: Disable Cloudflare Proxy for Root Domain (Quick Fix)

**Why**: Direct DNS resolution bypasses Cloudflare proxy issues

**Steps**:

1. Go to Cloudflare Dashboard: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
2. Navigate to **DNS** → **Records**
3. Find the `@` CNAME record
4. Click the **orange cloud** icon to turn it **gray** (DNS only)
5. Keep `www` as **orange cloud** (proxied) for CDN benefits
6. Wait 2-5 minutes for changes to propagate

**Pros**:

- ✅ Immediate fix for root domain loading
- ✅ Simpler DNS resolution path
- ✅ Less SSL handshake complexity

**Cons**:

- ❌ Root domain won't benefit from Cloudflare CDN
- ❌ No DDoS protection for root domain (but www still has it)

### Solution 2: Use Cloudflare Page Rules for Redirect ✅ **APPLIED - WORKING**

**Why**: Handle redirect at Cloudflare level, reducing redirect chain complexity

**Steps** (Completed):

1. ✅ Created Cloudflare Page Rule
2. ✅ URL Pattern: `kidscallhome.com/*`
3. ✅ Action: Forwarding URL → `https://www.kidscallhome.com/$1`
4. ✅ Status Code: 301 (Permanent Redirect)
5. ⚠️ Optional: Remove redirect from `vercel.json` (not necessary, but cleaner)

**Result**: ✅ Root domain now loads reliably and redirects properly

**Pros**:

- ✅ Redirect happens at Cloudflare edge (faster)
- ✅ Reduces load on Vercel
- ✅ Better caching behavior
- ✅ Root domain can stay proxied

**Cons**:

- ⚠️ Requires Cloudflare Page Rules (free plan has 3 rules) - ✅ One rule used

### Solution 3: Fix Cloudflare SSL/TLS Settings

**Why**: Incorrect SSL mode can cause handshake failures

**Steps**:

1. Go to Cloudflare Dashboard → **SSL/TLS** → **Overview**
2. Ensure SSL/TLS encryption mode is set to **"Full"** or **"Full (strict)"**
   - **Full**: Encrypts connection to Cloudflare and to origin (Vercel)
   - **Full (strict)**: Same as Full, but validates origin certificate
3. If using **Flexible**, change to **Full** (Flexible can cause issues with Vercel)

**Current Setting Check**:

- If root domain is proxied: Should be **Full** or **Full (strict)**
- If root domain is DNS-only: SSL is handled by Vercel (no Cloudflare SSL settings needed)

### Solution 4: Check DNS Propagation Status

**Why**: Verify DNS records are fully propagated globally

**Steps**:

1. Go to https://dnschecker.org
2. Check `kidscallhome.com` A/CNAME records globally
3. Check `www.kidscallhome.com` CNAME records globally
4. Verify all locations show Cloudflare nameservers
5. If some locations show old Hostinger records, wait for TTL to expire

**Expected Results**:

- All locations should show: `2f47c9cb96396e48.vercel-dns-017.com` (or Cloudflare proxy IPs if proxied)
- Nameservers should be: `bruce.ns.cloudflare.com` and `kay.ns.cloudflare.com`

### Solution 5: Increase DNS TTL (After Propagation)

**Why**: Once fully propagated, higher TTL reduces DNS lookup delays

**Steps**:

1. After DNS is fully propagated (24-48 hours)
2. In Cloudflare DNS records, change TTL from **Auto** to **1 hour** (3600 seconds)
3. This reduces DNS lookup time for repeat visitors

**Note**: Don't do this until DNS is fully propagated, or it will slow down propagation of future changes.

## Recommended Action Plan

### Immediate (Do Now):

1. ✅ **Check Cloudflare SSL/TLS mode** → Set to "Full" if not already
2. ✅ **Test root domain** → Try `kidscallhome.com` in incognito mode
3. ✅ **Check DNS propagation** → Use dnschecker.org

### Short-term (Today):

1. **Option A (Quick)**: Disable proxy for root domain (`@` record → gray cloud)
2. **Option B (Better)**: Set up Cloudflare Page Rule for redirect

### Long-term (After 24-48 hours):

1. Monitor DNS propagation completion
2. Consider increasing TTL after full propagation
3. Test from multiple locations/devices

## Testing

After applying fixes, test:

1. **Incognito/Private browsing**:

   - `https://kidscallhome.com` (should redirect to www)
   - `https://www.kidscallhome.com` (should load directly)

2. **Multiple browsers**:

   - Chrome, Firefox, Edge, Safari

3. **Multiple devices**:

   - Desktop, mobile, tablet

4. **DNS tools**:
   - https://dnschecker.org
   - `nslookup kidscallhome.com`
   - `dig kidscallhome.com`

## Current Configuration Reference

- **Cloudflare Zone ID**: `47da5b94667c38fe40fe90419402ac78`
- **Vercel CNAME Target**: `2f47c9cb96396e48.vercel-dns-017.com`
- **Nameservers**: `bruce.ns.cloudflare.com`, `kay.ns.cloudflare.com`
- **Current Proxy Status**: Both `@` and `www` are proxied (orange cloud)

## Related Documentation

- [Vercel Domain Not Added](./VERCEL_DOMAIN_NOT_ADDED.md) ⚠️ **CHECK THIS FIRST** - Most likely root cause
- [Architecture Overview](../setup/ARCHITECTURE_OVERVIEW.md) - Complete setup explanation (Hostinger → Cloudflare → Vercel)
- [DNS Flow Diagram](../setup/DNS_FLOW_DIAGRAM.md) - Detailed request flow
- [DNS Quick Reference](../setup/DNS_QUICK_REFERENCE.md)
- [Cloudflare DNS Config](../setup/CLOUDFLARE_DNS_CONFIG.md)
- [Domain Troubleshooting](./DOMAIN_NOT_REACHABLE.md)

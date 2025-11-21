# Architecture Overview

## Current Setup

```
┌─────────────────┐
│   Hostinger     │  ← Domain Registrar (kidscallhome.com)
│  (Registrar)    │     - Manages domain ownership
└────────┬────────┘     - Points nameservers to Cloudflare
         │
         │ Nameservers: bruce.ns.cloudflare.com, kay.ns.cloudflare.com
         │
         ▼
┌─────────────────┐
│   Cloudflare    │  ← DNS & CDN Provider
│  (DNS/CDN)      │     - Manages DNS records
└────────┬────────┘     - Provides CDN caching (optional)
         │              - DDoS protection (optional)
         │              - SSL/TLS termination (if proxied)
         │
         │ DNS Records:
         │ - @ (kidscallhome.com) → CNAME → Vercel
         │ - www → CNAME → Vercel
         │
         ▼
┌─────────────────┐
│     Vercel      │  ← Hosting Provider
│  (Hosting)      │     - Hosts the application
└─────────────────┘     - Provides SSL certificates
                         - Handles deployments
                         - Auto-scaling
```

## Component Responsibilities

### Hostinger (Domain Registrar)
- **Role**: Domain ownership and registration
- **What it does**:
  - Owns the `kidscallhome.com` domain
  - Points nameservers to Cloudflare
  - Manages domain renewal
- **What it doesn't do**:
  - DNS resolution (delegated to Cloudflare)
  - Hosting (delegated to Vercel)

### Cloudflare (DNS & CDN)
- **Role**: DNS management and optional CDN/proxy
- **What it does**:
  - Resolves DNS queries for `kidscallhome.com`
  - Manages DNS records (CNAME to Vercel)
  - Optional: CDN caching, DDoS protection, SSL termination
- **Current Configuration**:
  - Nameservers: `bruce.ns.cloudflare.com`, `kay.ns.cloudflare.com`
  - Zone ID: `47da5b94667c38fe40fe90419402ac78`
  - DNS Records: Both `@` and `www` point to Vercel

### Vercel (Hosting)
- **Role**: Application hosting and deployment
- **What it does**:
  - Hosts the React/PWA application
  - Provides SSL certificates
  - Handles deployments
  - Auto-scaling
- **Current Configuration**:
  - Project: `kids-call-home`
  - Team: `justins-projects-f7a019bf`
  - CNAME Target: `2f47c9cb96396e48.vercel-dns-017.com`

## Data Flow

### When User Visits `www.kidscallhome.com`:

1. **DNS Lookup**:
   ```
   User's Browser
     → DNS Resolver (e.g., 8.8.8.8)
     → Hostinger (domain registrar)
     → Cloudflare Nameservers (bruce.ns.cloudflare.com)
     → Cloudflare DNS Records
     → Returns: CNAME → 2f47c9cb96396e48.vercel-dns-017.com
   ```

2. **HTTP Request**:
   ```
   User's Browser
     → Cloudflare (if proxied) OR Direct to Vercel (if DNS-only)
     → Vercel Edge Network
     → Vercel Application
     → Returns: HTML/CSS/JS
   ```

### When User Visits `kidscallhome.com` (root domain):

1. **DNS Lookup** (same as above)
2. **HTTP Request**:
   ```
   User's Browser
     → Cloudflare (if proxied) OR Direct to Vercel (if DNS-only)
     → Vercel Edge Network
     → Vercel Redirect (via vercel.json)
     → 301 Redirect to www.kidscallhome.com
     → (Repeat flow for www)
   ```

## Current Issues & Solutions

### Issue: Root Domain Sometimes Doesn't Load

**Root Causes**:
1. Cloudflare proxy mode causing SSL handshake delays
2. DNS propagation after migration from Hostinger
3. Redirect chain complexity (root → Cloudflare → Vercel → redirect → Cloudflare again)

**Solutions**:
1. **Quick Fix**: Disable Cloudflare proxy for root domain (`@` record)
2. **Better Fix**: Use Cloudflare Page Rule for redirect (handles at edge)
3. **SSL Fix**: Ensure Cloudflare SSL/TLS mode is "Full" (not "Flexible")

## Configuration Files

### Vercel Configuration
- **File**: `vercel.json`
- **Redirect**: `kidscallhome.com` → `www.kidscallhome.com` (301 redirect)

### Cloudflare Configuration
- **Dashboard**: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
- **DNS Records**: Managed via Cloudflare dashboard or API
- **Page Rules**: Can be used for redirects (better than Vercel redirect)

## Benefits of This Architecture

### ✅ Separation of Concerns
- **Hostinger**: Domain management (simple, reliable)
- **Cloudflare**: DNS/CDN (fast, reliable, free)
- **Vercel**: Hosting (optimized for web apps, auto-scaling)

### ✅ Reliability
- If Vercel is down → Cloudflare can serve cached content (if proxied)
- If Cloudflare DNS is down → Very rare (99.99%+ uptime)
- If Hostinger is down → Only affects domain renewal, not DNS/hosting

### ✅ Performance
- Cloudflare CDN (if proxied) → Faster global delivery
- Vercel Edge Network → Optimized for web apps
- DNS caching → Faster DNS resolution

### ✅ Cost
- Hostinger: Domain registration (~$10-15/year)
- Cloudflare: Free (DNS + basic CDN)
- Vercel: Free tier available

## Migration History

**Previous Setup**:
- Domain: Hostinger
- DNS: Hostinger
- Hosting: Hostinger

**Current Setup**:
- Domain: Hostinger ✅ (unchanged)
- DNS: Cloudflare ✅ (migrated)
- Hosting: Vercel ✅ (migrated)

**Why Migrated**:
- Better DNS reliability (Cloudflare 99.99%+ uptime)
- Better hosting for web apps (Vercel optimized for React/Next.js)
- Free CDN (Cloudflare)
- Better developer experience (Vercel)

## Related Documentation

- [DNS Quick Reference](./DNS_QUICK_REFERENCE.md)
- [Cloudflare DNS Config](./CLOUDFLARE_DNS_CONFIG.md)
- [Root Domain Loading Issue](../troubleshooting/ROOT_DOMAIN_LOADING_ISSUE.md)
- [Quick Fix Guide](../troubleshooting/QUICK_FIX_ROOT_DOMAIN.md)


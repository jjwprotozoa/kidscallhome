# Cloudflare DNS Configuration for Vercel

## Cloudflare Account Information

- **Zone ID**: `47da5b94667c38fe40fe90419402ac78`
- **Account ID**: `b1a8f1b6b9e7c3969413a8c1db5dbdc8`
- **Domain**: `kidscallhome.com`
- **Dashboard**: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com

## Vercel SSL Certificate Information

Vercel automatically provisions SSL certificates once DNS is properly configured. These are the certificate IDs for reference:

- **kidscallhome.com**: `cert_q3B3moGlXndt60zhIBnQDAMo`
- **www.kidscallhome.com**: `cert_DpMPL2DpBiWmiWOYprfJbjLa`

**Note**: These certificates are automatically managed by Vercel. You don't need to configure them manually - they will be provisioned once DNS records are correctly set up in Cloudflare.

## Prerequisites

1. ✅ Cloudflare account created
2. ✅ Domain added to Cloudflare
3. ✅ Nameservers updated at domain registrar (Hostinger)
   - `bruce.ns.cloudflare.com`
   - `kay.ns.cloudflare.com`
4. ⏳ **Wait for nameserver propagation** (15-30 minutes)
5. ⏳ **Get DNS targets from Vercel** (Do this next!)

## Step 1: Verify Nameserver Propagation ✅

**Status**: Nameservers are active and propagating!

Verified nameserver configuration:

- `bruce.ns.cloudflare.com` (TTL: 21600)
- `kay.ns.cloudflare.com` (TTL: 21600)

The domain is now using Cloudflare's nameservers globally. You can proceed to configure DNS records.

## Step 2: Get DNS Targets from Vercel

**IMPORTANT**: Since you're using Cloudflare for DNS management, you do NOT need to use Vercel's nameservers (`ns1.vercel-dns.com` and `ns2.vercel-dns.com`). Instead, you need to configure CNAME records in Cloudflare.

1. Go to Vercel dashboard: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
2. Add both domains if not already added:
   - `kidscallhome.com`
   - `www.kidscallhome.com`
3. For each domain, Vercel will show you the DNS configuration needed
4. **Look for the CNAME target** (not the nameservers) - it will look something like:
   - `2f47c9cb96396e48.vercel-dns-017.com.` (example - use your actual value)
   - This is what you'll use in Cloudflare DNS records

**Note**:

- You're using Cloudflare nameservers (already configured ✅)
- You need CNAME records in Cloudflare pointing to Vercel's DNS targets
- You do NOT need to change nameservers to Vercel's nameservers
- The DNS targets are unique to your Vercel project and won't change unless you delete/recreate the project

## Step 3: Configure DNS Records in Cloudflare

### Option A: Using Cloudflare Dashboard (Recommended)

1. Go to Cloudflare dashboard: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
2. Navigate to **DNS** → **Records**
3. Click **Add record**

#### For www subdomain (www.kidscallhome.com):

```
Type: CNAME
Name: www
Target: [Paste the Vercel CNAME target from Step 1]
Proxy status: DNS only (gray cloud) - OR - Proxied (orange cloud)
TTL: Auto
```

**Proxy Status Options:**

- **DNS only (gray cloud)**: Direct DNS resolution to Vercel (recommended for now)
- **Proxied (orange cloud)**: Routes through Cloudflare CDN (better performance, but requires additional setup)

#### For root domain (@ - kidscallhome.com):

Cloudflare supports CNAME flattening for root domains, so you can use a CNAME record:

```
Type: CNAME
Name: @
Target: [Paste the Vercel CNAME target from Step 1]
Proxy status: DNS only (gray cloud) - OR - Proxied (orange cloud)
TTL: Auto
```

**Alternative (if CNAME doesn't work):**
If Vercel provides an A record instead:

```
Type: A
Name: @
IPv4 address: [Paste the Vercel A record IP from Step 1]
Proxy status: DNS only (gray cloud) - OR - Proxied (orange cloud)
TTL: Auto
```

4. Click **Save** for each record

### Option B: Using Cloudflare API

If you prefer to use the API, here's how to configure the records:

**Note**: You'll need a Cloudflare API token. Get it from: https://dash.cloudflare.com/profile/api-tokens

#### Create CNAME for www:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/47da5b94667c38fe40fe90419402ac78/dns_records" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "www",
    "content": "YOUR_VERCEL_CNAME_TARGET",
    "ttl": 1,
    "proxied": false
  }'
```

#### Create CNAME for root domain:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/47da5b94667c38fe40fe90419402ac78/dns_records" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "@",
    "content": "YOUR_VERCEL_CNAME_TARGET",
    "ttl": 1,
    "proxied": false
  }'
```

Replace:

- `YOUR_API_TOKEN` with your Cloudflare API token
- `YOUR_VERCEL_CNAME_TARGET` with the actual target from Vercel

## Step 4: Verify DNS Records

1. In Cloudflare dashboard, go to **DNS** → **Records**
2. Verify both records are present:
   - `www` → CNAME → [Vercel target]
   - `@` → CNAME → [Vercel target]
3. Check that they're pointing to the correct Vercel targets

## Step 5: Verify in Vercel

1. Go to Vercel dashboard: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
2. Check status for both domains:
   - Should show **"Valid Configuration"** ✅
   - If it shows "Invalid Configuration", wait a few minutes for DNS propagation
3. SSL certificates will automatically provision once DNS is verified:
   - **kidscallhome.com**: `cert_q3B3moGlXndt60zhIBnQDAMo`
   - **www.kidscallhome.com**: `cert_DpMPL2DpBiWmiWOYprfJbjLa`
4. Certificate provisioning typically takes 1-5 minutes after DNS verification

## Step 6: Test Domains

1. Wait for DNS propagation (usually 5-15 minutes with Cloudflare)
2. Check DNS propagation: https://dnschecker.org
   - Search for `kidscallhome.com`
   - Search for `www.kidscallhome.com`
   - Should show Cloudflare nameservers globally
3. Test domains in browser:
   - `https://kidscallhome.com`
   - `https://www.kidscallhome.com`
4. Both should load your Vercel deployment

## Proxy Mode vs DNS Only

### DNS Only (Gray Cloud) - Recommended for Initial Setup

**Pros:**

- Simpler setup
- Direct connection to Vercel
- No additional configuration needed
- Works immediately

**Cons:**

- No CDN caching
- No DDoS protection from Cloudflare
- Slightly slower for global users

### Proxied (Orange Cloud) - Advanced Option

**Pros:**

- CDN caching (faster page loads)
- DDoS protection
- Can serve cached content if Vercel is down
- Better global performance
- Free on Cloudflare's free plan

**Cons:**

- Requires additional SSL configuration
- May need to configure Cloudflare to pass through correctly
- Slightly more complex setup

**To enable Proxy mode:**

1. In Cloudflare DNS records, click the gray cloud icon
2. It will turn orange (proxied)
3. Cloudflare will automatically handle SSL certificates
4. May need to adjust SSL/TLS settings in Cloudflare dashboard

## Troubleshooting

### Domain shows "Invalid Configuration" in Vercel

1. **Check DNS records are correct:**

   - Verify target matches exactly what Vercel shows
   - Check for trailing dots (should be included: `target.com.`)
   - Ensure TTL is set to Auto or a reasonable value

2. **Wait for DNS propagation:**

   - DNS changes can take 5-15 minutes with Cloudflare
   - Check propagation: https://dnschecker.org
   - Clear local DNS cache: `ipconfig /flushdns` (Windows)

3. **Verify nameservers:**
   - Ensure domain registrar (Hostinger) has Cloudflare nameservers
   - Check: https://dnschecker.org - should show Cloudflare nameservers globally

### Domain resolves but doesn't load

1. **Check SSL certificates:**

   - In Vercel dashboard, verify SSL is provisioned
   - May take a few minutes after DNS verification

2. **Check Cloudflare SSL/TLS settings:**

   - If using Proxy mode, set SSL/TLS mode to "Full" or "Full (strict)"
   - Go to Cloudflare dashboard → SSL/TLS → Overview

3. **Verify Vercel deployment:**
   - Test Vercel URL directly: `https://kids-call-home-justins-projects-f7a019bf.vercel.app`
   - If this works, issue is DNS/SSL related

### DNS propagation is slow

- Cloudflare typically propagates within 5-15 minutes
- If taking longer, check:
  - Nameservers are correctly set at registrar
  - No conflicting DNS records
  - TTL values aren't too high

## Current Configuration Checklist

- [x] Cloudflare account created
- [x] Domain added to Cloudflare
- [x] Zone ID: `47da5b94667c38fe40fe90419402ac78`
- [x] Account ID: `b1a8f1b6b9e7c3969413a8c1db5dbdc8`
- [x] Nameservers updated at Hostinger:
  - [x] `bruce.ns.cloudflare.com`
  - [x] `kay.ns.cloudflare.com`
- [ ] Wait for nameserver propagation (check with https://dnschecker.org)
- [ ] Get DNS targets from Vercel dashboard
- [ ] Configure `www` CNAME record in Cloudflare
- [ ] Configure `@` CNAME record in Cloudflare
- [ ] Verify records in Cloudflare dashboard
- [ ] Verify "Valid Configuration" in Vercel dashboard
- [ ] Test `kidscallhome.com` loads correctly
- [ ] Test `www.kidscallhome.com` loads correctly
- [ ] Monitor for 24-48 hours to ensure stability

## Next Steps After Configuration

1. **Monitor DNS propagation** (24-48 hours)
2. **Test from multiple locations** using https://dnschecker.org
3. **Verify SSL certificates** are provisioned in Vercel
4. **Consider enabling Cloudflare Proxy** for better performance (optional)
5. **Set up Cloudflare Analytics** to monitor traffic (optional)

## Related Documentation

- [DNS Setup Guide](./DNS_SETUP.md) - General DNS setup
- [DNS Failover Solutions](./DNS_FAILOVER_SOLUTIONS.md) - Why Cloudflare is better
- [Domain Troubleshooting](../troubleshooting/DOMAIN_NOT_REACHABLE.md) - Common issues
- [Cloudflare API Documentation](https://developers.cloudflare.com/api/)

## Support Resources

- **Cloudflare Dashboard**: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
- **Vercel Dashboard**: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
- **DNS Checker**: https://dnschecker.org
- **Cloudflare Status**: https://www.cloudflarestatus.com

# Cloudflare Setup - Next Steps

## ✅ Completed

- [x] Cloudflare account created
- [x] Domain added to Cloudflare
- [x] Nameservers updated at Hostinger:
  - `bruce.ns.cloudflare.com`
  - `kay.ns.cloudflare.com`
- [x] **Nameserver propagation verified** ✅
  - `bruce.ns.cloudflare.com` (TTL: 21600)
  - `kay.ns.cloudflare.com` (TTL: 21600)

## ✅ Current Status: Nameservers Active - Ready for DNS Configuration

Your nameservers are now active and propagating globally. You can now proceed to configure DNS records in Cloudflare.

## 📋 Next Steps (Do After Nameservers Propagate)

### Step 1: Get DNS Targets from Vercel

1. Go to Vercel dashboard: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
2. Add both domains if not already added:
   - `kidscallhome.com`
   - `www.kidscallhome.com`
3. For each domain, Vercel will show you the DNS configuration needed
4. **Copy the exact target values** - they will look something like:
   - `2f47c9cb96396e48.vercel-dns-017.com.` (example - use your actual value)

### Step 2: Configure DNS Records in Cloudflare

1. Go to Cloudflare dashboard: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
2. Navigate to **DNS** → **Records**
3. Click **Add record**

#### Add www CNAME Record:

```
Type: CNAME
Name: www
Target: [Paste Vercel CNAME target from Step 1]
Proxy status: DNS only (gray cloud) - start with this
TTL: Auto
```

#### Add Root Domain CNAME Record:

```
Type: CNAME
Name: @
Target: [Paste Vercel CNAME target from Step 1]
Proxy status: DNS only (gray cloud) - start with this
TTL: Auto
```

4. Click **Save** for each record

### Step 3: Verify in Vercel

1. Go back to Vercel dashboard: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
2. Check status for both domains
3. Should show **"Valid Configuration"** ✅ (may take a few minutes after DNS records are added)
4. SSL certificates will automatically provision:
   - `kidscallhome.com`: `cert_q3B3moGlXndt60zhIBnQDAMo`
   - `www.kidscallhome.com`: `cert_DpMPL2DpBiWmiWOYprfJbjLa`
5. Certificate provisioning typically takes 1-5 minutes after DNS verification

### Step 4: Test Domains

1. Wait 5-15 minutes for DNS propagation
2. Test in browser:
   - `https://kidscallhome.com`
   - `https://www.kidscallhome.com`
3. Both should load your Vercel deployment

## 🎯 Quick Reference

- **Cloudflare Dashboard**: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
- **Vercel Dashboard**: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
- **DNS Checker**: https://dnschecker.org
- **Zone ID**: `47da5b94667c38fe40fe90419402ac78`
- **Account ID**: `b1a8f1b6b9e7c3969413a8c1db5dbdc8`
- **Vercel SSL Certificates**:
  - `kidscallhome.com`: `cert_q3B3moGlXndt60zhIBnQDAMo`
  - `www.kidscallhome.com`: `cert_DpMPL2DpBiWmiWOYprfJbjLa`

## 📚 Full Documentation

For detailed instructions, see: [Cloudflare DNS Configuration Guide](./CLOUDFLARE_DNS_CONFIG.md)

## ⚠️ Important Notes

1. **Start with DNS only (gray cloud)**: Don't enable proxy mode (orange cloud) initially. Get it working first, then you can enable proxy for better performance later.

2. **Wait for propagation**: DNS changes take time. Be patient - usually 15-30 minutes with Cloudflare.

3. **Get exact targets from Vercel**: The DNS targets are project-specific. Don't use example values - get them from your Vercel dashboard.

4. **Trailing dots matter**: If Vercel shows a target like `target.com.` (with trailing dot), include it.

## 🆘 Troubleshooting

If domains don't work after setup:

1. **Check nameserver propagation**: https://dnschecker.org - should show Cloudflare nameservers globally
2. **Verify DNS records**: In Cloudflare dashboard, ensure records match Vercel's requirements exactly
3. **Check Vercel status**: Should show "Valid Configuration" for both domains
4. **Wait longer**: DNS can take up to 48 hours in some locations (though usually much faster)
5. **Clear DNS cache**: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)

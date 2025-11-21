# Cloudflare DNS - Setup Complete ✅

> **Status**: Setup completed and verified. See [Complete Setup Documentation](./CLOUDFLARE_SETUP_COMPLETE.md) for final configuration details.

---

# Cloudflare DNS - Ready to Configure (Historical)

## ✅ Setup Complete

- [x] Cloudflare account created
- [x] Domain added to Cloudflare
- [x] Nameservers configured and verified:
  - `bruce.ns.cloudflare.com` ✅
  - `kay.ns.cloudflare.com` ✅
- [x] Nameserver propagation confirmed

## 🎯 Next Step: Configure DNS Records

Your domain is now using Cloudflare's nameservers. You need to configure DNS records to point to Vercel.

### Step 1: Get DNS Targets from Vercel

**Important**: Vercel may show a message like "Update the nameservers in your DNS provider to manage your DNS records on Vercel." **Ignore this message** - you're using Cloudflare for DNS, so you'll configure CNAME records in Cloudflare instead.

1. Go to Vercel dashboard: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
2. Add both domains if not already added:
   - `kidscallhome.com`
   - `www.kidscallhome.com`
3. When Vercel shows configuration options:
   - **Option 1: "Use Vercel Nameservers"** - ❌ Ignore this (you're using Cloudflare)
   - **Option 2: "Configure DNS Records" or "Add DNS Records"** - ✅ Click this
4. Look for the DNS records section that shows CNAME configuration
5. **Copy the CNAME target value** - it will look something like:
   - `2f47c9cb96396e48.vercel-dns-017.com.` (example - use your actual value)
   - This is what you'll use in Cloudflare DNS records

**If you only see nameserver options:**

- Add the domain anyway (Vercel will still work)
- Look for a "DNS Records" tab or "Configuration" section
- Click on the domain name to see detailed configuration
- The CNAME target may be shown in the domain details page

**Important**:

- You're using Cloudflare nameservers (already configured ✅)
- You need CNAME records in Cloudflare pointing to Vercel's DNS targets
- You do NOT need to change nameservers to Vercel's nameservers
- Ignore Vercel's nameserver instructions

### Step 2: Add DNS Records in Cloudflare

1. Go to Cloudflare dashboard: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
2. Navigate to **DNS** → **Records**
3. Click **Add record**

#### Record 1: www subdomain

```
Type: CNAME
Name: www
Target: [Paste the Vercel CNAME target from Step 1]
Proxy status: DNS only (gray cloud icon) - start with this
TTL: Auto
```

Click **Save**

#### Record 2: Root domain

```
Type: CNAME
Name: @
Target: [Paste the Vercel CNAME target from Step 1]
Proxy status: DNS only (gray cloud icon) - start with this
TTL: Auto
```

Click **Save**

**Note**: Cloudflare supports CNAME flattening for root domains, so you can use CNAME instead of A records.

### Step 3: Verify in Vercel

1. Go back to Vercel dashboard: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
2. Wait 1-2 minutes for DNS propagation
3. Check status for both domains:
   - Should show **"Valid Configuration"** ✅
   - If it shows "Invalid Configuration", wait a few more minutes
4. SSL certificates will automatically provision:
   - `kidscallhome.com`: `cert_q3B3moGlXndt60zhIBnQDAMo`
   - `www.kidscallhome.com`: `cert_DpMPL2DpBiWmiWOYprfJbjLa`

### Step 4: Test Your Domains

1. Wait 5-15 minutes for DNS propagation
2. Test in browser:
   - `https://kidscallhome.com`
   - `https://www.kidscallhome.com`
3. Both should load your Vercel deployment

## 📋 Quick Checklist

- [ ] Get DNS targets from Vercel dashboard
- [ ] Add `www` CNAME record in Cloudflare
- [ ] Add `@` CNAME record in Cloudflare
- [ ] Verify "Valid Configuration" in Vercel
- [ ] Test domains in browser
- [ ] Confirm SSL certificates are active

## 🎯 Quick Links

- **Cloudflare Dashboard**: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
- **Vercel Dashboard**: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
- **DNS Checker**: https://dnschecker.org

## ⚠️ Important Notes

1. **Start with DNS only (gray cloud)**: Don't enable proxy mode (orange cloud) initially. Get it working first, then you can enable proxy for better performance later.

2. **Use exact targets from Vercel**: The DNS targets are project-specific. Don't use example values - get them from your Vercel dashboard.

3. **Trailing dots matter**: If Vercel shows a target like `target.com.` (with trailing dot), include it.

4. **Wait for propagation**: DNS changes typically take 5-15 minutes with Cloudflare, but can take up to 48 hours in some locations.

## 🆘 Troubleshooting

### If Vercel shows "Invalid Configuration"

1. **Double-check DNS records**: Ensure they match exactly what Vercel shows
2. **Check for typos**: Verify the target value is correct
3. **Wait longer**: DNS propagation can take a few minutes
4. **Verify nameservers**: Ensure Cloudflare nameservers are still active

### If domains don't load after configuration

1. **Check DNS propagation**: https://dnschecker.org - search for `kidscallhome.com` and `www.kidscallhome.com`
2. **Verify SSL certificates**: Check Vercel dashboard that certificates are provisioned
3. **Clear DNS cache**: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
4. **Try different browser/device**: Sometimes local DNS cache can cause issues

## 📚 Full Documentation

For detailed instructions, see: [Cloudflare DNS Configuration Guide](./CLOUDFLARE_DNS_CONFIG.md)

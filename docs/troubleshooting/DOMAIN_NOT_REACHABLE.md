# Domain Not Reachable - Troubleshooting Guide

## Issue

After deployment, custom domains (`kidscallhome.com` and `www.kidscallhome.com`) are not reachable, even though the deployment shows as "Ready" in Vercel.

## ⚠️ DNS Provider Outage (Most Common)

**If your DNS provider (e.g., Hostinger, GoDaddy, Cloudflare) is experiencing service disruptions:**

### Symptoms:

- DNS lookups timeout or fail
- Domains show as unreachable
- DNS provider status page shows outages
- Vercel deployment URL works, but custom domains don't

### What to Do:

1. **Check DNS Provider Status**:
   - Hostinger: https://status.hostinger.com
   - Check your DNS provider's status page or support channels
2. **Verify Vercel Deployment Still Works**:

   - Test: `https://kids-call-home-justins-projects-f7a019bf.vercel.app`
   - If this works, your deployment is fine - it's a DNS provider issue

3. **Wait for DNS Provider to Restore Services**:

   - Once DNS services are restored, domains should work automatically
   - No changes needed to Vercel configuration
   - DNS propagation may take additional time after service restoration

4. **Monitor DNS Provider Updates**:

   - Check their status page for restoration timeline
   - They usually provide ETA for service restoration

5. **After Service Restoration**:
   - Verify domains are reachable
   - Check Vercel dashboard to ensure domain status is "Valid Configuration"
   - SSL certificates should automatically renew if needed

**Note**: This is a temporary issue that resolves automatically once your DNS provider restores services. Your Vercel deployment and configuration are unaffected.

### Long-Term Solution: Prevent Future Outages

To prevent future DNS outages, consider moving DNS to a more reliable provider:

- **Recommended**: Move DNS to Cloudflare (free, 99.99%+ uptime)
- **See**: [DNS Failover Solutions Guide](../setup/DNS_FAILOVER_SOLUTIONS.md) for detailed setup instructions

This provides better reliability than most hosting provider DNS services.

## Quick Diagnosis Steps

### 1. Test Vercel Deployment URL First

Check if the Vercel-provided URL works:

- ✅ **Working**: `https://kids-call-home-justins-projects-f7a019bf.vercel.app`
- ❌ **Not Working**: Build/deployment issue

If the Vercel URL works but custom domains don't, it's a DNS/domain configuration issue.

### 2. Check Domain Configuration in Vercel Dashboard

1. Go to: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
2. Verify both domains are listed:
   - `kidscallhome.com`
   - `www.kidscallhome.com`
3. Check status:
   - ✅ **Valid Configuration**: DNS is correct
   - ⚠️ **Invalid Configuration**: DNS needs to be updated
   - ⏳ **Pending**: DNS propagation or SSL provisioning in progress

### 3. Verify DNS Records

Check current DNS records using:

- `nslookup kidscallhome.com`
- `nslookup www.kidscallhome.com`
- Online tools: https://dnschecker.org or https://whatsmydns.net

**Expected DNS Configuration:**

#### For `www.kidscallhome.com`:

```
Type: CNAME
Name: www
Value: 2f47c9cb96396e48.vercel-dns-017.com. (or current Vercel target)
TTL: 300 or Auto
```

#### For `kidscallhome.com` (root domain):

**Option 1** (if DNS provider supports ALIAS/ANAME):

```
Type: ALIAS or ANAME
Name: @
Value: 2f47c9cb96396e48.vercel-dns-017.com.
TTL: 300 or Auto
```

**Option 2** (if only A records supported):

```
Type: A
Name: @
Value: 216.198.79.1 (or current Vercel IP)
TTL: 300 or Auto
```

**⚠️ IMPORTANT**: Get the exact DNS targets from Vercel dashboard (Settings → Domains). The values shown above may be outdated.

### 4. Common Issues and Solutions

#### Issue: DNS Still Points to Old Hosting

**Symptom**: DNS records show `hstgr.net` or other old hosting provider
**Solution**:

1. Update DNS records to point to Vercel (see step 3)
2. Wait for DNS propagation (15 minutes to 48 hours, typically 30 minutes)
3. Verify in Vercel dashboard that status changes to "Valid Configuration"

#### Issue: Domains Not Added in Vercel

**Symptom**: Domains don't appear in Vercel dashboard
**Solution**:

1. Go to Vercel project → Settings → Domains
2. Click "Add Domain"
3. Add `kidscallhome.com` and `www.kidscallhome.com`
4. Follow DNS configuration instructions shown by Vercel

#### Issue: SSL Certificate Not Provisioned

**Symptom**: Domain shows "Pending" in Vercel
**Solution**:

1. Ensure DNS records are correctly configured
2. Wait for DNS propagation
3. Vercel will automatically provision SSL certificates once DNS is verified
4. This can take up to 24 hours, but usually completes within 1-2 hours

#### Issue: DNS Propagation Delay

**Symptom**: DNS records updated but still not working
**Solution**:

1. Check DNS propagation: https://dnschecker.org
2. Clear local DNS cache:
   - Windows: `ipconfig /flushdns`
   - Mac: `sudo dscacheutil -flushcache`
   - Linux: `sudo systemd-resolve --flush-caches`
3. Wait for TTL to expire (check TTL value in DNS records)

#### Issue: Redirect Loop or Configuration Error

**Symptom**: Domain loads but shows errors or redirects incorrectly
**Solution**: Check `vercel.json` configuration:

- Ensure redirects are correctly configured
- Verify rewrite rules for SPA routing
- Check that both domains are handled properly

### 5. Verify Current Configuration

Run these commands to check DNS:

```bash
# Check root domain
nslookup kidscallhome.com

# Check www subdomain
nslookup www.kidscallhome.com

# Check with different DNS servers
nslookup kidscallhome.com 8.8.8.8  # Google DNS
nslookup kidscallhome.com 1.1.1.1  # Cloudflare DNS
```

### 6. Check Vercel Deployment Status

1. Go to deployment: https://vercel.com/justins-projects-f7a019bf/kids-call-home
2. Check latest deployment status
3. Review build logs for any errors
4. Verify deployment is assigned to production

### 7. Test from Different Locations

Use online tools to test from different locations:

- https://downforeveryoneorjustme.com/kidscallhome.com
- https://www.isitdownrightnow.com/kidscallhome.com

## Immediate Action Items

1. ✅ **Verify Vercel deployment URL works**: `https://kids-call-home-justins-projects-f7a019bf.vercel.app`
2. ✅ **Check Vercel dashboard**: Settings → Domains → Verify both domains are added
3. ✅ **Check DNS records**: Ensure they point to Vercel (not old hosting)
4. ✅ **Wait for propagation**: DNS changes can take 15 minutes to 48 hours
5. ✅ **Verify SSL**: Check that SSL certificates are provisioned in Vercel

## If Still Not Working

1. **Check DNS Provider Status**: First verify if your DNS provider is experiencing outages
2. **Contact DNS Provider**: If no outage, verify DNS records are correctly saved
3. **Check Vercel Support**: Review Vercel status page for any outages (https://vercel-status.com)
4. **Review Build Logs**: Check for any deployment errors
5. **Contact Vercel Support**: If all else fails, contact Vercel support with:
   - Project name: `kids-call-home`
   - Team: `justins-projects-f7a019bf`
   - Deployment URL that works
   - Custom domains that don't work
   - DNS configuration details
   - DNS provider status (if known)

## Related Documentation

- [DNS Setup Guide](../setup/DNS_SETUP.md)
- [DNS Failover Solutions](../setup/DNS_FAILOVER_SOLUTIONS.md) - Prevent future outages
- [Vercel Domain Troubleshooting](https://vercel.com/docs/domains/troubleshooting)

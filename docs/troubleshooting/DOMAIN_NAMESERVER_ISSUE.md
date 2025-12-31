# Domain Nameserver Issue - Cloudflare Detection

**Status**: ⚠️ **URGENT - Domain Not Using Cloudflare Nameservers**  
**Date**: Current  
**Issue**: Cloudflare detected domain is using DNS parking nameservers instead of Cloudflare

---

## Problem

Cloudflare has detected that `kidscallhome.com` is no longer using Cloudflare nameservers:

**Current Nameservers (Detected by Cloudflare)**:
- `ns1.dns-parking.com`
- `ns2.dns-parking.com`
- `[not set]` (3 additional empty slots)

**Expected Nameservers**:
- `bruce.ns.cloudflare.com`
- `kay.ns.cloudflare.com`

**Impact**:
- Domain will be automatically deleted from Cloudflare after 7 days (if no paid subscription)
- DNS records in Cloudflare are no longer active
- Website may be unreachable or showing parking pages
- SSL certificates may fail

---

## Root Causes

This typically happens when:

1. **Domain Registration Expired** (Most Common)
   - Domain registration expired at Hostinger
   - Registrar automatically points to parking nameservers
   - Domain may be in redemption period

2. **Nameservers Changed at Registrar**
   - Someone manually changed nameservers at Hostinger
   - Nameservers were reset to default/parking

3. **Domain Transfer**
   - Domain was transferred to another registrar
   - Nameservers reset during transfer

4. **Account/Billing Issue**
   - Hostinger account issue
   - Payment failure
   - Account suspended

---

## Immediate Actions Required

### Step 1: Check Domain Status at Hostinger

1. **Log into Hostinger Account**
   - Go to: https://hpanel.hostinger.com
   - Navigate to **Domains** → **kidscallhome.com**

2. **Check Domain Status**
   - ✅ **Active**: Domain is registered and active
   - ⚠️ **Expired**: Domain registration expired
   - ⚠️ **Redemption Period**: Domain expired but can be renewed
   - ❌ **Pending Delete**: Domain will be deleted soon

3. **Check Expiration Date**
   - Verify when domain expires
   - If expired, renew immediately

### Step 2: Restore Cloudflare Nameservers

**If domain is active at Hostinger:**

1. **In Hostinger Dashboard**:
   - Go to **Domains** → **kidscallhome.com** → **DNS / Nameservers**
   - Select **"Use custom nameservers"** (not "Use Hostinger nameservers")
   - Enter the following nameservers:
     ```
     bruce.ns.cloudflare.com
     kay.ns.cloudflare.com
     ```
   - Save changes

2. **Wait for Propagation** (15-30 minutes):
   - Check propagation: https://dnschecker.org
   - Search for: `kidscallhome.com` → **NS** record type
   - Verify all locations show Cloudflare nameservers

3. **Verify in Cloudflare**:
   - Log into Cloudflare: https://dash.cloudflare.com
   - Go to domain: `kidscallhome.com`
   - Check status - should show "Active" instead of "Moved"

### Step 3: If Domain Expired

**If domain is expired or in redemption period:**

1. **Renew Domain Immediately**:
   - Log into Hostinger
   - Go to **Domains** → **kidscallhome.com**
   - Click **"Renew Domain"**
   - Complete payment

2. **After Renewal**:
   - Wait 5-10 minutes for renewal to process
   - Follow Step 2 above to restore Cloudflare nameservers

3. **If in Redemption Period**:
   - Domain can still be renewed (usually 30-45 days after expiration)
   - Cost may be higher (redemption fee)
   - Renew immediately to avoid permanent loss

---

## Verification Steps

### 1. Check Nameserver Propagation

```bash
# Using nslookup (Windows/Mac/Linux)
nslookup -type=NS kidscallhome.com

# Expected output:
# kidscallhome.com nameserver = bruce.ns.cloudflare.com
# kidscallhome.com nameserver = kay.ns.cloudflare.com
```

**Online Tools**:
- https://dnschecker.org (check NS records globally)
- https://whatsmydns.net (check NS records)

### 2. Verify Cloudflare Status

1. Log into Cloudflare: https://dash.cloudflare.com
2. Navigate to: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
3. Check domain status:
   - ✅ **Active**: Nameservers are correct
   - ⚠️ **Moved**: Still using wrong nameservers (wait for propagation)
   - ❌ **Deleted**: Domain removed from Cloudflare (need to re-add)

### 3. Test Website Accessibility

```bash
# Test root domain
curl -I https://kidscallhome.com

# Test www subdomain
curl -I https://www.kidscallhome.com

# Both should return 200 OK or 301/302 redirect
```

---

## Cloudflare Account Information

**Cloudflare Zone Details**:
- **Zone ID**: `47da5b94667c38fe40fe90419402ac78`
- **Account ID**: `b1a8f1b6b9e7c3969413a8c1db5dbdc8`
- **Dashboard**: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com

**Expected DNS Records** (after nameservers are restored):
- `@` (root) → CNAME → `2f47c9cb96396e48.vercel-dns-017.com` (Proxied)
- `www` → CNAME → `2f47c9cb96396e48.vercel-dns-017.com` (Proxied)

---

## If Domain Was Deleted from Cloudflare

If Cloudflare automatically deleted the domain after 7 days:

1. **Re-add Domain to Cloudflare**:
   - Log into Cloudflare
   - Click **"Add a Site"**
   - Enter: `kidscallhome.com`
   - Select plan (Free plan is fine)
   - Cloudflare will scan existing DNS records

2. **Update Nameservers at Hostinger**:
   - Cloudflare will provide new nameservers (may be same: `bruce.ns.cloudflare.com`, `kay.ns.cloudflare.com`)
   - Update nameservers at Hostinger (see Step 2 above)

3. **Reconfigure DNS Records**:
   - Add CNAME records pointing to Vercel:
     - `@` → `2f47c9cb96396e48.vercel-dns-017.com` (Proxied)
     - `www` → `2f47c9cb96396e48.vercel-dns-017.com` (Proxied)

4. **Verify Vercel Configuration**:
   - Check Vercel dashboard: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
   - Ensure both domains are still added
   - SSL certificates should auto-provision once DNS is correct

---

## Prevention

To prevent this from happening again:

1. **Enable Auto-Renewal**:
   - In Hostinger, enable auto-renewal for `kidscallhome.com`
   - Add payment method if not already added
   - Set renewal reminder (30 days before expiration)

2. **Monitor Domain Expiration**:
   - Set calendar reminder 60 days before expiration
   - Check domain status monthly

3. **Lock Domain**:
   - Enable domain lock at Hostinger (prevents unauthorized transfers)
   - Enable 2FA on Hostinger account

4. **Backup DNS Configuration**:
   - Document all DNS records
   - Keep Cloudflare Zone ID and Account ID in secure location
   - See: `docs/setup/DNS_QUICK_REFERENCE.md`

---

## Timeline

**Immediate (Today)**:
- [ ] Check domain status at Hostinger
- [ ] Renew domain if expired
- [ ] Restore Cloudflare nameservers at Hostinger
- [ ] Verify nameserver propagation

**Within 24 Hours**:
- [ ] Verify Cloudflare shows domain as "Active"
- [ ] Test website accessibility
- [ ] Verify SSL certificates are working
- [ ] Enable auto-renewal at Hostinger

**Within 7 Days**:
- [ ] Monitor domain status
- [ ] Verify all DNS records are correct
- [ ] Test website from multiple locations
- [ ] Document resolution steps

---

## Related Documentation

- [DNS Quick Reference](../setup/DNS_QUICK_REFERENCE.md)
- [Cloudflare DNS Configuration](../setup/CLOUDFLARE_DNS_CONFIG.md)
- [Domain Not Reachable](./DOMAIN_NOT_REACHABLE.md)
- [Root Domain Loading Issue](./ROOT_DOMAIN_LOADING_ISSUE.md)

---

## Support Contacts

**Hostinger Support**:
- Dashboard: https://hpanel.hostinger.com
- Support: https://www.hostinger.com/contact
- Phone: Check Hostinger support page

**Cloudflare Support**:
- Dashboard: https://dash.cloudflare.com
- Community: https://community.cloudflare.com
- Support: Available in dashboard (if on paid plan)

**Vercel Support**:
- Dashboard: https://vercel.com/justins-projects-f7a019bf/kids-call-home
- Support: Available in dashboard

---

**Last Updated**: Current  
**Status**: ⚠️ Action Required





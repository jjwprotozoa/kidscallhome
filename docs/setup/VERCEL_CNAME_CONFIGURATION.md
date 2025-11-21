# Configuring CNAME Records for Vercel (Using Cloudflare DNS)

## Understanding Vercel's Message

When you add a domain in Vercel, you may see:

> "Update the nameservers in your DNS provider to manage your DNS records on Vercel."

**This message is for people who want to use Vercel's nameservers.** Since you're using Cloudflare for DNS management, you can ignore this message and use CNAME records instead.

## Two Ways to Connect Vercel

Vercel supports two methods:

### Method 1: Use Vercel Nameservers ❌ (Not for you)
- Change nameservers to: `ns1.vercel-dns.com`, `ns2.vercel-dns.com`
- Vercel manages all DNS records
- **You're NOT using this method**

### Method 2: Use CNAME Records ✅ (What you need)
- Keep your current nameservers (Cloudflare)
- Add CNAME records pointing to Vercel
- **This is what you're doing**

## How to Find CNAME Targets in Vercel

1. Go to Vercel dashboard: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains

2. Add your domain if not already added:
   - Click "Add Domain"
   - Enter `kidscallhome.com` or `www.kidscallhome.com`

3. Vercel will show configuration options:
   - **Option 1**: "Use Vercel Nameservers" - Ignore this
   - **Option 2**: "Configure DNS Records" or "Add DNS Records" - Click this

4. Look for the DNS records section that shows:
   ```
   Type: CNAME
   Name: www (or @ for root domain)
   Value: 2f47c9cb96396e48.vercel-dns-017.com.
   ```

5. **Copy the Value/Target** - this is what you'll use in Cloudflare

## If Vercel Only Shows Nameserver Option

If Vercel only shows nameserver configuration:

1. **Add the domain anyway** - Vercel will still provision SSL certificates
2. **Look for "DNS Records" tab** or "Configuration" section
3. **Check the domain details page** - it may show CNAME targets there
4. **Alternative**: Vercel may provide the DNS target in the domain status/details

## What You Need from Vercel

For each domain (`kidscallhome.com` and `www.kidscallhome.com`), you need:

- **CNAME Target**: Something like `2f47c9cb96396e48.vercel-dns-017.com.`
- **Note**: The trailing dot (`.`) is important - include it

## What to Configure in Cloudflare

Once you have the CNAME targets from Vercel:

1. Go to Cloudflare: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
2. Navigate to **DNS** → **Records**
3. Add CNAME records:

**For www subdomain:**
```
Type: CNAME
Name: www
Target: [Paste CNAME target from Vercel]
Proxy: DNS only (gray cloud)
TTL: Auto
```

**For root domain:**
```
Type: CNAME
Name: @
Target: [Paste CNAME target from Vercel]
Proxy: DNS only (gray cloud)
TTL: Auto
```

## Verification

After adding DNS records in Cloudflare:

1. Wait 5-15 minutes for DNS propagation
2. Go back to Vercel dashboard
3. Check domain status - should show "Valid Configuration" ✅
4. SSL certificates will automatically provision

## Troubleshooting

### Vercel shows "Invalid Configuration"

1. **Check DNS records in Cloudflare**: Ensure they match exactly what Vercel shows
2. **Verify target value**: Make sure you copied the complete CNAME target (including trailing dot if present)
3. **Wait for propagation**: DNS changes can take 5-15 minutes
4. **Check TTL**: Set TTL to Auto in Cloudflare

### Can't find CNAME targets in Vercel

1. **Try adding domain again**: Sometimes Vercel shows different options on retry
2. **Check domain details page**: Click on the domain name to see detailed configuration
3. **Look for "DNS" or "Configuration" tab**: CNAME targets may be in a separate section
4. **Contact Vercel support**: If you can't find the CNAME targets, Vercel support can provide them

## Summary

- ✅ Keep Cloudflare nameservers (already configured)
- ✅ Add CNAME records in Cloudflare pointing to Vercel
- ❌ Ignore Vercel's nameserver instructions
- ✅ Look for "Configure DNS Records" option in Vercel
- ✅ Copy CNAME target values from Vercel
- ✅ Add those values as CNAME records in Cloudflare

## Related Documentation

- [Cloudflare DNS Configuration](./CLOUDFLARE_DNS_CONFIG.md) - Complete setup guide
- [Cloudflare vs Vercel Nameservers](./CLOUDFLARE_VS_VERCEL_NAMESERVERS.md) - Understanding the difference



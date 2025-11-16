# DNS Configuration for Vercel Deployment

## Required DNS Records

Based on Vercel's requirements, you need to update the following DNS records:

### 1. www subdomain (www.kidscallhome.com)

**Current:**

```
Type: CNAME
Name: www
Value: www.kidscallhome.com.cdn.hstgr.net
TTL: 300
```

**Update to:**

```
Type: CNAME
Name: www
Value: 2f47c9cb96396e48.vercel-dns-017.com.
TTL: 300 (or Auto)
```

### 2. Root domain (@ - kidscallhome.com)

**Current:**

```
Type: ALIAS
Name: @
Value: kidscallhome.com.cdn.hstgr.net
TTL: 300
```

**Update to (Option 1 - If your DNS provider supports ALIAS/ANAME):**

```
Type: ALIAS (or ANAME)
Name: @
Value: 2f47c9cb96396e48.vercel-dns-017.com.
TTL: 300 (or Auto)
```

**Update to (Option 2 - If ALIAS is not supported, use A record):**

```
Type: A
Name: @
Value: 216.198.79.1
TTL: 300 (or Auto)
```

**Note:** Vercel recommends using ALIAS/ANAME for the root domain if your DNS provider supports it, as it's more flexible. If not, use the A record.

## Steps to Update DNS

1. **Log into your DNS provider** (wherever you manage kidscallhome.com)

2. **Update the www CNAME record:**

   - Find the existing `www` CNAME record
   - Change the value from `www.kidscallhome.com.cdn.hstgr.net` to `2f47c9cb96396e48.vercel-dns-017.com.`
   - Save the changes

3. **Update the root domain (@) record:**

   - Find the existing `@` ALIAS record
   - If your provider supports ALIAS/ANAME:
     - Change the value to `2f47c9cb96396e48.vercel-dns-017.com.`
   - If your provider only supports A records:
     - Delete the ALIAS record
     - Create a new A record with value `216.198.79.1`
   - Save the changes

4. **Keep other records:**
   - Keep all CAA records (they're for SSL certificate validation)
   - Keep the `ftp` A record if you still need FTP access
   - Remove any other records pointing to hstgr.net if they're no longer needed

## DNS Propagation

After updating DNS records:

- **TTL (Time To Live)**: The TTL determines how long DNS changes take to propagate
- **Propagation time**: Usually 5 minutes to 48 hours, but typically 15-30 minutes
- **Check propagation**: Use tools like `whatsmydns.net` or `dnschecker.org` to verify

## Verify in Vercel (Do This FIRST!)

**Important**: Add your domains in Vercel BEFORE updating DNS. This ensures you get the correct DNS targets.

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Domains**
3. Click **Add Domain** and add:
   - `kidscallhome.com` (root domain)
   - `www.kidscallhome.com` (www subdomain)
4. Vercel will show you the **exact DNS configuration** needed (may differ slightly from examples above)
5. Use the DNS targets shown in Vercel's dashboard (they're project-specific and stable)
6. Update your DNS records using the values Vercel provides
7. Vercel will verify the DNS records are correctly configured
8. Once verified, Vercel will automatically provision SSL certificates

## Important Notes

- **Project-level, not deployment-specific**: The DNS target `2f47c9cb96396e48.vercel-dns-017.com.` is tied to your **Vercel project**, not individual deployments. Once configured, it will work for ALL deployments (production, preview, etc.) of this project. You do NOT need to update DNS for each deployment.

- **Stable configuration**: This DNS target is stable and won't change unless you:

  - Delete and recreate the project
  - Transfer the project to a different team
  - Manually change domain settings in Vercel

- **Best practice**: Before updating DNS, first add your domain in Vercel (Settings → Domains). Vercel will show you the exact DNS configuration needed, which may be slightly different from what's shown here.

- **Keep the trailing dot**: The `.` at the end of `2f47c9cb96396e48.vercel-dns-017.com.` is important

- **Both domains**: Make sure both `kidscallhome.com` and `www.kidscallhome.com` are added in Vercel

- **SSL Certificates**: Vercel will automatically provision SSL certificates once DNS is verified

- **Redirects**: Vercel can automatically redirect `kidscallhome.com` → `www.kidscallhome.com` if you prefer

## Troubleshooting

If DNS doesn't propagate:

1. Clear your DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
2. Wait for the TTL period to expire
3. Check DNS propagation using online tools
4. Verify records in Vercel dashboard show as "Valid Configuration"

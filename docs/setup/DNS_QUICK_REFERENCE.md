# DNS Quick Reference

**Status**: ✅ Production-ready  
**Last Verified**: Setup completed

---

## Current Configuration

### DNS Flow
```
kidscallhome.com
    ↓
Cloudflare Nameservers (bruce.ns.cloudflare.com, kay.ns.cloudflare.com)
    ↓
Cloudflare DNS Records (CNAME → Vercel)
    ↓
Vercel Deployment
```

### Cloudflare DNS Records

| Type | Name | Target | Proxy | Status |
|------|------|--------|-------|--------|
| CNAME | @ | `2f47c9cb96396e48.vercel-dns-017.com` | Proxied ✅ | Active |
| CNAME | www | `2f47c9cb96396e48.vercel-dns-017.com` | Proxied ✅ | Active |

### Quick Links

- **Cloudflare Dashboard**: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com
- **Vercel Dashboard**: https://vercel.com/justins-projects-f7a019bf/kids-call-home/settings/domains
- **DNS Checker**: https://dnschecker.org

### Account IDs

- **Cloudflare Zone ID**: `47da5b94667c38fe40fe90419402ac78`
- **Cloudflare Account ID**: `b1a8f1b6b9e7c3969413a8c1db5dbdc8`
- **Vercel CNAME Target**: `2f47c9cb96396e48.vercel-dns-017.com`

---

## Common Tasks

### Add New Subdomain
1. Add in Vercel dashboard
2. Get CNAME target
3. Add CNAME in Cloudflare: `[subdomain]` → `2f47c9cb96396e48.vercel-dns-017.com`

### Disable Proxy (Temporary)
1. Cloudflare → DNS → Records
2. Click orange cloud → turns gray
3. Wait 1-2 minutes

### Clear DNS Cache
- Windows: `ipconfig /flushdns`
- Mac: `sudo dscacheutil -flushcache`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Domain not loading | Clear DNS cache, check dnschecker.org |
| Vercel shows warning | Ignore - expected when using Cloudflare DNS |
| SSL issues | Check Vercel dashboard, wait 5-10 min |
| Slow loading | Toggle proxy off/on, check Cloudflare cache |

---

**Full Documentation**: [Complete Setup Guide](./CLOUDFLARE_SETUP_COMPLETE.md)





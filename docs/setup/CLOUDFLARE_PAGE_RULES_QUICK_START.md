# Cloudflare Page Rules - Quick Start

## Quick Reference

### Get API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit zone DNS" template or create custom token with:
   - `Zone:Zone:Read`
   - `Zone:Page Rules:Edit`
4. Copy the token

### Set Environment Variable

**Windows (PowerShell):**
```powershell
$env:CLOUDFLARE_API_TOKEN = "your-token-here"
```

**Linux/macOS:**
```bash
export CLOUDFLARE_API_TOKEN="your-token-here"
```

## Using the Scripts

### PowerShell (Windows)

**List all page rules:**
```powershell
.\scripts\cloudflare-page-rules.ps1 -Action list
```

**Create root domain redirect:**
```powershell
.\scripts\cloudflare-page-rules.ps1 -Action create
```

**Get specific page rule:**
```powershell
.\scripts\cloudflare-page-rules.ps1 -Action get -PageRuleId "page-rule-id"
```

**Delete page rule:**
```powershell
.\scripts\cloudflare-page-rules.ps1 -Action delete -PageRuleId "page-rule-id"
```

### Bash (Linux/macOS)

**List all page rules:**
```bash
./scripts/cloudflare-page-rules.sh list
```

**Create root domain redirect:**
```bash
./scripts/cloudflare-page-rules.sh create
```

**Get specific page rule:**
```bash
./scripts/cloudflare-page-rules.sh get "page-rule-id"
```

**Delete page rule:**
```bash
./scripts/cloudflare-page-rules.sh delete "page-rule-id"
```

## Direct API Calls

### List Page Rules

```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/47da5b94667c38fe40fe90419402ac78/pagerules" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"
```

### Get Specific Page Rule

```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/47da5b94667c38fe40fe90419402ac78/pagerules/{identifier}" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"
```

### Create Root Domain Redirect

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/47da5b94667c38fe40fe90419402ac78/pagerules" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "targets": [
      {
        "target": "url",
        "constraint": {
          "operator": "matches",
          "value": "http://kidscallhome.com/*"
        }
      },
      {
        "target": "url",
        "constraint": {
          "operator": "matches",
          "value": "https://kidscallhome.com/*"
        }
      }
    ],
    "actions": [
      {
        "id": "forwarding_url",
        "value": {
          "url": "https://www.kidscallhome.com/$1",
          "status_code": 301
        }
      }
    ],
    "priority": 1,
    "status": "active"
  }'
```

## Configuration

- **Zone ID**: `47da5b94667c38fe40fe90419402ac78`
- **Domain**: `kidscallhome.com`
- **Dashboard**: https://dash.cloudflare.com/b1a8f1b6b9e7c3969413a8c1db5dbdc8/kidscallhome.com

## Testing

After creating a page rule:

1. Wait 1-2 minutes for activation
2. Test redirect:
   ```bash
   curl -I http://kidscallhome.com
   # Should show: HTTP/1.1 301 Moved Permanently
   # Location: https://www.kidscallhome.com/
   ```
3. Test in browser (incognito mode):
   - `http://kidscallhome.com` → Should redirect to `https://www.kidscallhome.com`
   - `https://kidscallhome.com` → Should redirect to `https://www.kidscallhome.com`

## Free Plan Limitations

- **3 page rules maximum** on Cloudflare free plan
- If you hit the limit, delete unused rules or upgrade

## Related Documentation

- [Full API Guide](./CLOUDFLARE_PAGE_RULES_API.md)
- [Root Domain Loading Issue](../troubleshooting/ROOT_DOMAIN_LOADING_ISSUE.md)
- [Quick Fix Guide](../troubleshooting/QUICK_FIX_ROOT_DOMAIN.md)


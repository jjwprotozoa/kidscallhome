# Cloudflare Page Rules API Guide

## Overview

This guide shows how to manage Cloudflare Page Rules via the API to handle the root domain redirect (`kidscallhome.com` → `www.kidscallhome.com`).

## Prerequisites

1. **Cloudflare API Token**: Get from https://dash.cloudflare.com/profile/api-tokens
   - Required permissions: `Zone:Zone:Read`, `Zone:Page Rules:Edit`
   - Or use Global API Key (less secure, not recommended)

2. **Zone ID**: `47da5b94667c38fe40fe90419402ac78`

## API Endpoints

### List All Page Rules

```bash
GET https://api.cloudflare.com/client/v4/zones/{zone_id}/pagerules
```

**Example:**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/47da5b94667c38fe40fe90419402ac78/pagerules" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"
```

### Get Specific Page Rule

```bash
GET https://api.cloudflare.com/client/v4/zones/{zone_id}/pagerules/{identifier}
```

**Example:**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/47da5b94667c38fe40fe90419402ac78/pagerules/{page_rule_id}" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"
```

### Create Page Rule

```bash
POST https://api.cloudflare.com/client/v4/zones/{zone_id}/pagerules
```

**Example - Redirect root domain to www:**
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

### Update Page Rule

```bash
PUT https://api.cloudflare.com/client/v4/zones/{zone_id}/pagerules/{identifier}
```

### Delete Page Rule

```bash
DELETE https://api.cloudflare.com/client/v4/zones/{zone_id}/pagerules/{identifier}
```

## Response Format

### Success Response

```json
{
  "result": {
    "id": "page_rule_id",
    "targets": [
      {
        "target": "url",
        "constraint": {
          "operator": "matches",
          "value": "http://kidscallhome.com/*"
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
    "status": "active",
    "created_on": "2024-01-01T00:00:00Z",
    "modified_on": "2024-01-01T00:00:00Z"
  },
  "success": true,
  "errors": [],
  "messages": []
}
```

### Error Response

```json
{
  "success": false,
  "errors": [
    {
      "code": 1004,
      "message": "Page Rule validation failed"
    }
  ],
  "messages": []
}
```

## Common Page Rule Actions

### Forwarding URL (Redirect)

```json
{
  "id": "forwarding_url",
  "value": {
    "url": "https://www.kidscallhome.com/$1",
    "status_code": 301
  }
}
```

**Status Codes:**
- `301`: Permanent redirect (SEO-friendly)
- `302`: Temporary redirect

### Cache Level

```json
{
  "id": "cache_level",
  "value": "bypass"
}
```

### SSL

```json
{
  "id": "ssl",
  "value": "flexible"
}
```

## Priority

Page rules are evaluated in order of priority (lower number = higher priority). For the root domain redirect, use priority `1` to ensure it's evaluated first.

## Free Plan Limitations

- **3 page rules maximum** on Cloudflare free plan
- If you already have 3 rules, you'll need to delete one or upgrade

## Complete Example: Create Root Domain Redirect

```bash
#!/bin/bash

# Configuration
ZONE_ID="47da5b94667c38fe40fe90419402ac78"
API_TOKEN="YOUR_API_TOKEN_HERE"

# Create page rule to redirect kidscallhome.com to www.kidscallhome.com
curl -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/pagerules" \
  -H "Authorization: Bearer ${API_TOKEN}" \
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

## PowerShell Script (Windows)

```powershell
# Configuration
$ZoneId = "47da5b94667c38fe40fe90419402ac78"
$ApiToken = "YOUR_API_TOKEN_HERE"

# Headers
$Headers = @{
    "Authorization" = "Bearer $ApiToken"
    "Content-Type" = "application/json"
}

# Body
$Body = @{
    targets = @(
        @{
            target = "url"
            constraint = @{
                operator = "matches"
                value = "http://kidscallhome.com/*"
            }
        },
        @{
            target = "url"
            constraint = @{
                operator = "matches"
                value = "https://kidscallhome.com/*"
            }
        }
    )
    actions = @(
        @{
            id = "forwarding_url"
            value = @{
                url = "https://www.kidscallhome.com/`$1"
                status_code = 301
            }
        }
    )
    priority = 1
    status = "active"
} | ConvertTo-Json -Depth 10

# Create page rule
$Response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/pagerules" `
    -Method Post `
    -Headers $Headers `
    -Body $Body

Write-Host "Page Rule Created:" -ForegroundColor Green
$Response | ConvertTo-Json -Depth 10
```

## Testing

After creating the page rule:

1. **Wait 1-2 minutes** for the rule to activate
2. **Test in incognito/private browser**:
   - `http://kidscallhome.com` → Should redirect to `https://www.kidscallhome.com`
   - `https://kidscallhome.com` → Should redirect to `https://www.kidscallhome.com`
3. **Verify redirect status code**:
   ```bash
   curl -I http://kidscallhome.com
   # Should show: HTTP/1.1 301 Moved Permanently
   ```

## Troubleshooting

### Error: "Page Rule validation failed"

- Check that the URL pattern is correct
- Ensure you're not exceeding the 3 page rule limit (free plan)
- Verify API token has correct permissions

### Error: "Authentication error"

- Verify API token is correct
- Check token has `Zone:Page Rules:Edit` permission
- Ensure token hasn't expired

### Rule not working

- Wait 1-2 minutes for rule to propagate
- Clear browser cache
- Test in incognito mode
- Check rule priority (lower number = higher priority)
- Verify rule status is "active"

## Related Documentation

- [Cloudflare Page Rules API](https://developers.cloudflare.com/api/resources/page_rules/)
- [Root Domain Loading Issue](../troubleshooting/ROOT_DOMAIN_LOADING_ISSUE.md)
- [Quick Fix Guide](../troubleshooting/QUICK_FIX_ROOT_DOMAIN.md)


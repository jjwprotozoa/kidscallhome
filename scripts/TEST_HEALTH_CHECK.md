# Testing the Health Check Endpoint

## Quick Test

### Option 1: Using the Test Script

```powershell
# Set your anon key (get from Supabase Dashboard → Settings → API)
$env:SUPABASE_ANON_KEY = "your-anon-key-here"
$env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"

# Run the test script
.\scripts\test-health-check.ps1
```

### Option 2: Using PowerShell Directly

```powershell
$env:SUPABASE_ANON_KEY = "your-anon-key-here"
$url = "https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/health-check"
$headers = @{ "Authorization" = "Bearer $env:SUPABASE_ANON_KEY" }

Invoke-WebRequest -Uri $url -Method GET -Headers $headers | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Option 3: Using curl (if available)

```bash
curl -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/health-check
```

## Getting Your Anon Key

1. Go to: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/settings/api
2. Find the **"anon"** or **"public"** key
3. Copy it (it starts with `eyJ...`)

## Expected Response

A successful response should look like:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX...",
  "version": "1.0.0",
  "checks": {
    "environment": {
      "status": "ok",
      "variables": {
        "SUPABASE_URL": { "set": true, "value": "https://..." },
        "SUPABASE_ANON_KEY": { "set": true, "value": "***" },
        ...
      }
    },
    "supabase": {
      "status": "ok",
      "message": "Supabase connection successful",
      "timestamp": "..."
    }
  },
  "overall": {
    "status": "healthy"
  }
}
```

## Troubleshooting

### 401 Unauthorized
- **Cause:** Missing or invalid Authorization header
- **Fix:** Make sure you're including `Authorization: Bearer <anon-key>`

### 404 Not Found
- **Cause:** Function not deployed
- **Fix:** Deploy the `health-check` function via Supabase Dashboard

### Connection Error
- **Cause:** Network issue or incorrect URL
- **Fix:** Verify the BASE_URL is correct

## Integration with Security Tests

The health check is now included in the security tests:

```powershell
$env:SUPABASE_ANON_KEY = "your-anon-key-here"
$env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"
$env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"

# Run all tests (includes health check)
.\scripts\security-tests.ps1 all

# Or run just the health check test
.\scripts\security-tests.ps1 health-check
```











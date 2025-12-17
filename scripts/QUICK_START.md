# Quick Start Guide - Security Tests

## ⚡ Quick Setup (PowerShell)

### Option 1: Interactive Setup
```powershell
.\scripts\setup-test-env.ps1
.\scripts\security-tests.ps1 all
```

### Option 2: Manual Setup
```powershell
# Set your Supabase project URL
$env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"
$env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"

# Optional: Set auth token (get from Supabase dashboard)
$env:AUTH_TOKEN = "your-token-here"

# Run tests
.\scripts\security-tests.ps1 all
```

## 🔍 Getting Your Configuration Values

### 1. Supabase Project URL
- Go to: https://supabase.com/dashboard
- Select your project
- Go to Settings → API
- Copy the **Project URL** (e.g., `https://itmhojbjfacocrpmslmt.supabase.co`)

### 2. Auth Token (Optional)
- Get from Supabase dashboard → Settings → API
- Or use a test user's JWT token from browser DevTools
- Some tests work without auth token (they'll return 401, which is expected)

## 📝 Example Configuration

```powershell
# Your actual Supabase project
$env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"
$env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"

# Optional - for authenticated endpoint tests
$env:AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Run all tests
.\scripts\security-tests.ps1 all
```

## ✅ Expected Results

When properly configured, you should see:
- ✅ CORS tests passing (200/401 for allowed, 403 for disallowed)
- ✅ Content-Type validation working (400 for invalid)
- ✅ Input validation working (400 for invalid quantity)
- ⚠️ Some tests may show 401 (Unauthorized) - this is expected if auth token is missing

## 🐛 Troubleshooting

### "Connection error" messages
- ✅ Check your `BASE_URL` is correct
- ✅ Verify your Supabase project is accessible
- ✅ Check your internet connection

### All tests showing "FAIL"
- ✅ Make sure you've set `$env:BASE_URL` with your actual project URL
- ✅ Verify the URL format: `https://your-project-id.supabase.co`

### Tests showing 401 (Unauthorized)
- ✅ This is expected for some tests without auth token
- ✅ Set `$env:AUTH_TOKEN` if you want to test authenticated endpoints
- ✅ 401 responses still validate CORS and Content-Type security

## 🎯 Testing Without Full Configuration

You can still test some security features:

```powershell
# Test security headers (works with any URL)
$env:BASE_URL = "https://www.kidscallhome.com"
.\scripts\security-tests.ps1 headers
```

## 📚 Next Steps

1. ✅ Set up your environment variables
2. ✅ Run the tests
3. ✅ Review the results
4. ✅ Fix any issues found
5. ✅ Re-run tests to verify fixes

For more details, see `scripts/README.md`








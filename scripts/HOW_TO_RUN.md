# How to Run Security Tests

## ✅ Quick Reference

### From Project Root

```powershell
cd C:\Users\DevBox\MiniApps\KidsCallHome\kidscallhome\kidscallhome

# Set environment variables
$env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"
$env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"

# Run tests
.\scripts\security-tests.ps1 all
```

### From Scripts Directory

```powershell
cd C:\Users\DevBox\MiniApps\KidsCallHome\kidscallhome\kidscallhome\scripts

# Set environment variables
$env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"
$env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"

# Run tests (use the script name directly, no path)
.\security-tests.ps1 all

# OR use the helper script
.\run-tests.ps1 all
```

## 📝 Important Notes

1. **If you're in the `scripts` directory:**

   - Use: `.\security-tests.ps1` (no `scripts\` prefix)
   - Or use: `.\run-tests.ps1` (helper script)

2. **If you're in the project root:**

   - Use: `.\scripts\security-tests.ps1`
   - Or use: `.\run-security-tests.ps1` (helper script in root)

3. **Environment Variables:**
   - Must be set in the same PowerShell session
   - Set them before running the script
   - They persist for the session

## 🎯 One-Liner (Copy & Paste)

```powershell
$env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"; $env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"; .\scripts\security-tests.ps1 all
```

## ⚠️ Expected Results

If Edge Functions are **not deployed**, you'll see:

- ⚠️ SKIP: Endpoint not found (404)

This is **normal** and expected. Deploy the functions first to see actual test results.

## 🚀 Next Steps

1. **Deploy Edge Functions** (see `DEPLOYMENT_QUICK_START.md`)
2. **Re-run tests** - should show ✅ PASS or ❌ FAIL instead of SKIP








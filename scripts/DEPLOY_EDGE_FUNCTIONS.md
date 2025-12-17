# Deploy Edge Functions - Complete Guide

## 🚀 Quick Deployment Options

### Option 1: Supabase Dashboard (Easiest - No CLI Required)

1. **Go to Supabase Dashboard:**

   - Visit: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt
   - Navigate to: **Edge Functions** (left sidebar)

2. **Deploy Each Function:**

   - Click **"Create a new function"** or **"Deploy"**
   - For each function, you can either:
     - **Upload the folder** from `supabase/functions/[function-name]/`
     - **Copy-paste the code** from the `index.ts` file

3. **Functions to Deploy:**
   - `create-stripe-subscription`
   - `stripe-webhook`
   - `create-customer-portal-session`
   - `send-family-member-invitation`

### Option 2: Install Supabase CLI (Recommended for Automation)

#### Windows Installation

**Option A: Using npm (if you have Node.js)**

```powershell
npm install -g supabase
```

**Option B: Using Scoop**

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Option C: Using Chocolatey**

```powershell
choco install supabase
```

**Option D: Manual Download**

1. Download from: https://github.com/supabase/cli/releases
2. Extract and add to PATH

#### Verify Installation

```powershell
supabase --version
```

#### Login and Link Project

```powershell
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref itmhojbjfacocrpmslmt
```

#### Deploy Functions

```powershell
# Navigate to project root
cd C:\Users\DevBox\MiniApps\KidsCallHome\kidscallhome\kidscallhome

# Deploy each function
supabase functions deploy create-stripe-subscription
supabase functions deploy stripe-webhook
supabase functions deploy create-customer-portal-session
supabase functions deploy send-family-member-invitation
```

### Option 3: GitHub Actions / CI/CD

If you have GitHub Actions set up, you can deploy automatically:

```yaml
# .github/workflows/deploy-functions.yml
name: Deploy Edge Functions

on:
  push:
    branches: [main]
    paths:
      - "supabase/functions/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
      - run: supabase functions deploy create-stripe-subscription
      - run: supabase functions deploy stripe-webhook
      - run: supabase functions deploy create-customer-portal-session
      - run: supabase functions deploy send-family-member-invitation
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_ID: itmhojbjfacocrpmslmt
```

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure:

- [ ] **Environment Variables Set in Supabase Dashboard:**

  - Go to: Project Settings → Edge Functions → Secrets
  - Add all required secrets:
    - `STRIPE_SECRET_KEY`
    - `STRIPE_WEBHOOK_SECRET`
    - `STRIPE_PRICE_ADDITIONAL_KID_MONTHLY`
    - `STRIPE_PRICE_ADDITIONAL_KID_ANNUAL`
    - `STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY`
    - `STRIPE_PRICE_ANNUAL_FAMILY_PLAN`
    - `SUPABASE_URL` (usually auto-set)
    - `SUPABASE_ANON_KEY` (usually auto-set)
    - `SUPABASE_SERVICE_ROLE_KEY` (for webhook)

- [ ] **Code is Updated:**

  - All security fixes are in place
  - CORS configuration is correct
  - Content-Type validation is added
  - Rate limiting is implemented

- [ ] **Test Locally (if using CLI):**
  ```powershell
  supabase functions serve create-stripe-subscription
  ```

---

## 🔍 Verify Deployment

### Check Function Status

1. **Supabase Dashboard:**

   - Go to: Edge Functions
   - Verify all functions show as "Active"

2. **Test Endpoints:**

   ```powershell
   # Test OPTIONS (CORS preflight)
   Invoke-WebRequest -Uri "https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/create-stripe-subscription" -Method OPTIONS

   # Should return 200 with CORS headers
   ```

3. **Re-run Security Tests:**
   ```powershell
   $env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"
   $env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"
   .\scripts\security-tests.ps1 all
   ```

---

## 🐛 Troubleshooting

### "Function not found" after deployment

- **Check function name:** Must match folder name exactly
- **Check project link:** Run `supabase link --project-ref itmhojbjfacocrpmslmt`
- **Check dashboard:** Verify function appears in Supabase dashboard

### "Missing environment variable"

- **Set secrets in dashboard:** Project Settings → Edge Functions → Secrets
- **Redeploy after adding secrets:** Secrets are loaded at deployment time

### CORS errors after deployment

- **Verify CORS configuration:** Check `getCorsHeaders()` function
- **Check allowed origins:** Ensure your domain is in the whitelist
- **Test with curl/Postman:** Verify CORS headers in response

---

## 📚 Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Deployment Best Practices](https://supabase.com/docs/guides/functions/deploy)

---

## ✅ After Deployment

Once functions are deployed:

1. **Re-run security tests:**

   ```powershell
   .\scripts\security-tests.ps1 all
   ```

2. **Verify all tests pass:**

   - CORS validation ✅
   - Content-Type validation ✅
   - Input validation ✅
   - Rate limiting ✅

3. **Test in production:**
   - Test subscription flow
   - Test webhook processing
   - Monitor for errors

---

**Quick Start:** Use Option 1 (Dashboard) if you don't want to install CLI. Use Option 2 (CLI) for automation and easier updates.







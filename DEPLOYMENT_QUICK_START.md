# 🚀 Quick Deployment Guide

## Easiest Method: Supabase Dashboard (No CLI Required)

### Step 1: Deploy Functions via Dashboard

1. **Go to:** https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/edge-functions

2. **For each function:**
   - Click **"Create a new function"**
   - Enter function name
   - Copy code from the file in `supabase/functions/[function-name]/index.ts`
   - Paste and click **"Deploy"**

**Functions to deploy:**
- ✅ `create-stripe-subscription`
- ✅ `stripe-webhook`
- ✅ `create-customer-portal-session`
- ✅ `send-family-member-invitation`

### Step 2: Set Secrets

Go to: **Project Settings** → **Edge Functions** → **Secrets**

Add:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_*` (all 4 price IDs)

### Step 3: Test Deployment

```powershell
# Set environment variables
$env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"
$env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"

# Run security tests
cd kidscallhome\scripts
.\security-tests.ps1 all
```

---

## Alternative: Install CLI (For Automation)

### Option 1: Scoop (Recommended)

```powershell
# Install Scoop (if needed)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Option 2: Manual Download

1. Download: https://github.com/supabase/cli/releases
2. Extract and add to PATH
3. Run: `supabase login`
4. Run: `supabase link --project-ref itmhojbjfacocrpmslmt`
5. Deploy: `supabase functions deploy [function-name]`

---

## ✅ After Deployment

1. **Verify functions are active** in dashboard
2. **Re-run security tests** - should show ✅ PASS instead of ⚠️ SKIP
3. **Test in production** - verify subscription flow works

---

**Recommended:** Use Dashboard method (Step 1) - it's the fastest and requires no installation!






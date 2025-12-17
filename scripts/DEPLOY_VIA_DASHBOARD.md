# Deploy Edge Functions via Supabase Dashboard
**No CLI Required!** ✅

## 🎯 Quick Steps

### 1. Go to Supabase Dashboard

Visit: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/edge-functions

Or navigate:
- Dashboard → Your Project → **Edge Functions** (left sidebar)

---

## 📤 Deploy Each Function

### Function 1: create-stripe-subscription

1. Click **"Create a new function"** or find existing function
2. **Function name:** `create-stripe-subscription`
3. **Copy code from:** `supabase/functions/create-stripe-subscription/index.ts`
4. **Paste into editor**
5. Click **"Deploy"** or **"Save"**

### Function 2: stripe-webhook

1. Click **"Create a new function"**
2. **Function name:** `stripe-webhook`
3. **Copy code from:** `supabase/functions/stripe-webhook/index.ts`
4. **Paste into editor**
5. Click **"Deploy"**

### Function 3: create-customer-portal-session

1. Click **"Create a new function"**
2. **Function name:** `create-customer-portal-session`
3. **Copy code from:** `supabase/functions/create-customer-portal-session/index.ts`
4. **Paste into editor**
5. Click **"Deploy"**

### Function 4: send-family-member-invitation

1. Click **"Create a new function"**
2. **Function name:** `send-family-member-invitation`
3. **Copy code from:** `supabase/functions/send-family-member-invitation/index.ts`
4. **Paste into editor**
5. Click **"Deploy"**

---

## 🔐 Set Environment Secrets

**Critical:** Before functions work, set secrets:

1. Go to: **Project Settings** → **Edge Functions** → **Secrets**
2. Add these secrets:

```
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ADDITIONAL_KID_MONTHLY=price_...
STRIPE_PRICE_ADDITIONAL_KID_ANNUAL=price_...
STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL_FAMILY_PLAN=price_...
```

**Note:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are usually auto-set.

---

## ✅ Verify Deployment

### Check Function Status

1. Go to **Edge Functions** page
2. Verify all 4 functions show as **"Active"**

### Test Endpoint

```powershell
# Test CORS preflight
Invoke-WebRequest -Uri "https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/create-stripe-subscription" -Method OPTIONS

# Should return 200 with CORS headers
```

### Re-run Security Tests

```powershell
$env:BASE_URL = "https://itmhojbjfacocrpmslmt.supabase.co"
$env:FUNCTION_BASE = "$env:BASE_URL/functions/v1"
cd scripts
.\security-tests.ps1 all
```

---

## 🎯 Quick Copy-Paste Locations

All function code is in:
- `kidscallhome/supabase/functions/create-stripe-subscription/index.ts`
- `kidscallhome/supabase/functions/stripe-webhook/index.ts`
- `kidscallhome/supabase/functions/create-customer-portal-session/index.ts`
- `kidscallhome/supabase/functions/send-family-member-invitation/index.ts`

---

## 📝 Notes

- **No CLI needed** - Everything via web dashboard
- **Secrets must be set** - Functions won't work without them
- **Redeploy after code changes** - Click "Deploy" again
- **Check logs** - Dashboard shows function execution logs

---

**This is the easiest method - no installation required!** 🚀








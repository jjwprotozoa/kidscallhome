# Cloudflare Turnstile Setup Guide

## ✅ Step 1: Environment Variables

### Client-Side (Vercel) ✅ Already Done
- `VITE_TURNSTILE_SITE_KEY` - Set in Vercel environment variables

### Server-Side (Supabase) ⚠️ Needs Setup

The `TURNSTILE_SECRET_KEY` must be set in **Supabase**, not Vercel, because Edge Functions run on Supabase infrastructure.

## 🔐 Step 2: Set Secret in Supabase

### Option A: Via Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/settings/functions
   - Or navigate: **Project Settings** → **Edge Functions** → **Secrets**

2. **Add Secret:**
   - Click **"Add new secret"** or **"Manage secrets"**
   - **Name:** `TURNSTILE_SECRET_KEY`
   - **Value:** Your Turnstile Secret Key (from Cloudflare Dashboard)
   - Click **"Save"**

### Option B: Via Supabase CLI

```bash
supabase secrets set TURNSTILE_SECRET_KEY=your_secret_key_here
```

**Where to get your Secret Key:**
- Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
- Navigate to **Turnstile**
- Select your widget
- Copy the **Secret Key** (not the Site Key)

---

## 🚀 Step 3: Deploy Edge Function

### Option A: Via Supabase Dashboard (No CLI Required)

1. **Go to Edge Functions:**
   - Visit: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/edge-functions

2. **Create New Function:**
   - Click **"Create a new function"**
   - **Function name:** `verify-turnstile`
   - **Copy code from:** `supabase/functions/verify-turnstile/index.ts`
   - Paste into the editor
   - Click **"Deploy"**

### Option B: Via Supabase CLI

```bash
# Navigate to project root
cd kidscallhome

# Deploy the function
supabase functions deploy verify-turnstile
```

---

## ✅ Step 4: Verify Setup

### Test the Function

```powershell
# Test the endpoint
$body = @{
    token = "test-token"
} | ConvertTo-Json

Invoke-WebRequest `
    -Uri "https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/verify-turnstile" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

**Expected Response:**
- If secret is set correctly: Returns validation result from Cloudflare
- If secret is missing: Returns `500` error with "Turnstile secret key not configured"

### Test in Application

1. **Fail login 2 times** → CAPTCHA should appear
2. **Complete CAPTCHA** → Token should be validated server-side
3. **Check browser console** → Should see "Turnstile validation successful"
4. **Login should proceed** → Only if validation succeeds

---

## 🔍 Troubleshooting

### Function Returns 500 Error

**Problem:** "Turnstile secret key not configured"

**Solution:**
1. Verify secret is set in Supabase (not Vercel)
2. Go to: Project Settings → Edge Functions → Secrets
3. Check `TURNSTILE_SECRET_KEY` exists
4. Redeploy function after setting secret

### Function Not Found (404)

**Problem:** Function not deployed

**Solution:**
1. Deploy the function via Dashboard or CLI
2. Verify function shows as "Active" in Edge Functions list

### Validation Always Fails

**Problem:** Invalid secret key or token

**Solution:**
1. Verify secret key matches your Cloudflare widget
2. Check token is being passed correctly from client
3. Check browser console for validation errors
4. Verify Site Key matches Secret Key (same widget)

---

## 📋 Quick Checklist

- [ ] `VITE_TURNSTILE_SITE_KEY` set in Vercel ✅
- [ ] `TURNSTILE_SECRET_KEY` set in Supabase Edge Function secrets
- [ ] `verify-turnstile` function deployed to Supabase
- [ ] Function shows as "Active" in dashboard
- [ ] Tested login flow with CAPTCHA

---

## 🎯 Summary

**What goes where:**
- **Vercel:** `VITE_TURNSTILE_SITE_KEY` (public, client-side)
- **Supabase:** `TURNSTILE_SECRET_KEY` (secret, server-side)

**Why:**
- Edge Functions run on Supabase infrastructure
- Secrets must be accessible to the Edge Function runtime
- Vercel env vars are not accessible to Supabase Edge Functions

---

**Need help?** Check the function logs in Supabase Dashboard → Edge Functions → verify-turnstile → Logs


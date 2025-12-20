# Fix Supabase CAPTCHA Conflict with Turnstile

## Problem

You're seeing this error when trying to login:
```
AuthApiError: captcha verification process failed
code: 'unexpected_failure'
```

This happens because **Supabase has CAPTCHA protection enabled** at the project level, which conflicts with Cloudflare Turnstile.

## Root Cause

- Supabase's built-in CAPTCHA protection is enabled in your project settings
- Supabase expects its own captcha tokens (reCAPTCHA or hCaptcha)
- We're using Cloudflare Turnstile, which Supabase doesn't natively support in auth
- This causes Supabase to reject login attempts with "captcha verification process failed"

## Solution: Disable Supabase CAPTCHA Protection

Since we're handling CAPTCHA validation client-side with Turnstile, we need to disable Supabase's built-in CAPTCHA protection.

### Step 1: Go to Supabase Dashboard

1. Navigate to: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt
2. Click on **Settings** (gear icon) in the left sidebar
3. Click on **Authentication** in the settings menu

### Step 2: Disable CAPTCHA Protection

1. Scroll down to **"Bot and Abuse Protection"** section
2. Find **"Enable CAPTCHA protection"** toggle
3. **Turn it OFF** (disable it)
4. Click **"Save"** or the changes will auto-save

### Step 3: Verify the Fix

1. Try logging in again
2. The error should be gone
3. Turnstile will still work (it's validated client-side before calling Supabase)

## Why This Works

- **Turnstile validation happens client-side** before calling Supabase (see `authHandlers.ts` lines 50-83)
- We validate the Turnstile token using our Edge Function
- Once validated, we proceed to Supabase login **without** passing a captcha token
- Since Supabase CAPTCHA is disabled, it won't require a captcha token
- Your security is maintained through client-side Turnstile validation

## Alternative: Use Supabase's Native CAPTCHA (Not Recommended)

If you want to use Supabase's built-in CAPTCHA instead of Turnstile:

1. **Enable** Supabase CAPTCHA protection (keep it ON)
2. Configure reCAPTCHA or hCaptcha in Supabase settings
3. Remove Turnstile integration
4. Pass Supabase's captcha token to `signInWithPassword`

**Why not recommended:** 
- Turnstile is **free** and **unlimited** (Supabase CAPTCHA may have costs)
- Turnstile is **privacy-focused** (no Google tracking like reCAPTCHA)
- Turnstile provides **better UX** (often invisible, no puzzles)
- Turnstile is **already integrated and working**
- Turnstile is **more modern** and lightweight

**When to consider Supabase CAPTCHA:**
- If you want native integration (less code to maintain)
- If you're already using reCAPTCHA/hCaptcha elsewhere
- If you prefer Supabase handling everything automatically

**Bottom line:** Stick with Turnstile unless you have a specific reason to switch.

## Verification Checklist

- [ ] Supabase Dashboard → Settings → Authentication → Bot and Abuse Protection
- [ ] "Enable CAPTCHA protection" is **OFF** (disabled)
- [ ] Changes saved
- [ ] Login works without "captcha verification process failed" error
- [ ] Turnstile still appears after 2 failed login attempts
- [ ] Turnstile validation works correctly

## Still Having Issues?

1. **Clear browser cache** and try again
2. **Check Supabase logs** in Dashboard → Logs → Auth Logs
3. **Verify Turnstile is working** - check browser console for Turnstile errors
4. **Check environment variables** - ensure `VITE_TURNSTILE_SITE_KEY` is set

## Related Documentation

- [Turnstile Setup Guide](./TURNSTILE_SETUP.md)
- [Security Implementation](./SECURITY_IMPLEMENTATION.md)
- [Supabase Auth CAPTCHA Docs](https://supabase.com/docs/guides/auth/auth-captcha)


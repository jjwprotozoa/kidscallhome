# Email Configuration Guide

## Overview

This guide explains how to configure email sending for both **localhost (development)** and **production** environments.

## Problem: Emails Not Being Received

If emails are not being received, it's usually due to:

1. **Supabase Site URL not configured** - Redirect URLs must be whitelisted
2. **SMTP not configured** - No email service provider set up
3. **Email confirmation disabled** - Emails won't be sent if confirmation is off
4. **Wrong redirect URLs** - Using localhost URLs in production or vice versa

## Solution: Proper Configuration

### 1. Environment Variables

**⚠️ Important**: `VITE_SITE_URL` is a **client-side** environment variable. It should **NOT** be set in Supabase Secrets. Supabase Secrets are only for server-side Edge Functions.

#### Where to Set VITE_SITE_URL

**A. For Production (Vercel/Deployment Platform):**

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add: `VITE_SITE_URL` = `https://www.kidscallhome.com`
3. Select environments: **Production**, **Preview**, **Development**
4. **Redeploy** your application for changes to take effect

**B. For Local Development (.env file):**
Add to your `.env` file in the project root:

```env
# Site URL for email redirects (optional - defaults to window.location.origin)
# For production, set this to your production domain
VITE_SITE_URL=https://www.kidscallhome.com

# For localhost development, you can omit this (will use http://localhost:8080)
# Or set it explicitly:
# VITE_SITE_URL=http://localhost:8080
```

**Important**: The code now uses `getEmailRedirectUrl()` utility which:

- Uses `VITE_SITE_URL` if set (recommended for production)
- Falls back to `window.location.origin` (works for both dev and prod)

**See also**: `docs/ENVIRONMENT_VARIABLES_SETUP.md` for detailed instructions on where to set different types of environment variables.

### 2. Supabase Dashboard Configuration

#### A. Site URL Settings

1. Go to **Supabase Dashboard** → **Your Project**
2. Navigate to **Authentication** → **URL Configuration**
3. Set **Site URL**:
   - **Production**: `https://www.kidscallhome.com`
   - **Development**: `http://localhost:8080` (or your dev port)

#### B. Redirect URLs (Whitelist)

1. Go to **Authentication** → **URL Configuration** → **Redirect URLs**
2. Add these URLs (one per line):

   ```
   https://www.kidscallhome.com/parent/children
   https://www.kidscallhome.com/family-member/dashboard
   https://kidscallhome.com/parent/children
   https://kidscallhome.com/family-member/dashboard
   http://localhost:8080/parent/children
   http://localhost:8080/family-member/dashboard
   http://localhost:5173/parent/children
   http://localhost:5173/family-member/dashboard
   ```

**Note**: Supabase requires redirect URLs to be whitelisted. If a URL is not in the list, email links will fail.

#### C. Email Confirmation Settings

1. Go to **Authentication** → **Settings** → **Email Auth**
2. **Enable email confirmations**: Toggle ON (for production) or OFF (for development)
3. **Email template**: Customize if needed

### 3. SMTP Configuration (Required for Production)

#### Option A: Using Supabase's Built-in Email (Limited)

Supabase provides basic email sending, but it's limited and may not work reliably.

#### Option B: Using Custom SMTP (Recommended)

1. Go to **Supabase Dashboard** → **Project Settings** → **Auth** → **SMTP Settings**
2. Configure your SMTP provider:

   **For Gmail:**
   - SMTP Host: `smtp.gmail.com`
   - SMTP Port: `587` (TLS) or `465` (SSL)
   - SMTP User: Your Gmail address
   - SMTP Password: App Password (not regular password - [create one here](https://myaccount.google.com/apppasswords))
   - Sender Email: Your Gmail address
   - Sender Name: `Kids Call Home`

   **For Hostinger:**
   - SMTP Host: `smtp.hostinger.com`
   - SMTP Port: `465` (SSL) or `587` (TLS)
   - SMTP User: Your Hostinger email (e.g., `noreply@kidscallhome.com`)
   - SMTP Password: Your email password
   - Sender Email: Same as SMTP User
   - Sender Name: `Kids Call Home`

   **For SendGrid/Mailgun/AWS SES:**
   - Use the SMTP credentials provided by your email service
   - Standard SMTP settings apply

3. **Test** the configuration using Supabase's "Test" button
4. Save settings

### 4. Development vs Production

#### Development (Localhost)

**Recommended Setup:**

1. **Disable email confirmation** in Supabase Dashboard (easiest for testing)
   - OR
2. **Configure SMTP** and add `http://localhost:8080` to redirect URLs
3. Set `VITE_SITE_URL=http://localhost:8080` in `.env` (optional)

**Manual Verification (Quick Testing):**

- Go to Supabase Dashboard → **Authentication** → **Users**
- Click on user → **"Confirm Email"** button
- Or run SQL: `UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = 'user@example.com';`

#### Production

**Required Setup:**

1. **Enable email confirmation** in Supabase Dashboard
2. **Configure SMTP** (Hostinger, Gmail, SendGrid, etc.)
3. Set **Site URL** to `https://www.kidscallhome.com`
4. Add production redirect URLs to whitelist (both www and non-www)
5. Set `VITE_SITE_URL=https://www.kidscallhome.com` in production environment variables

### 5. Code Changes Made

All email redirect URLs now use the `getEmailRedirectUrl()` utility:

```typescript
// Before (problematic):
emailRedirectTo: `${window.location.origin}/parent/children`

// After (fixed):
emailRedirectTo: getEmailRedirectUrl("/parent/children")
```

This ensures:

- Production uses the correct domain (from `VITE_SITE_URL`)
- Localhost works correctly (uses `window.location.origin`)
- Consistent behavior across environments

### 6. Testing Email Configuration

#### Test Signup Email

1. Sign up with a test email
2. Check Supabase Dashboard → **Logs** → **Auth Logs** to see if email was sent
3. Check spam folder
4. Click the verification link

#### Test Resend Email

1. Try to log in with unverified email
2. Click "Resend Verification Email"
3. Check email inbox

#### Verify Redirect URLs

1. Click email verification link
2. Should redirect to `/parent/children` or `/family-member/dashboard`
3. If you see "Invalid redirect URL" error, add the URL to Supabase whitelist

### 7. Troubleshooting

#### Emails Not Arriving

1. **Check Supabase Logs**:
   - Go to **Logs** → **Auth Logs**
   - Look for email sending errors

2. **Check SMTP Configuration**:
   - Test SMTP connection in Supabase Dashboard
   - Verify credentials are correct
   - Check if email provider has sending limits

3. **Check Spam Folder**:
   - Verification emails often go to spam
   - Add `noreply@kidscallhome.com` to contacts

4. **Check Redirect URLs**:
   - Ensure URLs are whitelisted in Supabase
   - Check Site URL matches your domain

5. **Check Email Confirmation Setting**:
   - If disabled, emails won't be sent
   - Enable it in Authentication → Settings → Email Auth

#### "Invalid redirect URL" Error

This means the redirect URL is not whitelisted in Supabase:

1. Go to **Authentication** → **URL Configuration** → **Redirect URLs**
2. Add the exact URL that's failing
3. URLs must match exactly (including http/https and port)

#### Development Emails Not Working

**Quick Fix**: Disable email confirmation for development:

1. Go to **Authentication** → **Settings** → **Email Auth**
2. Turn OFF **"Enable email confirmations"**
3. Users can now sign in immediately without verification

### 8. Production Checklist

Before deploying to production:

- [ ] Configure SMTP in Supabase Dashboard
- [ ] Set `VITE_SITE_URL=https://www.kidscallhome.com` in production environment
- [ ] Add production redirect URLs to Supabase whitelist
- [ ] Enable email confirmation in Supabase
- [ ] Test signup email delivery
- [ ] Test resend email functionality
- [ ] Verify email links redirect correctly
- [ ] Check spam folder handling
- [ ] Monitor email delivery rates

### Related Files

- `src/utils/siteUrl.ts` - Site URL utility function
- `src/pages/ParentAuth/authHandlers.ts` - Signup email configuration
- `src/pages/VerifyEmail.tsx` - Resend email functionality
- `src/pages/ParentAuth/ParentAuth.tsx` - Resend email in login flow
- `docs/EMAIL_VERIFICATION_SETUP.md` - Additional email setup details

## Summary

**Key Points:**

1. ✅ Use `VITE_SITE_URL` environment variable for production
2. ✅ Whitelist all redirect URLs in Supabase Dashboard
3. ✅ Configure SMTP for production email delivery
4. ✅ Test email delivery in both dev and prod
5. ✅ Code now uses `getEmailRedirectUrl()` for consistency

**For Localhost**: Either disable email confirmation OR configure SMTP + whitelist localhost URLs

**For Production**: Always configure SMTP + set `VITE_SITE_URL=https://www.kidscallhome.com` + whitelist production URLs (both www and non-www)

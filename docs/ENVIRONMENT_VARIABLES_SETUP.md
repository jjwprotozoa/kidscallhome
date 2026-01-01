# Environment Variables Setup Guide

## Overview

This guide explains where to set environment variables for different parts of the application.

## Important: VITE_ Variables vs Supabase Secrets

### ❌ VITE_SITE_URL should NOT be in Supabase Secrets

**Supabase Secrets** are for **server-side Edge Functions only**. They are NOT accessible to client-side code.

**VITE_ variables** are **client-side** environment variables that get bundled into your frontend code at build time.

## Where to Set VITE_SITE_URL

### 1. **Vercel (Production Deployment)**

If you're deploying to Vercel:

1. Go to **Vercel Dashboard** → Your Project
2. Navigate to **Settings** → **Environment Variables**
3. Add new variable:
   - **Name**: `VITE_SITE_URL`
   - **Value**: `https://www.kidscallhome.com`
   - **Environment**: Select all (Production, Preview, Development)
4. Click **Save**
5. **Redeploy** your application for changes to take effect

**Note**: After adding environment variables, you need to trigger a new deployment for them to be available.

### 2. **Local Development (.env file)**

For local development, create or update `.env` in your project root:

```env
VITE_SITE_URL=https://www.kidscallhome.com
```

**Note**: 
- `.env` files are gitignored (don't commit them)
- Restart your dev server after adding/changing `.env` variables
- For localhost, you can omit this (will use `http://localhost:8080` automatically)

### 3. **Other Deployment Platforms**

For other platforms (Netlify, Railway, etc.):

1. Go to your platform's **Environment Variables** or **Config** settings
2. Add: `VITE_SITE_URL` = `https://www.kidscallhome.com`
3. Redeploy your application

## What Goes in Supabase Secrets?

**Supabase Secrets** are for **Edge Functions** (server-side code). Examples:

- `RESEND_API_KEY` - For sending emails from Edge Functions
- `STRIPE_SECRET_KEY` - For Stripe webhooks
- `SITE_URL` - For Edge Functions (different from VITE_SITE_URL)

**These are NOT the same as VITE_ variables!**

## Current Configuration

### ✅ Already Configured in Code

The code uses `getEmailRedirectUrl()` which:
1. Checks for `VITE_SITE_URL` environment variable
2. Falls back to `window.location.origin` if not set

### ✅ Already Configured in Supabase

- Redirect URLs whitelisted ✅
- Site URL should be set in Authentication → URL Configuration ✅

### ⚠️ Still Needed

- Set `VITE_SITE_URL` in **Vercel** (or your deployment platform) environment variables
- Set `VITE_SITE_URL` in **local `.env` file** (optional for dev)

## Verification

To verify `VITE_SITE_URL` is set correctly:

1. **In Browser Console** (after deployment):
   ```javascript
   console.log(import.meta.env.VITE_SITE_URL);
   // Should output: https://www.kidscallhome.com
   ```

2. **Check Email Redirects**:
   - Sign up a test user
   - Check the email verification link
   - Should redirect to `https://www.kidscallhome.com/parent/children`

## Summary

| Variable | Where to Set | Purpose |
|----------|-------------|---------|
| `VITE_SITE_URL` | Vercel/Deployment Platform + `.env` | Client-side email redirects |
| `VITE_SUPABASE_URL` | Vercel/Deployment Platform + `.env` | Supabase client connection |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel/Deployment Platform + `.env` | Supabase client auth |
| `RESEND_API_KEY` | Supabase Secrets | Edge Function emails |
| `STRIPE_SECRET_KEY` | Supabase Secrets | Stripe webhooks |

**Remember**: 
- `VITE_*` variables = Frontend (Vercel/.env)
- Supabase Secrets = Backend Edge Functions only



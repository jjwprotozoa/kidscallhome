# Vercel Build Loop Fix

## Problem
Vercel deployment is looping with:
```
> kids-call-home-root@1.0.0-beta build
> cd kidscallhome && npm run build
> kids-call-home-root@1.0.0-beta build
> cd kidscallhome && npm run build
```

## Root Cause
Vercel is detecting the root `package.json` and running its build script, which creates a recursive loop when npm resolves scripts.

## Solution

### Configure Root Directory in Vercel Dashboard (Required)

**This is the ONLY solution that works reliably.**

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **General**
3. Scroll to **Root Directory**
4. Set Root Directory to: `kidscallhome`
5. Click **Save**
6. The `vercel.json` in `kidscallhome/` will be used automatically
7. Build Command will automatically use `npm run build` from `kidscallhome/package.json`
8. Output Directory will automatically be `dist`

**After this change:**
- Vercel will use `kidscallhome/` as the project root
- Build command: `npm run build` (runs `vite build`)
- Output directory: `dist`
- No more recursive loops!
- No more "directory not found" errors!

**Important:** If you see "Failed to fetch one or more git submodules" warning:

This warning appears because `kidscallhome/kidscallhome` is configured as a git submodule. To suppress this warning:

1. Go to **Settings** → **Git**
2. Find **Submodules** section
3. Toggle **"Skip Git Submodules"** to **ON**
4. Click **Save**

**Note:** This warning is harmless and won't affect your build. The submodule isn't needed for the Vercel deployment. However, disabling submodule fetching will suppress the warning and speed up deployments slightly.

## Verification

After applying the fix, your build should show:
```
> kids-call-home@1.0.0-beta build
> vite build
```

Instead of the recursive loop.

## Files Changed

- `package.json` (root) - Updated scripts to use `npm --prefix` instead of `cd` commands (for local development)
- Root `vercel.json` removed - Not needed when root directory is set correctly

## Next Steps

1. **Set Root Directory in Vercel Dashboard to `kidscallhome`** (Required)
2. Trigger a new deployment
3. Verify the build completes successfully
4. The `kidscallhome/vercel.json` will be used automatically

## Why This Approach?

- Vercel automatically uses the `vercel.json` in the root directory you specify
- `kidscallhome/vercel.json` already has all the correct configuration
- No need for complex conditional logic in build commands
- Cleaner and more maintainable configuration


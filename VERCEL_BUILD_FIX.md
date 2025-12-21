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

### Option 1: Configure Root Directory in Vercel Dashboard (Recommended)

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

### Option 2: Use Root-Level vercel.json (Alternative)

If you can't change the Root Directory setting, the root-level `vercel.json` has been updated to:
- Use subshells `(cd kidscallhome && ...)` to prevent npm from resolving parent directories
- Explicitly set build and install commands
- Specify output directory as `kidscallhome/dist`

This should prevent the recursive loop, but **Option 1 is still recommended** for cleaner configuration.

## Verification

After applying the fix, your build should show:
```
> kids-call-home@1.0.0-beta build
> vite build
```

Instead of the recursive loop.

## Files Changed

- `vercel.json` (root) - Added build configuration with subshell commands
- `package.json` (root) - Updated scripts to use `npm --prefix` instead of `cd` commands

## Next Steps

1. **Set Root Directory in Vercel Dashboard** (Option 1 - Recommended)
2. Or commit and push the updated `vercel.json` (Option 2)
3. Trigger a new deployment
4. Verify the build completes successfully


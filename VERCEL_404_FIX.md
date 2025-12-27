# Vercel 404 Errors Fix Guide

## Problem

Getting 404 errors when deploying to Vercel, but the app works locally.

## Common Causes

### 1. Output Directory Not Set Correctly

**Check in Vercel Dashboard:**

1. Go to **Settings** → **General**
2. Verify **Output Directory** is set to: `dist`
3. Verify **Root Directory** is set to: `kidscallhome`

**If Output Directory is wrong:**

- Vercel won't find your built files
- All requests will return 404

### 2. Build Output Missing Files

**Check build locally:**

```bash
cd kidscallhome
npm run build
ls -la dist/
```

**Verify these files exist in `dist/`:**

- `index.html`
- `assets/` directory with JS and CSS files
- `manifest.json`
- `sw.js` (if PWA is enabled)
- `favicon.ico`
- Icon files (`icon-*.png`, `icon-*.webp`)

### 3. Rewrite Rule Catching Static Files

The `vercel.json` has been updated to exclude all static file extensions from the SPA rewrite. The rewrite rule now excludes:

- All file extensions: `.js`, `.css`, `.png`, `.jpg`, `.svg`, `.woff2`, `.json`, `.xml`, `.txt`, `.html`, `.map`, etc.
- Specific paths: `/assets/`, `/api/`, `manifest.json`, `sw.js`, etc.

### 4. Service Worker Registration Issues

If you see 404s for `sw.js` or `notification-handlers.js`:

**Check:**

1. These files should be in `public/` directory (copied to `dist/` during build)
2. Verify they're not being excluded by `.gitignore`
3. Check browser console for specific 404 URLs

### 5. Assets Path Issues

If you see 404s for files in `/assets/`:

**Check:**

1. Vite builds assets to `dist/assets/` by default
2. The rewrite rule excludes `/assets/` from SPA routing
3. Verify `dist/assets/` contains your JS/CSS files after build

## Debugging Steps

### Step 1: Check Vercel Build Logs

1. Go to Vercel Dashboard → Your Deployment
2. Click on the failed/successful build
3. Check the build output for:
   - "Build completed successfully"
   - "Output Directory: dist"
   - Any warnings about missing files

### Step 2: Check Browser Console

1. Open your deployed site
2. Open browser DevTools → Console
3. Look for specific 404 errors:
   - Which files are 404ing?
   - What are their full URLs?
   - Are they in `/assets/`, root, or other paths?

### Step 3: Verify Build Output

**Local test:**

```bash
cd kidscallhome
npm run build
# Check if dist/ directory has all expected files
ls -R dist/
```

**Common missing files:**

- `index.html` - Should be in `dist/index.html`
- `assets/*.js` - Should be in `dist/assets/`
- `assets/*.css` - Should be in `dist/assets/`
- `manifest.json` - Should be in `dist/manifest.json`
- `favicon.ico` - Should be in `dist/favicon.ico`

### Step 4: Check Vercel Configuration

**In Vercel Dashboard → Settings → General:**

| Setting              | Expected Value                  |
| -------------------- | ------------------------------- |
| **Root Directory**   | `kidscallhome`                  |
| **Output Directory** | `dist`                          |
| **Build Command**    | `npm run build` (auto-detected) |
| **Install Command**  | `npm ci` (auto-detected)        |
| **Framework Preset** | Vite (auto-detected)            |

## Solutions

### Solution 1: Fix Output Directory

If Output Directory is wrong:

1. Go to **Settings** → **General**
2. Set **Output Directory** to: `dist`
3. Save and redeploy

### Solution 2: Verify Build Command

The build command should be:

```bash
npm run build
```

This runs `vite build` which outputs to `dist/` directory.

### Solution 3: Check File Paths in Code

If specific files are 404ing, check how they're referenced:

**In `index.html`:**

```html
<!-- Should use relative paths -->
<link rel="icon" href="/favicon.ico" />
<link rel="manifest" href="/manifest.json" />
```

**In JavaScript:**

```javascript
// Vite handles asset imports automatically
import logo from "/src/assets/logo.png"; // ✅ Correct
import logo from "./assets/logo.png"; // ✅ Also correct
```

### Solution 4: Clear Vercel Cache

If files exist but still 404:

1. Go to **Settings** → **General**
2. Scroll to **Clear Build Cache**
3. Click **Clear** and redeploy

## Updated vercel.json

The `vercel.json` has been updated with improved rewrite rules that:

- Exclude all static file extensions from SPA routing
- Explicitly handle `/assets/` directory
- Exclude API routes, service workers, and manifest files
- Only rewrite non-file routes to `/index.html` for SPA routing

## Verification

After fixing, your deployment should:

1. ✅ Build successfully
2. ✅ Serve static assets (JS, CSS, images) correctly
3. ✅ Serve `index.html` for all routes (SPA routing)
4. ✅ No 404 errors in browser console
5. ✅ App loads and routes work correctly

## Still Having Issues?

If 404s persist after checking all above:

1. **Check specific 404 URLs** in browser console
2. **Verify files exist** in Vercel deployment artifacts
3. **Check Vercel build logs** for any warnings
4. **Compare local build** (`npm run build`) with Vercel build output

Common issues:

- Files excluded by `.gitignore` won't be in deployment
- Build output directory mismatch
- Incorrect file paths in code
- Service worker caching old 404s (clear browser cache)





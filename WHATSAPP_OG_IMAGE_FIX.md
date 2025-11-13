# Fixing WhatsApp Open Graph Image

## Issue

The Open Graph image isn't showing in WhatsApp link previews even though the domain is live.

## Why This Happens

WhatsApp aggressively caches link previews. Even after you fix the Open Graph meta tags, WhatsApp may continue showing the old cached version.

## Solution: Clear WhatsApp's Cache

### Step 1: Verify the Image is Accessible

✅ The image is accessible at: `https://www.kidscallhome.com/og-image.png`

### Step 2: Use Facebook's Sharing Debugger

Facebook's debugger tool also clears WhatsApp's cache (WhatsApp uses Facebook's infrastructure):

1. Go to: **https://developers.facebook.com/tools/debug/**
2. Enter your URL: `https://www.kidscallhome.com`
3. Click **"Scrape Again"** or **"Debug"**
4. This will:
   - Fetch the latest version of your page
   - Show you what meta tags WhatsApp sees
   - Clear the cache for both Facebook and WhatsApp

### Step 3: Verify the Meta Tags

After scraping, check that the debugger shows:

- `og:image` = `https://www.kidscallhome.com/og-image.png`
- `og:image:width` = `1200`
- `og:image:height` = `630`
- `og:image:type` = `image/png`

### Step 4: Test in WhatsApp

1. After clearing the cache, wait 1-2 minutes
2. Try sharing the link in WhatsApp again
3. The preview should now show your custom image

## Alternative: Add Cache-Busting Query Parameter

If the debugger doesn't work, you can temporarily add a query parameter to force WhatsApp to fetch a fresh version:

```
https://www.kidscallhome.com/?v=1
```

Then update the og:image URL to include the version parameter (temporarily).

## Verify Your HTML

You can check what WhatsApp sees by viewing the page source:

1. Visit: `https://www.kidscallhome.com`
2. View page source (Ctrl+U or Cmd+Option+U)
3. Search for `og:image`
4. It should show: `<meta property="og:image" content="https://www.kidscallhome.com/og-image.png" />`

## Image Requirements for WhatsApp

- **Minimum size**: 200x200 pixels
- **Recommended size**: 1200x630 pixels (your image is this size ✅)
- **Maximum size**: 8MB
- **Format**: JPG or PNG (you're using PNG ✅)
- **Aspect ratio**: 1.91:1 (1200x630 = 1.91:1 ✅)

## Troubleshooting

### Image still not showing?

1. **Check image accessibility**: Make sure the image URL is publicly accessible (no authentication required)
2. **Check HTTPS**: WhatsApp requires HTTPS (you have this ✅)
3. **Check file size**: Your image is 682KB, which is well under the 8MB limit ✅
4. **Wait longer**: Sometimes it takes 10-15 minutes for WhatsApp to update the cache
5. **Try different device**: Clear cache on the device you're testing with

### Still having issues?

- Verify the Vite build process is correctly replacing `{{OG_IMAGE_URL}}` with the production URL
- Check Vercel build logs to ensure the production build is using the correct mode
- Ensure the `og-image.png` file is in the `public/` folder and being deployed

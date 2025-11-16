# WhatsApp Link Preview Troubleshooting

## Issue: Image and Description Not Showing in WhatsApp

WhatsApp caches link previews more aggressively than Facebook. If the image and description aren't showing, try these steps:

## Step 1: Clear WhatsApp's Cache via Facebook Debugger

Even though it's called "Facebook Debugger," it also clears WhatsApp's cache:

1. Go to: **https://developers.facebook.com/tools/debug/**
2. Enter your URL: `https://www.kidscallhome.com`
3. Click **"Scrape Again"** - This forces both Facebook and WhatsApp to fetch fresh data
4. Wait 1-2 minutes
5. Try sharing the link in WhatsApp again

## Step 2: Use a Cache-Busting URL

Temporarily add a query parameter to force WhatsApp to fetch a new version:

1. Share this URL in WhatsApp: `https://www.kidscallhome.com/?v=2`
2. This forces WhatsApp to treat it as a "new" URL and fetch fresh data

## Step 3: Verify Image Accessibility

WhatsApp's crawler needs to access the image without authentication. Verify:

```bash
curl -I https://www.kidscallhome.com/og-image.png
```

Should return:
- `HTTP/1.1 200 OK`
- `Content-Type: image/png`
- No authentication required

## Step 4: Check Image Requirements

WhatsApp has specific requirements:
- ✅ **Size**: 1200x630px (your image meets this)
- ✅ **Format**: PNG or JPG (you're using PNG)
- ✅ **File size**: Under 8MB (your image is 682KB)
- ✅ **HTTPS**: Required (you have this)
- ✅ **Accessible**: No login required (should be public)

## Step 5: Wait for Cache to Expire

WhatsApp can cache previews for:
- **24-48 hours** for unchanged URLs
- **Immediately** after using Facebook Debugger's "Scrape Again"

## Step 6: Test on Different Devices

Sometimes the cache is device-specific:
1. Try sharing on a different phone
2. Try sharing in a different WhatsApp chat
3. Clear WhatsApp's cache on your device (if possible)

## Step 7: Verify Meta Tags

Make sure all required tags are present:

```html
<meta property="og:title" content="Kids Call Home" />
<meta property="og:description" content="..." />
<meta property="og:image" content="https://www.kidscallhome.com/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/png" />
<meta property="og:url" content="https://www.kidscallhome.com" />
```

## Common Issues

### Description Missing
- WhatsApp may truncate long descriptions
- Ensure description is under 200 characters (yours is fine)
- Make sure there are no special characters breaking the HTML

### Image Not Showing
- Image must be publicly accessible (no login)
- Image must be served over HTTPS
- Image must have correct Content-Type header
- Image URL must be absolute (not relative)

### Still Not Working?
1. Wait 24-48 hours for cache to expire naturally
2. Use Facebook Debugger multiple times (sometimes takes 2-3 scrapes)
3. Try sharing a completely new URL with a query parameter
4. Verify the image loads in a browser: `https://www.kidscallhome.com/og-image.png`

## Quick Test

To test if WhatsApp can see your page:
1. Share: `https://www.kidscallhome.com/?test=1`
2. If this works but the main URL doesn't, it's a caching issue
3. Use Facebook Debugger on the main URL to clear cache


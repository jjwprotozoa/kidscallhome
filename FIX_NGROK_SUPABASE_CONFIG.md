# Fix ngrok + Supabase Configuration

## The Problem
The app works on `localhost:8080` but fails on `https://a2f12a696217.ngrok-free.app` because Supabase needs to know about the ngrok URL for authentication redirects.

## Solution: Add ngrok URL to Supabase Redirect URLs

### Step 1: Go to Supabase Dashboard
1. Open: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt
2. Go to **Authentication** → **URL Configuration**

### Step 2: Add ngrok URL to Site URL
In the **Site URL** field, add your ngrok URL:
```
https://a2f12a696217.ngrok-free.app
```

### Step 3: Add ngrok URL to Redirect URLs
In the **Redirect URLs** section, add these URLs (one per line):
```
https://a2f12a696217.ngrok-free.app/**
http://localhost:8080/**
https://www.kidscallhome.com/**
```

The `/**` wildcard allows all paths under that domain.

### Step 4: Save Changes
Click **Save** at the bottom of the page.

### Step 5: Restart Your Dev Server
After saving, restart your Vite dev server:
```bash
npm run dev
```

## Important Notes

1. **ngrok URL Changes**: If you restart ngrok and get a new URL, you'll need to update the Supabase redirect URLs again. Free ngrok accounts get a new random URL each time.

2. **For Fixed ngrok URLs**: If you upgrade to a paid ngrok plan with a fixed domain, you only need to configure it once.

3. **Multiple Environments**: You can add multiple redirect URLs, so you can have both localhost and ngrok URLs configured at the same time.

## Alternative: Use Environment Variable for Dynamic Redirects

If you want the app to automatically use the current origin for redirects, you can update the Supabase client configuration to use `window.location.origin` dynamically. However, Supabase still needs the URL in the allowed list.

## Testing

After configuring:
1. Access `https://a2f12a696217.ngrok-free.app/child/dashboard`
2. Try logging in as a child
3. Try making a call
4. Check browser console for any CORS or redirect errors

If you still see errors, check:
- Browser console for specific error messages
- Network tab to see if requests are being blocked
- Supabase logs in the dashboard for authentication errors


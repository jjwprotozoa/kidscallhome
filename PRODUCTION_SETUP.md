# Production Setup Guide for Incoming Call Notifications

## Issue

Incoming call notifications work in development but not in production. This is typically due to Supabase realtime configuration or environment variable issues.

## Required Environment Variables

Ensure these environment variables are set in your production deployment platform (Vercel, Netlify, etc.):

```env
VITE_SUPABASE_URL=https://itmhojbjfacocrpmslmt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

## Supabase Dashboard Configuration

### 1. Add Production URL to Supabase Redirect URLs

1. Go to: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt
2. Navigate to **Authentication** → **URL Configuration**
3. Add your production domain to **Redirect URLs**:

   ```
   https://www.kidscallhome.com/**
   https://kidscallhome.com/**
   ```

   (Replace with your actual production domain)

4. Set **Site URL** to your production domain:
   ```
   https://www.kidscallhome.com
   ```

### 2. Enable Realtime for Calls Table

1. Go to **Database** → **Replication** in Supabase Dashboard
2. Ensure the `calls` table has replication enabled:
   - Find `calls` table in the list
   - Toggle **Enable Realtime** to ON
   - This allows Supabase realtime to send INSERT/UPDATE events

### 3. Verify RLS Policies

Ensure Row Level Security (RLS) policies allow realtime subscriptions:

1. Go to **Database** → **Policies** in Supabase Dashboard
2. Check that policies exist for:
   - `calls` table
   - Users can read their own calls (based on `parent_id` or `child_id`)

## Code Changes Made

The Supabase client has been updated to explicitly enable realtime:

```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { ... },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'x-client-info': 'kidscallhome-web',
    },
  },
});
```

## Deployment Platform Configuration

### Vercel

1. Go to your project settings in Vercel
2. Navigate to **Environment Variables**
3. Add:
   - `VITE_SUPABASE_URL` = `https://itmhojbjfacocrpmslmt.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (your anon key)
4. **Important**: After adding variables, redeploy your application

### Netlify

1. Go to **Site settings** → **Environment variables**
2. Add the same variables as above
3. Redeploy after adding variables

## Testing Production

After deploying:

1. Open browser console (F12) on production site
2. Navigate to parent or child dashboard
3. Look for these log messages:

   - `📡 [PARENT DASHBOARD] Setting up realtime subscription for incoming calls`
   - `📡 [PARENT DASHBOARD] Realtime subscription status: SUBSCRIBED`
   - `✅ [PARENT DASHBOARD] Successfully subscribed to incoming calls`

4. If you see `CHANNEL_ERROR` or `TIMED_OUT`, check:
   - Environment variables are set correctly
   - Supabase realtime is enabled for `calls` table
   - Production URL is added to Supabase redirect URLs
   - No firewall/network blocking WebSocket connections

## Troubleshooting

### Subscriptions Not Connecting

1. **Check browser console** for WebSocket errors
2. **Verify environment variables** are set in production
3. **Check Supabase Dashboard** → **Realtime** → **Channels** to see active connections
4. **Test WebSocket connection** manually:
   ```javascript
   // In browser console on production site
   const ws = new WebSocket(
     "wss://itmhojbjfacocrpmslmt.supabase.co/realtime/v1/websocket"
   );
   ws.onopen = () => console.log("WebSocket connected");
   ws.onerror = (e) => console.error("WebSocket error", e);
   ```

### Notifications Work in Dev But Not Prod

- **Most common cause**: Environment variables not set in production
- **Second most common**: Realtime not enabled for `calls` table in Supabase
- **Third**: Production URL not in Supabase redirect URLs (affects auth, which affects subscriptions)

## Additional Notes

- The code includes automatic retry logic if subscriptions fail
- Polling fallback (every 30 seconds) ensures notifications work even if realtime fails temporarily
- Check browser console logs for detailed subscription status information

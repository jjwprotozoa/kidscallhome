# Cloudflare TURN Server Setup Guide

## Overview

This guide explains how to configure Cloudflare TURN servers for reliable WebRTC connections in production. Cloudflare TURN provides temporary credentials that are generated server-side and rotated automatically.

## Prerequisites

1. Cloudflare account with RTC (Real-Time Communication) enabled
2. TURN Key ID and API Token from Cloudflare dashboard
3. Vercel deployment (or compatible serverless platform)

## Setup Steps

### Step 1: Get Cloudflare TURN Credentials

1. **Log in to Cloudflare Dashboard**

   - Go to: https://dash.cloudflare.com/
   - Navigate to: **RTC** → **TURN Keys**

2. **Create or Retrieve TURN Key**
   - Create a new TURN key if you don't have one
   - Note down:
     - **TURN Key ID** (e.g., `abc123def456...`)
     - **TURN Key API Token** (keep this secret!)

### Step 2: Configure Environment Variables

In your Vercel project settings (or deployment platform):

1. **Go to Project Settings** → **Environment Variables**
2. **Add the following variables:**

   ```env
   TURN_KEY_ID=your_turn_key_id_here
   TURN_KEY_API_TOKEN=your_turn_key_api_token_here
   VITE_USE_CLOUDFLARE_TURN=true
   ```

   **Important:**

   - `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` are **server-side only** (not prefixed with `VITE_`)
   - `VITE_USE_CLOUDFLARE_TURN` is **client-side** (prefixed with `VITE_`) and enables Cloudflare TURN

3. **Apply to Environment:**
   - Select: **Production**, **Preview**, and **Development** (as needed)
   - Click **Save**

### Step 3: Deploy

1. **Commit and push your changes:**

   ```bash
   git add api/turn-credentials.ts src/features/calls/hooks/useWebRTC.ts
   git commit -m "Add Cloudflare TURN server support"
   git push
   ```

2. **Vercel will automatically deploy** the new API endpoint

3. **Verify deployment:**
   - Check Vercel dashboard for successful deployment
   - Test the API endpoint: `https://your-domain.com/api/turn-credentials` (should return credentials)

## How It Works

### Architecture

1. **Client Request**: When a call is initiated, the WebRTC hook checks if `VITE_USE_CLOUDFLARE_TURN=true`
2. **API Call**: Client makes POST request to `/api/turn-credentials`
3. **Server-Side**: API endpoint:
   - Uses `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` (server-side secrets)
   - Calls Cloudflare API to generate temporary credentials (24-hour TTL)
   - Returns credentials to client
4. **Client Configuration**: WebRTC uses returned credentials to configure TURN servers

### Security

- ✅ **TURN credentials never exposed**: API keys stay server-side
- ✅ **Temporary credentials**: Generated per request, expire after 24 hours
- ✅ **HTTPS only**: All communication encrypted
- ✅ **CORS protection**: API endpoint only accessible from your domain

## Testing

### 1. Verify API Endpoint

Test the endpoint directly:

```bash
curl -X POST https://your-domain.com/api/turn-credentials \
  -H "Content-Type: application/json"
```

**Expected Response:**

```json
{
  "iceServers": {
    "urls": [
      "stun:stun.cloudflare.com:3478",
      "turn:turn.cloudflare.com:3478?transport=udp",
      "turn:turn.cloudflare.com:3478?transport=tcp",
      "turns:turn.cloudflare.com:5349?transport=tcp"
    ],
    "username": "temporary-username",
    "credential": "temporary-credential"
  }
}
```

### 2. Test Call Connection

1. **Initiate a call** between two devices
2. **Check browser console** for:
   - `🌐 [WEBRTC] Fetching Cloudflare TURN credentials...`
   - `✅ [WEBRTC] Using Cloudflare TURN servers`
   - `✅ [ICE STATE] ICE CONNECTED - Media should flow now`

### 3. Verify Connection Quality

- **Check connection state**: Should see `connected` or `completed`
- **Test on different networks**: Mobile, Wi-Fi, corporate networks
- **Monitor logs**: Look for TURN server usage in connection diagnostics

## Troubleshooting

### Issue: "Failed to fetch TURN credentials"

**Possible Causes:**

1. Environment variables not set in Vercel
2. API endpoint not deployed
3. Cloudflare credentials invalid

**Solutions:**

1. Verify environment variables in Vercel dashboard
2. Check deployment logs for API endpoint errors
3. Verify Cloudflare TURN Key ID and API Token are correct

### Issue: "Using free public TURN servers" (in production)

**Cause:** `VITE_USE_CLOUDFLARE_TURN` not set to `true`

**Solution:** Set `VITE_USE_CLOUDFLARE_TURN=true` in environment variables

### Issue: Calls still not connecting

**Check:**

1. Browser console for ICE connection errors
2. Network tab for `/api/turn-credentials` request status
3. Cloudflare dashboard for TURN key usage/quota

**Common Issues:**

- TURN key expired or revoked
- API token incorrect
- Network blocking TURN traffic (corporate firewalls)

## Fallback Behavior

The system has multiple fallback levels:

1. **Cloudflare TURN** (if `VITE_USE_CLOUDFLARE_TURN=true`)
2. **Environment Variables** (if `VITE_TURN_SERVERS` set)
3. **Free Public TURN** (development only, with warnings)

## Monitoring

### Key Logs to Monitor

- `🌐 [WEBRTC] Fetching Cloudflare TURN credentials...` - Credential fetch started
- `✅ [WEBRTC] Using Cloudflare TURN servers` - Successfully configured
- `❌ [WEBRTC] Failed to get Cloudflare TURN credentials` - Fallback triggered
- `⚠️ [WEBRTC] WARNING: Using free public TURN servers` - Configuration issue

### Metrics to Track

- API endpoint response time
- Credential generation success rate
- Connection success rate with Cloudflare TURN
- Fallback usage frequency

## Cost Considerations

- **Cloudflare TTC**: Pay-per-use pricing
- **Credential Generation**: Free (API calls)
- **TURN Usage**: Billed based on bandwidth/data transfer

Check Cloudflare dashboard for usage and billing details.

## Additional Resources

- [Cloudflare RTC Documentation](https://developers.cloudflare.com/rtc/)
- [WebRTC TURN Server Guide](https://webrtc.org/getting-started/turn-server)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)

## Support

If you encounter issues:

1. Check browser console logs
2. Review Vercel function logs
3. Verify Cloudflare dashboard for TURN key status
4. Test API endpoint directly with curl


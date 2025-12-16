# Call Connection Fixes - Production TURN Server Configuration

## Problem

Calls in production were not connecting reliably. Investigation revealed that the app was using free public TURN servers (`openrelay.metered.ca`) which are not reliable for production use, especially on mobile networks where both peers are often behind symmetric NATs.

## Root Cause

1. **Unreliable TURN Servers**: Free public TURN servers have rate limits and may be unavailable or slow
2. **No Production Configuration**: No way to configure production-grade TURN servers via environment variables
3. **Limited Error Diagnostics**: Insufficient logging to diagnose connection failures

## Solution

### 1. Environment Variable Support for TURN Servers

The WebRTC configuration now supports production TURN servers via environment variables:

```env
# Production TURN server configuration
VITE_TURN_SERVERS=turn:your-turn-server.com:3478,turn:your-turn-server.com:5349
VITE_TURN_USERNAME=your_username
VITE_TURN_CREDENTIAL=your_credential
```

**Multiple TURN servers**: Use comma-separated URLs for redundancy.

### 2. Enhanced Error Diagnostics

Added comprehensive logging for:

- ICE connection state changes
- ICE candidate errors (TURN server failures)
- Connection failure diagnostics
- TURN server configuration warnings

### 3. Fallback Behavior

- **Development**: Uses free public TURN servers (with warning)
- **Production without env vars**: Uses free public TURN servers (with ERROR log)
- **Production with env vars**: Uses configured production TURN servers

## Implementation Details

### Files Modified

- `src/features/calls/hooks/useWebRTC.ts`
  - Added environment variable support for TURN servers
  - Added `onicecandidateerror` handler for TURN server diagnostics
  - Enhanced connection failure diagnostics
  - Added production warnings when TURN servers aren't configured

### Configuration Priority

1. **Environment Variables** (if set): Uses production TURN servers
2. **Fallback**: Uses free public TURN servers (with warnings)

## Setup Instructions

### Option 1: Cloudflare TURN (Recommended)

Cloudflare TURN provides temporary credentials that are generated server-side and rotated automatically.

**See:** [`docs/CLOUDFLARE_TURN_SETUP.md`](./CLOUDFLARE_TURN_SETUP.md) for complete setup instructions.

**Quick Setup:**

1. Get Cloudflare TURN Key ID and API Token from Cloudflare dashboard
2. Set environment variables:
   ```env
   TURN_KEY_ID=your_turn_key_id
   TURN_KEY_API_TOKEN=your_turn_key_api_token
   VITE_USE_CLOUDFLARE_TURN=true
   ```
3. Deploy - the API endpoint (`/api/turn-credentials`) will automatically generate credentials

**Benefits:**

- ✅ Automatic credential rotation (24-hour TTL)
- ✅ Server-side credential generation (more secure)
- ✅ No need to manage static credentials
- ✅ Built-in Cloudflare infrastructure

### Option 2: Static TURN Servers (Environment Variables)

1. **Get TURN Server Credentials**

   - Recommended: [Metered TURN](https://www.metered.ca/tools/openrelay/) (paid, reliable)
   - Alternative: [Twilio STUN/TURN](https://www.twilio.com/stun-turn) (paid)
   - Alternative: Self-hosted [coturn](https://github.com/coturn/coturn) server

2. **Set Environment Variables**

   In your deployment platform (Vercel, Netlify, etc.):

   ```env
   VITE_TURN_SERVERS=turn:your-turn-server.com:3478,turn:your-turn-server.com:5349
   VITE_TURN_USERNAME=your_username
   VITE_TURN_CREDENTIAL=your_credential
   ```

   **Note**: For multiple TURN servers, use comma-separated URLs.

3. **Verify Configuration**

   Check browser console logs:

   - Should see: `🌐 [WEBRTC] Using production TURN servers from environment variables`
   - Should NOT see: `⚠️ [WEBRTC] WARNING: Using free public TURN servers in production!`

### For Development

No changes needed - free public TURN servers are used automatically with a development-mode log message.

## Testing

### Test Connection Success

1. Initiate a call between two devices
2. Check browser console for:
   - `✅ [ICE STATE] ICE CONNECTED - Media should flow now`
   - `✅ [CONNECTION STATE] CONNECTED - Peer connection established`

### Test Connection Failures

If calls fail to connect:

1. **Check TURN Server Configuration**

   - Look for: `⚠️ [WEBRTC] WARNING: Using free public TURN servers in production!`
   - If present, set environment variables

2. **Check ICE Candidate Errors**

   - Look for: `⚠️ [ICE CANDIDATE ERROR] ICE candidate gathering error`
   - Check `errorCode` and `url` fields
   - TURN server errors (errorCode 701) indicate TURN server issues

3. **Check Connection Diagnostics**
   - Look for: `❌ [ICE STATE] Connection failure detected - diagnostics`
   - Review `turnServersConfigured` count
   - Review `localCandidates` and `remoteCandidates` counts

## Troubleshooting

### Calls Still Not Connecting

1. **Verify Environment Variables**

   - Check deployment platform environment variables
   - Ensure variables start with `VITE_` prefix
   - Rebuild/redeploy after setting variables

2. **Check TURN Server Status**

   - Test TURN server connectivity
   - Verify credentials are correct
   - Check TURN server logs for errors

3. **Network Issues**

   - Both peers behind restrictive NATs may need TURN servers
   - Mobile networks often require TURN servers
   - Corporate networks may block STUN/TURN traffic

4. **Browser Compatibility**
   - Ensure browsers support WebRTC
   - Check for browser-specific WebRTC restrictions
   - Test in multiple browsers

## Monitoring

### Key Logs to Monitor

- `🌐 [WEBRTC] Using production TURN servers` - Configuration successful
- `⚠️ [WEBRTC] WARNING: Using free public TURN servers` - Configuration issue
- `❌ [ICE STATE] Connection failure detected` - Connection problem
- `⚠️ [ICE CANDIDATE ERROR]` - TURN server connectivity issue

### Metrics to Track

- Connection success rate
- Average time to connect
- ICE candidate error frequency
- TURN server usage vs STUN-only connections

## Additional Notes

- **STUN servers**: Always included (Google's public STUN servers)
- **TURN servers**: Required for reliable connections on mobile/corporate networks
- **ICE candidate pooling**: Enabled (`iceCandidatePoolSize: 10`) for faster connections
- **Error recovery**: Automatic call termination after connection failures

## References

- [WebRTC TURN Server Guide](https://webrtc.org/getting-started/turn-server)
- [Metered TURN](https://www.metered.ca/tools/openrelay/)
- [Twilio STUN/TURN](https://www.twilio.com/stun-turn)
- [coturn Server](https://github.com/coturn/coturn)

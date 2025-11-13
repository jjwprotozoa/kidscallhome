# ngrok Setup Guide for iPhone Testing

This guide will help you configure ngrok to access your local development server on your iPhone.

## Prerequisites

1. **Install ngrok**: Download and install ngrok from [ngrok.com](https://ngrok.com/download)
2. **Create a free ngrok account**: Sign up at [ngrok.com](https://dashboard.ngrok.com/signup) (free tier is sufficient)
3. **Get your authtoken**: After signing up, copy your authtoken from the [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)

## Setup Steps

### 1. Configure ngrok

1. If `ngrok.yml` doesn't exist, copy the example file:

   ```bash
   cp ngrok.yml.example ngrok.yml
   ```

2. Open `ngrok.yml` in the project root
3. Replace `YOUR_NGROK_AUTH_TOKEN_HERE` with your actual ngrok authtoken from the dashboard

### 2. Start Your Development Server

In one terminal window, start your Vite dev server:

```bash
npm run dev
```

The server should start on `http://localhost:8080`

### 3. Start ngrok Tunnel

In a **second terminal window**, start the ngrok tunnel:

```bash
npm run tunnel
```

Or if you prefer to use ngrok directly:

```bash
ngrok start dev-server --config ngrok.yml
```

### 4. Access from iPhone

After starting ngrok, you'll see output like:

```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:8080
```

1. Copy the **HTTPS URL** (starts with `https://`)
2. Open Safari on your iPhone
3. Paste the URL and navigate to it
4. You may need to click "Visit Site" if ngrok shows a warning page (this is normal for free accounts)

## Important Notes

- **HTTPS Required**: iOS requires HTTPS for many web features (camera, microphone, etc.), so the ngrok config uses `bind_tls: true` to provide HTTPS
- **URL Changes**: Free ngrok accounts get a new random URL each time you restart ngrok. For a fixed URL, upgrade to a paid plan
- **Keep Both Running**: You need both the dev server (`npm run dev`) and ngrok (`npm run tunnel`) running simultaneously
- **WebRTC/Video Calls**: If you're testing video calls, make sure both devices are on the same network or use ngrok's HTTPS URL for proper WebRTC signaling

## Troubleshooting

### ngrok command not found

- Make sure ngrok is installed and in your PATH
- On Windows, you may need to restart your terminal after installation

### Connection refused

- Ensure your dev server is running on port 8080
- Check that `vite.config.ts` has `host: "0.0.0.0"` (already configured)

### HTTPS certificate warnings

- This is normal with free ngrok accounts
- Click "Visit Site" to proceed
- For production, consider using a paid ngrok plan with custom domains

### WebRTC not working

- Ensure you're using the HTTPS URL (not HTTP)
- Check browser console for WebRTC errors
- Some features may require both devices to be on the same network

## Alternative: Quick Start (Without Config File)

If you prefer not to use the config file, you can run ngrok directly:

```bash
ngrok http 8080 --bind-tls=true
```

This will give you an HTTPS URL you can use on your iPhone.

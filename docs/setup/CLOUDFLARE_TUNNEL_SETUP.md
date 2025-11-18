# Cloudflare Tunnel Setup Guide

This guide explains how to run both the local development server and Cloudflare tunnel simultaneously, with the ability to restart them independently.

## Prerequisites

1. **Install Cloudflare Tunnel (cloudflared)**:

   - Download from [Cloudflare Zero Trust](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)
   - Or use package manager:
     - **Windows**: `winget install --id Cloudflare.cloudflared` or download from [GitHub Releases](https://github.com/cloudflare/cloudflared/releases)
     - **macOS**: `brew install cloudflared`
     - **Linux**: Download from [GitHub Releases](https://github.com/cloudflare/cloudflared/releases)

2. Verify installation:
   ```bash
   cloudflared --version
   ```

## Running Servers Independently

### Option 0: Quick Start Script (Easiest)

We provide helper scripts that open both servers in separate windows:

**Windows (PowerShell):**

```powershell
.\scripts\start-dev-with-cloudflare.ps1
```

**Linux/macOS:**

```bash
./scripts/start-dev-with-cloudflare.sh
```

This opens two separate terminal windows - one for each server. You can close/restart them independently.

### Option 1: Separate Terminal Windows (Recommended)

This approach gives you full control over each process:

#### Terminal 1: Local Development Server

```bash
npm run dev:local
```

This starts the Vite dev server on `http://localhost:8080`. You can stop/restart this independently.

#### Terminal 2: Cloudflare Tunnel

```bash
npm run tunnel:cloudflare
```

This starts the Cloudflare tunnel pointing to your local server. It will output a URL like:

```
https://random-subdomain.trycloudflare.com
```

**Benefits:**

- ✅ Can restart local server without affecting Cloudflare tunnel
- ✅ Can restart Cloudflare tunnel without affecting local server
- ✅ Easy to see logs from each process separately
- ✅ Can stop one without stopping the other

### Option 2: Using npm scripts (Separate Processes)

You can also run them directly:

**Terminal 1:**

```bash
npm run dev:local
```

**Terminal 2:**

```bash
cloudflared tunnel --url http://localhost:8080
```

## Workflow Example

1. **Start Cloudflare tunnel first** (Terminal 1):

   ```bash
   npm run tunnel:cloudflare
   ```

   Copy the HTTPS URL it provides (e.g., `https://abc123.trycloudflare.com`)

2. **Start local dev server** (Terminal 2):

   ```bash
   npm run dev:local
   ```

3. **Access your app**:

   - Locally: `http://localhost:8080`
   - Via Cloudflare: Use the URL from Terminal 1

4. **Restart local server** (if needed):

   - In Terminal 2, press `Ctrl+C` to stop
   - Run `npm run dev:local` again
   - Cloudflare tunnel in Terminal 1 keeps running and automatically reconnects

5. **Restart Cloudflare tunnel** (if needed):
   - In Terminal 1, press `Ctrl+C` to stop
   - Run `npm run tunnel:cloudflare` again
   - You'll get a new URL (free tier gives random URLs)

## Important Notes

### Cloudflare Tunnel Behavior

- **Free tier**: Each restart gives you a new random URL
- **Connection**: Cloudflare tunnel automatically reconnects when your local server restarts
- **HTTPS**: Cloudflare tunnel provides HTTPS automatically (required for iOS testing)

### Local Server Behavior

- **Port**: Runs on port 8080 (configurable in `vite.config.ts`)
- **Hot Reload**: Vite's hot module replacement works normally
- **Restart**: Safe to restart anytime - Cloudflare tunnel will wait and reconnect

### iOS Testing

- Use the Cloudflare HTTPS URL (not localhost)
- The URL changes each time you restart the tunnel (free tier)
- For a persistent URL, consider upgrading to Cloudflare Zero Trust paid plan

## Troubleshooting

### Cloudflare tunnel can't connect

- Ensure local server is running on port 8080
- Check that `vite.config.ts` has `host: "0.0.0.0"` (already configured)

### Port already in use

- Change port in `vite.config.ts` or use `--port` flag:
  ```bash
  npm run dev:local -- --port 3000
  ```
- Update Cloudflare tunnel command:
  ```bash
  cloudflared tunnel --url http://localhost:3000
  ```

### Cloudflare tunnel keeps disconnecting

- This is normal - it reconnects automatically when local server restarts
- If it doesn't reconnect, restart the tunnel manually

## Comparison: Cloudflare vs ngrok

| Feature       | Cloudflare Tunnel                   | ngrok                         |
| ------------- | ----------------------------------- | ----------------------------- |
| Free tier URL | Random (changes each restart)       | Random (changes each restart) |
| HTTPS         | ✅ Yes                              | ✅ Yes                        |
| Setup         | Simple (`cloudflared tunnel --url`) | Requires config file          |
| Reconnection  | Automatic                           | Automatic                     |
| Best for      | Quick testing, iOS development      | Persistent URLs (paid)        |

Both work well for development. Choose based on your preference or existing setup.

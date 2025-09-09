# Vercel Deployment Guide

## Overview

This guide will help you deploy the Kids Call Home app to Vercel with real-time WebRTC calling functionality using Pusher.

## Prerequisites

1. Vercel account
2. Pusher account
3. Git repository with your code

## Step 1: Set up Pusher

1. Go to [Pusher.com](https://pusher.com) and create an account
2. Create a new app with the following settings:

   - **App name**: `kids-call-home`
   - **Cluster**: Choose the closest to your users (e.g., `us2`, `eu`, `ap-southeast-1`)
   - **Front-end tech**: React
   - **Back-end tech**: Node.js

3. Note down your Pusher credentials:
   - App ID
   - Key
   - Secret
   - Cluster

## Step 2: Deploy to Vercel

### Option A: Deploy from Git (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your Git repository
5. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (or leave empty)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Option B: Deploy with Vercel CLI

1. Install Vercel CLI:

   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:

   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

## Step 3: Configure Environment Variables

In your Vercel dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add the following variables:

### Frontend Variables (VITE\_\*)

- `VITE_PUSHER_KEY`: Your Pusher key
- `VITE_PUSHER_CLUSTER`: Your Pusher cluster (e.g., `us2`)

### Backend Variables (for API functions)

- `PUSHER_APP_ID`: Your Pusher app ID
- `PUSHER_KEY`: Your Pusher key
- `PUSHER_SECRET`: Your Pusher secret
- `PUSHER_CLUSTER`: Your Pusher cluster

## Step 4: Test the Deployment

1. Visit your deployed app URL
2. Open two browser tabs/windows
3. In one tab, log in as a guardian
4. In another tab, log in as a child
5. Try initiating a call from one dashboard to the other
6. Verify that the incoming call notification appears

## Architecture

```
Frontend (React) → Vercel Hosting
     ↓
Pusher (Real-time signaling)
     ↓
Vercel Serverless Functions (API)
     ↓
WebRTC (Peer-to-peer media)
```

## Features Implemented

- ✅ Real-time call notifications
- ✅ WebRTC signaling through Pusher
- ✅ Incoming call UI for both dashboards
- ✅ Call acceptance/rejection
- ✅ Voice and video calling support
- ✅ Cross-platform compatibility

## Troubleshooting

### Common Issues

1. **Calls not connecting**: Check that Pusher credentials are correct
2. **No incoming call notifications**: Verify Pusher connection in browser console
3. **WebRTC errors**: Ensure you're using HTTPS (Vercel provides this automatically)
4. **Permission errors**: Test on localhost first, then deploy

### Debug Steps

1. Check browser console for errors
2. Verify Pusher connection status
3. Check Vercel function logs
4. Test with different browsers

## Cost Estimation

- **Vercel**: Free tier includes 100GB bandwidth, 1000 serverless function invocations
- **Pusher**: Free tier includes 200k messages/day, 20 concurrent connections
- **Total**: $0/month for small to medium usage

## Next Steps

1. Set up custom domain (optional)
2. Configure analytics
3. Set up monitoring
4. Implement call history storage
5. Add push notifications for mobile

## Support

For issues with:

- Vercel: Check [Vercel Documentation](https://vercel.com/docs)
- Pusher: Check [Pusher Documentation](https://pusher.com/docs)
- WebRTC: Check [WebRTC Documentation](https://webrtc.org/getting-started/)

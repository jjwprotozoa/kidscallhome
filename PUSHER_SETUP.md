# Pusher Setup Guide

To use real Pusher features (not mock data), you need to set up a Pusher account and get your credentials.

## 1. Create Pusher Account

1. Go to [pusher.com](https://pusher.com)
2. Sign up for a free account
3. Create a new app

## 2. Get Your Credentials

From your Pusher dashboard, you'll need:

- **App Key** (VITE_PUSHER_KEY)
- **Cluster** (VITE_PUSHER_CLUSTER) - usually 'us2', 'eu', 'ap-southeast-1', etc.

## 3. Set Environment Variables

Create a `.env` file in your project root:

```env
VITE_PUSHER_KEY=your_actual_pusher_key_here
VITE_PUSHER_CLUSTER=us2
```

## 4. Restart Development Server

After setting the environment variables:

```bash
npm run dev
```

## 5. Verify Connection

Check the browser console for:

- ✅ "Pusher connection state changed: connecting -> connected"
- ❌ No "Pusher connection error" messages

## Free Tier Limits

Pusher's free tier includes:

- 200,000 messages/day
- 100 concurrent connections
- 1 app

This should be sufficient for development and small-scale testing.

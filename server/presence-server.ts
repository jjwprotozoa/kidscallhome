// server/presence-server.ts
// Optional Redis-based presence server for scalable presence tracking
// This is an optional backend server - the client-side implementation works with Supabase Realtime
// Deploy this if you need Redis-based presence for millions of connections

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  },
});

// Redis client for in-memory presence storage
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

// In-memory presence storage (fallback if Redis unavailable)
const presenceStore = new Map<string, {
  userId: string;
  userType: 'parent' | 'child';
  lastHeartbeat: number;
  isOnline: boolean;
}>();

const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const OFFLINE_THRESHOLD = 180000; // 3 minutes (2-3 intervals)

// Cleanup function to mark users offline after missed heartbeats
setInterval(() => {
  const now = Date.now();
  presenceStore.forEach((presence, userId) => {
    if (presence.isOnline && (now - presence.lastHeartbeat) > OFFLINE_THRESHOLD) {
      presence.isOnline = false;
      // Broadcast offline status
      io.emit('presence:offline', { userId, userType: presence.userType });
    }
  });
}, HEARTBEAT_INTERVAL);

io.on('connection', (socket) => {
  let userId: string | null = null;
  let userType: 'parent' | 'child' | null = null;

  // Handle user connection - send "online" event
  socket.on('presence:connect', async (data: { userId: string; userType: 'parent' | 'child'; name?: string }) => {
    userId = data.userId;
    userType = data.userType;

    // Store in Redis (volatile memory)
    const presenceKey = `presence:${userType}:${userId}`;
    await redis.setex(presenceKey, 180, JSON.stringify({
      userId,
      userType,
      lastHeartbeat: Date.now(),
      isOnline: true,
    }));

    // Also store in memory
    presenceStore.set(userId, {
      userId,
      userType,
      lastHeartbeat: Date.now(),
      isOnline: true,
    });

    // Broadcast online status
    io.emit('presence:online', { userId, userType });

    // Write to database only on login (major state change)
    // This would be a database write here - implement based on your DB setup
    console.log(`[PRESENCE] User ${userId} (${userType}) connected`);
  });

  // Handle heartbeat - update last heartbeat time
  socket.on('presence:heartbeat', async (data: { userId: string; userType: 'parent' | 'child' }) => {
    if (!data.userId) return;

    const presenceKey = `presence:${data.userType}:${data.userId}`;
    const now = Date.now();

    // Update Redis (volatile memory only, no DB write)
    await redis.setex(presenceKey, 180, JSON.stringify({
      userId: data.userId,
      userType: data.userType,
      lastHeartbeat: now,
      isOnline: true,
    }));

    // Update in-memory store
    const presence = presenceStore.get(data.userId);
    if (presence) {
      presence.lastHeartbeat = now;
      presence.isOnline = true;
    }
  });

  // Handle disconnect - send "offline" event
  socket.on('disconnect', async () => {
    if (userId && userType) {
      // Remove from Redis
      const presenceKey = `presence:${userType}:${userId}`;
      await redis.del(presenceKey);

      // Update in-memory store
      const presence = presenceStore.get(userId);
      if (presence) {
        presence.isOnline = false;
      }

      // Broadcast offline status
      io.emit('presence:offline', { userId, userType });

      // Write to database only on logout (major state change)
      console.log(`[PRESENCE] User ${userId} (${userType}) disconnected`);
    }
  });
});

// API endpoint for batch presence status requests (on demand)
app.get('/api/presence/batch', async (req, res) => {
  const userIds = req.query.ids as string[];
  const userType = req.query.type as 'parent' | 'child';

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'Invalid user IDs' });
  }

  const statuses: Record<string, boolean> = {};

  // Fetch from Redis
  for (const userId of userIds) {
    const presenceKey = `presence:${userType}:${userId}`;
    const data = await redis.get(presenceKey);
    
    if (data) {
      const presence = JSON.parse(data);
      const now = Date.now();
      // Check if still online (within threshold)
      statuses[userId] = presence.isOnline && (now - presence.lastHeartbeat) < OFFLINE_THRESHOLD;
    } else {
      statuses[userId] = false;
    }
  }

  res.json({ statuses });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[PRESENCE SERVER] Listening on port ${PORT}`);
});


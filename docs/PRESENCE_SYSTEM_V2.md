# Optimized Presence System V2

## Overview

The presence system has been optimized to minimize server and database usage while maintaining accurate online status tracking. This implementation focuses on efficient resource usage and scalability.

## Key Features

### ✅ Optimized Client-Side Implementation

1. **60-Second Heartbeat**: Heartbeats are sent every 60 seconds (not every few seconds)
2. **Event-Based Updates**: Only sends "online" event on connection and "offline" event on disconnect/app exit
3. **UI Updates Only on Changes**: UI only updates when status actually changes (connected, disconnected, idle)
4. **Minimal Logging**: Reduced console noise, only logs on status changes in development

### ✅ Server-Side Architecture (Optional)

For production deployments requiring Redis-based presence:

- **In-Memory Storage**: Presence status stored in Redis (volatile memory)
- **Database Writes Only on Major Events**: Only writes to database on login, logout, or major state changes
- **Automatic Offline Detection**: Marks users offline after 2-3 missed heartbeats (2-3 minutes)
- **Batch Presence Requests**: On-demand batch status requests for contact/chat lists
- **Scalable**: Designed to handle thousands/millions of connections

## Implementation Details

### Client-Side (Current Implementation)

The client-side implementation uses Supabase Realtime Presence API with optimizations:

```typescript
// Heartbeat every 60 seconds
heartbeatIntervalRef.current = setInterval(() => {
  if (isConnectedRef.current && channelRef.current) {
    channelRef.current.track({
      ...presence,
      lastSeen: new Date().toISOString(),
    });
  }
}, 60000); // 60 seconds
```

**Features:**
- Sends "online" event on WebSocket connection
- Sends "offline" event on disconnect/app exit
- Heartbeat every 60 seconds
- Only updates UI when status changes
- Handles page visibility changes

### Server-Side (Optional Redis-Based)

For deployments requiring Redis-based presence, see `server/presence-server.ts`:

**Features:**
- Redis for volatile in-memory storage
- Automatic cleanup after 2-3 missed heartbeats
- Database writes only on login/logout
- Batch presence API endpoint
- WebSocket-based real-time updates

## Usage

### Client-Side (Current)

```typescript
import { usePresence } from "@/features/presence/usePresence";
import { useChildrenPresence } from "@/features/presence/useChildrenPresence";

// Track own presence
usePresence({
  userId: user.id,
  userType: "parent",
  name: user.name,
  enabled: true,
});

// Track children's presence (parents)
const { isChildOnline } = useChildrenPresence({
  childIds: children.map(c => c.id),
  enabled: true,
  onStatusChange: (childId, isOnline) => {
    // Only called when status actually changes
    console.log(`Child ${childId} is now ${isOnline ? 'online' : 'offline'}`);
  },
});
```

### Server-Side (Optional)

1. **Install Dependencies**:
```bash
npm install express socket.io ioredis
```

2. **Set Environment Variables**:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
CLIENT_URL=http://localhost:8080
PORT=3001
```

3. **Start Server**:
```bash
node server/presence-server.ts
```

4. **Update Client** to connect to presence server (if using server-side)

## Database Writes

Database writes occur only on major state changes:

1. **Login**: When user logs in (write to database)
2. **Logout**: When user logs out (write to database)
3. **Major State Changes**: Significant events (implement as needed)

**Note**: Heartbeats do NOT write to database - they only update in-memory storage (Redis or Supabase Realtime).

## Performance Characteristics

### Current Implementation (Supabase Realtime)

- **Heartbeat Frequency**: Every 60 seconds
- **Database Writes**: Only on login/logout
- **Memory Usage**: Managed by Supabase Realtime
- **Scalability**: Handles thousands of concurrent connections

### Optional Server-Side (Redis)

- **Heartbeat Frequency**: Every 60 seconds
- **Database Writes**: Only on login/logout
- **Memory Usage**: Redis (volatile, expires after 3 minutes)
- **Scalability**: Handles millions of connections with proper Redis setup

## Migration from Old System

The old presence system has been replaced with the optimized version. No changes needed in components - the hooks maintain the same API.

**Changes:**
- Heartbeat interval: 30s → 60s
- Reduced logging
- Only updates UI on status changes
- Better cleanup on disconnect

## Monitoring

### Development

- Check browser console for presence logs (only on status changes)
- Monitor WebSocket connections in browser DevTools

### Production

- Monitor Supabase Realtime connections
- Track heartbeat frequency (should be ~60 seconds)
- Monitor database write frequency (should be minimal, only on login/logout)

## Troubleshooting

### Users Not Showing as Online

1. Check WebSocket connection status
2. Verify presence channel subscription
3. Check if heartbeat is being sent (every 60 seconds)
4. Verify user is actually connected

### Too Many Database Writes

- Ensure database writes only occur on login/logout
- Verify heartbeats are NOT writing to database
- Check for any polling mechanisms that might be writing to DB

### High Server Load

- Verify heartbeat interval is 60 seconds (not faster)
- Check for duplicate presence subscriptions
- Ensure cleanup is happening on disconnect

## Future Enhancements

- [ ] Add idle status detection (no activity for X minutes)
- [ ] Add "last seen" timestamp updates (throttled)
- [ ] Add presence status persistence (optional)
- [ ] Add presence analytics/metrics


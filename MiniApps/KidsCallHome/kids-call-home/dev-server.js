/**
 * Development server for API endpoints
 * Run with: node dev-server.js
 */

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import Pusher from 'pusher';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Real Pusher configuration
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || 'your-pusher-app-id',
  key: process.env.PUSHER_KEY || 'your-pusher-key',
  secret: process.env.PUSHER_SECRET || 'your-pusher-secret',
  cluster: process.env.PUSHER_CLUSTER || 'us2',
  useTLS: true
});

// Helper function to send Pusher event
const sendPusherEvent = async (channel, event, data) => {
  try {
    console.log(`📡 Sending Pusher event: ${event} on ${channel}`, data);
    const result = await pusher.trigger(channel, event, data);
    console.log(`✅ Pusher event sent successfully:`, result);
    return { success: true };
  } catch (error) {
    console.error('Pusher error:', error);
    throw new Error('Failed to send signaling message');
  }
};

// Helper function to validate required fields
const validateFields = (body, requiredFields) => {
  const missing = requiredFields.filter(field => !body[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
};


// API Routes
app.post('/api/signaling', async (req, res) => {
  try {
    const { action, fromDeviceId, toDeviceId, familyId, data } = req.body;

    // Validate required fields
    validateFields(req.body, ['action', 'fromDeviceId', 'toDeviceId', 'familyId']);

    const channel = `family-${familyId}`;
    const timestamp = new Date().toISOString();

    console.log(`📡 Signaling: ${action} from ${fromDeviceId} to ${toDeviceId}`);

    switch (action) {
      case 'offer':
        await sendPusherEvent(channel, 'webrtc-offer', {
          from: fromDeviceId,
          to: toDeviceId,
          offer: data,
          timestamp
        });
        break;

      case 'answer':
        await sendPusherEvent(channel, 'webrtc-answer', {
          from: fromDeviceId,
          to: toDeviceId,
          answer: data,
          timestamp
        });
        break;

      case 'ice-candidate':
        await sendPusherEvent(channel, 'webrtc-ice-candidate', {
          from: fromDeviceId,
          to: toDeviceId,
          candidate: data,
          timestamp
        });
        break;

      case 'end-call':
        await sendPusherEvent(channel, 'webrtc-end-call', {
          from: fromDeviceId,
          to: toDeviceId,
          timestamp
        });
        break;

      case 'call-request':
        await sendPusherEvent(channel, 'incoming-call', {
          from: fromDeviceId,
          to: toDeviceId,
          callType: data.callType || 'voice',
          timestamp
        });
        break;

      case 'call-accepted':
        await sendPusherEvent(channel, 'call-accepted', {
          from: fromDeviceId,
          to: toDeviceId,
          timestamp
        });
        break;

      case 'call-rejected':
        await sendPusherEvent(channel, 'call-rejected', {
          from: fromDeviceId,
          to: toDeviceId,
          timestamp
        });
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.status(200).json({ 
      success: true, 
      message: `${action} sent successfully`,
      timestamp 
    });

  } catch (error) {
    console.error('Signaling error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Development API server running on http://localhost:${PORT}`);
  console.log(`📡 Real Pusher configured for live signaling`);
  console.log(`🔗 API endpoint: http://localhost:${PORT}/api/signaling`);
  console.log(`🔑 Pusher Key: ${process.env.PUSHER_KEY || 'your-pusher-key'}`);
  console.log(`🌍 Pusher Cluster: ${process.env.PUSHER_CLUSTER || 'us2'}`);
});

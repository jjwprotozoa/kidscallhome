/**
 * ============================================================================
 * KIDS CALL HOME - Signaling Server API
 * ============================================================================
 * 
 * Purpose: Handle WebRTC signaling between kids and guardians
 * Technology: Vercel Serverless Functions + Pusher
 * 
 * Endpoints:
 * - POST /api/signaling/offer - Send offer to peer
 * - POST /api/signaling/answer - Send answer to peer
 * - POST /api/signaling/ice-candidate - Send ICE candidate to peer
 * - POST /api/signaling/end-call - End call notification
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

const Pusher = require('pusher');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

// Helper function to validate required fields
const validateFields = (body, requiredFields) => {
  const missing = requiredFields.filter(field => !body[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
};

// Helper function to send Pusher event
const sendPusherEvent = async (channel, event, data) => {
  try {
    await pusher.trigger(channel, event, data);
    return { success: true };
  } catch (error) {
    console.error('Pusher error:', error);
    throw new Error('Failed to send signaling message');
  }
};

// Send offer to peer
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, fromDeviceId, toDeviceId, familyId, data } = req.body;

    // Validate required fields
    validateFields(req.body, ['action', 'fromDeviceId', 'toDeviceId', 'familyId']);

    const channel = `family-${familyId}`;
    const timestamp = new Date().toISOString();

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
}
